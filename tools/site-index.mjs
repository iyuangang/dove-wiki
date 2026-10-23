import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
export async function generateSiteIndex(root, check = false) {
  const bytes = await readFile(path.join(root, 'src/data/dove-data.json'))
  const data = JSON.parse(bytes)
  const index = { sourceSha256: createHash('sha256').update(bytes).digest('hex'), metadata: data.metadata, summary: data.summary,
    supportEffects: data.supportEffects.map(e => ({ id: e.id, levels: e.levels.map(l => ({ level: l.level, radius: l.radius })) })),
    technologyTrees: data.technologyTrees.map(t => ({ id: t.id })),
    portraits: Object.fromEntries([...data.towers.map(t => [t.id, t.image]), ...data.heroes.map(h => [h.id, h.thumbnail])]) }
  const output = JSON.stringify(index) + '\n'
  const target = path.join(root, 'src/data/site-index.json')
  if (check) { if (await readFile(target, 'utf8') !== output) throw new Error('site-index differs from source snapshot') }
  else await writeFile(target, output)
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await generateSiteIndex(path.resolve(fileURLToPath(new URL('..', import.meta.url))), process.argv.includes('--check'))
