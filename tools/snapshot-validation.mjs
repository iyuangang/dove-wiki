import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const snapshotHash = (text) => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')

export function validateRaw(raw, runId) {
  if (raw.metadata?.runId !== runId) throw new Error('提取结果不是本次运行生成的快照。')
  for (const key of ['towers', 'heroes', 'enemies']) {
    if (!Array.isArray(raw[key]) || !raw[key].length) throw new Error(`原始快照缺少 ${key}。`)
    if (raw[key].some((item) => !item.id || !item.template_exists && key === 'enemies')) throw new Error(`${key} 存在缺失模板或 ID。`)
  }
  if (!raw.localization || !Array.isArray(raw.technology?.lists)) throw new Error('原始快照缺少文本或科技树。')
  for (const enemy of raw.enemies) {
    if (enemy.difficulty_stats?.length !== 4) throw new Error(`${enemy.id} 缺少四套难度数据。`)
    const prefix = enemy.source_game === 1 ? '' : `kr${enemy.source_game}_`
    for (const key of ['detail_sprite', 'thumb_sprite']) {
      if (!enemy.encyclopedia?.[key]?.startsWith(`${prefix}encyclopedia_creep`)) throw new Error(`${enemy.id} 百科图集来源不匹配。`)
    }
  }
}

export function enemyValidation(enemies) {
  return {
    enemyMissingStats: enemies.flatMap((enemy) => enemy.statsByDifficulty.flatMap((variant) =>
      Object.entries(variant.missingFields).map(([field, reason]) => ({ entryId: enemy.entryId, difficulty: variant.difficulty, field, reason, expected: variant.notApplicableFields.includes(field) })))),
    enemyInfoErrors: enemies.flatMap((enemy) => enemy.statsByDifficulty.filter((variant) => variant.infoError)
      .map((variant) => ({ entryId: enemy.entryId, difficulty: variant.difficulty, message: variant.infoError }))),
  }
}

export function validateSnapshot(data, manifest, contract) {
  if (!contract.supportedSchemaVersions.includes(data.schemaVersion)) throw new Error(`站点不支持数据格式 ${data.schemaVersion}；请发布兼容代码。`)
  if (!contract.supportedCalculationRulesVersions.includes(data.calculationRules?.version)) throw new Error('站点不支持当前计算规则；请发布兼容代码。')
  const rules = data.calculationRules
  if (!rules.parameters || !Object.keys(rules.files || {}).length || !Array.isArray(rules.invalidFiles) || rules.valid !== (rules.invalidFiles.length === 0) ||
    contract.requiredCalculationParameters.some((key) => rules.parameters[key] === undefined) ||
    Object.values(rules.parameters).some((value) => (Array.isArray(value) ? value : [value]).some((number) => !Number.isFinite(number) || number < 0))) throw new Error('计算规则参数或审阅指纹格式无效。')
  if (manifest.schemaVersion !== data.schemaVersion || manifest.gameCommit !== data.metadata.commitHash) throw new Error('快照与审阅清单不属于同一份数据。')
  for (const [key, count] of [['towers', 'towerCount'], ['heroes', 'heroCount'], ['enemies', 'enemyCount']]) {
    if (!Array.isArray(data[key]) || !data[key].length || data[key].length !== data.summary[count]) throw new Error(`${key} 数量与快照统计不一致。`)
    const ids = data[key].map((item) => key === 'enemies' ? item.entryId : item.id)
    if (new Set(ids).size !== ids.length) throw new Error(`${key} 存在重复 ID。`)
  }
  for (const [key, reviewKey, field] of [['towers', 'towers', 'mechanics'], ['heroes', 'heroes', 'details']]) {
    const review = manifest.reviews[reviewKey]
    for (const item of data[key]) {
      if (item[field].reviewedVersion !== review.version) throw new Error(`${item.id} 审阅版本与快照清单不一致。`)
      for (const claim of item[field].items) {
        if (!claim.sources.length || claim.sources.some((source) => !review.files[source.file] || review.invalidFiles.includes(source.file))) throw new Error(`${item.id}:${claim.id} 缺少有效审阅指纹。`)
      }
    }
  }
  for (const enemy of data.enemies) {
    if (enemy.statsByDifficulty.length !== 4) throw new Error(`${enemy.id} 难度数据不完整。`)
    for (const variant of enemy.statsByDifficulty) {
      for (const [field, value] of Object.entries(variant.stats)) {
        if (value === null ? !variant.missingFields[field] : !Number.isFinite(value)) throw new Error(`${enemy.id}.${field} 缺少有效数值或缺失原因。`)
      }
    }
  }
  if (new Set(data.supportEffects.map((effect) => effect.id)).size !== data.supportEffects.length || data.summary.supportEffectCount !== data.supportEffects.length) throw new Error('辅助效果数量或 ID 无效。')
  for (const effect of data.supportEffects) {
    if (effect.sourceType === 'tower' && !data.towers.some((tower) => tower.id === effect.sourceTowerId)) throw new Error(`${effect.id} 辅助来源塔不存在。`)
    if (!effect.review) continue
    const review = manifest.reviews.supports
    if (!review || effect.review.reviewedVersion !== review.version || !effect.review.sources.length) throw new Error(`${effect.id} 辅助审阅清单不一致。`)
    const invalidFiles = effect.review.sources.filter((file) => !review.files[file] || review.invalidFiles.includes(file))
    if (effect.review.valid !== (invalidFiles.length === 0) || JSON.stringify(invalidFiles) !== JSON.stringify(effect.review.invalidFiles)) throw new Error(`${effect.id} 辅助审阅指纹状态不一致。`)
  }
}

export async function validateAssets(data, stageRoot, fallbackRoot) {
  const assets = new Set()
  function visit(value) {
    if (typeof value === 'string' && /^\/[a-z][\w/-]*\.png$/.test(value)) assets.add(value)
    else if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === 'object') Object.values(value).forEach(visit)
  }
  visit(data)
  for (const asset of assets) {
    let bytes
    try { bytes = await readFile(join(stageRoot, 'public', asset.slice(1))) }
    catch (error) {
      if (!fallbackRoot || asset.startsWith('/heroes/')) throw new Error(`缺少生成图片：${asset}`, { cause: error })
      bytes = await readFile(join(fallbackRoot, 'public', asset.slice(1)))
    }
    if (bytes.length < 24 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || !bytes.readUInt32BE(16) || !bytes.readUInt32BE(20)) throw new Error(`图片格式无效：${asset}`)
  }
  return assets.size
}
