import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { homedir } from 'node:os'

export function validateContract(c) {
  if (c.schema !== 1 || !c.contractVersion || !c.scoreVersion || c.formula?.anchor !== 70 || c.formula?.ceiling !== 100 || c.formula?.exponent !== .5) throw new Error('评分定义版本或公式不支持')
  for (const kind of ['hero', 'tower']) {
    const keys = c.axisOrders?.[kind]
    if (!keys || keys.length !== 8 || new Set(keys).size !== 8 || keys.some(k => !c.axes[k]?.label || !c.axes[k]?.plain || !c.axes[k]?.unit)) throw new Error('八维指标定义不完整：' + kind)
    for (const role of ['output', 'defense', 'support']) {
      const parts = c.weights?.[kind]?.[role]
      if (!parts || Object.entries(parts).some(([k, v]) => !keys.includes(k) || !Number.isFinite(v) || v <= 0) || Math.abs(Object.values(parts).reduce((a, b) => a + b, 0) - 1) > 1e-10) throw new Error('评分权重不合法：' + kind + '/' + role)
    }
  }
  return c
}

export function validateDatasetScores(dataset, c) {
  validateContract(c)
  const close = (a, b) => a === b || Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-7
  const grade = n => n == null ? '未评测' : n === 0 ? '无' : c.tiers.find(t => n > t.min || n === t.min && !t.exclusive)?.grade
  for (const row of dataset.objects) {
    const expected = {}
    for (const key of c.axisOrders[row.kind]) {
      const s = row.scores[key]
      const value = row.state === 'complete' && s.raw !== null && s.reference > 0 ? Math.min(c.formula.ceiling, c.formula.anchor * Math.sqrt(Math.max(0, s.raw) / s.reference)) : null
      if (!close(value, s.value) || grade(value) !== s.grade) throw new Error('指标分数与评分定义不同：' + row.id + '/' + key)
      expected[key] = { value, uncapped: value === null ? null : c.formula.anchor * Math.sqrt(Math.max(0, s.raw) / s.reference) }
    }
    for (const [role, parts] of Object.entries(c.weights[row.kind])) {
      const value = Object.keys(parts).every(k => expected[k].value !== null) ? Object.entries(parts).reduce((sum, [k, w]) => sum + expected[k].value * w, 0) : null
      if (!close(value, row.ratings[role].value) || grade(value) !== row.ratings[role].grade) throw new Error('综合评价与评分定义不同：' + row.id + '/' + role)
    }
  }
}

export async function syncRatingContract(root, pluginDir, { check = false, required = true } = {}) {
  const source = join(pluginDir, 'data/rating_contract.json')
  const target = join(root, 'src/data/rating-contract.json')
  if (!existsSync(source) && !required) { validateContract(JSON.parse(await readFile(target, 'utf8'))); return false }
  const bytes = await readFile(source, 'utf8')
  validateContract(JSON.parse(bytes))
  if (check) { if (await readFile(target, 'utf8') !== bytes) throw new Error('Wiki 评分定义与插件不同，请先同步') }
  else await writeFile(target, bytes)
  return true
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
  const plugin = args.includes('--plugin-dir') ? args[args.indexOf('--plugin-dir') + 1] : join(process.env.APPDATA || join(homedir(), 'AppData/Roaming'), 'LOVE/kingdom_rush_dove/plugins/Meta_Rating_Center')
  await syncRatingContract(root, resolve(plugin), { check: args.includes('--check') })
  console.log('PASS 评分定义、八维解释、权重与版本同步')
}
