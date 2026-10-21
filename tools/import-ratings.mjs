import { readFile, writeFile, mkdir, copyFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const option = name => args[args.indexOf(name) + 1]
if (!args.includes('--standard') || !args.includes('--quick') || !args.includes('--methods')) {
  throw new Error('Usage: node tools/import-ratings.mjs --standard <benchmark-dir> --quick <benchmark-dir> --methods <methodology.md>')
}
const axes = {
  hero: ['single', 'swarm', 'air', 'siege', 'control', 'survival', 'support', 'mobility'],
  tower: ['single', 'swarm', 'air', 'siege', 'control', 'block', 'support', 'economy'],
}
const sha = bytes => createHash('sha256').update(bytes).digest('hex')
const json = file => readFile(file, 'utf8').then(JSON.parse)
const save = (file, value) => writeFile(file, JSON.stringify(value))
const profiles = {}
for (const profile of ['standard', 'quick']) {
  const sourceDir = path.resolve(option('--' + profile))
  const input = await json(path.join(sourceDir, 'native_reference.json'))
  const s = input.summary
  if (!s.core_complete || (s.core_error_trials ?? s.core_failed_trials) !== 0) throw new Error('Incomplete formal sample: ' + profile)
  const outputDir = path.join(root, 'public/rating', profile)
  await mkdir(path.join(outputDir, 'raw'), { recursive: true })
  const sessions = new Map()
  const evidence = {}
  const dates = []
  for (const id of new Set(input.objects.map(r => r.template_id))) {
    const bytes = await readFile(path.join(sourceDir, 'raw', id + '.json'))
    const session = JSON.parse(bytes.toString('utf8'))
    if (session.environment.game_version !== s.game_version || session.environment.commit !== s.commit) throw new Error('Mixed game builds: ' + id)
    sessions.set(id, session)
    dates.push(session.created_at.slice(0, 10))
    const compressed = gzipSync(bytes, { level: 9 })
    await writeFile(path.join(outputDir, 'raw', id + '.json.gz'), compressed)
    evidence[id] = { file: `rating/${profile}/raw/${id}.json.gz`, sha256: sha(bytes), gzipSha256: sha(compressed), bytes: bytes.length, compressedBytes: compressed.length }
  }
  let coreTrials = 0
  const objects = input.objects.map(r => {
    const original = sessions.get(r.template_id).objects.find(o => o.id === r.id)
    const core = r.core ?? ['hero_melee', 'hero_ranged', 'tower_final', 'tower_lower'].includes(r.group)
    const scores = Object.fromEntries(axes[r.kind].map(key => {
      const prefix = key === 'support' ? 'support_axis_' : key + '_'
      const raw = r.raw?.[key] ?? r[key + '_raw'] ?? null
      const value = r.scores ? r.scores[key]?.value ?? null : r[prefix + 'score'] ?? null
      const reference = r.scores ? r.scores[key]?.reference ?? null : r[key + '_reference'] ?? null
      const grade = r.scores ? r.scores[key]?.grade : r[prefix + 'grade']
      if (value !== null && (!Number.isFinite(value) || !Number.isFinite(raw) || !reference || Math.abs(value - Math.min(100, 70 * Math.sqrt(Math.max(0, raw) / reference))) > 1e-6)) throw new Error('Invalid axis: ' + r.id + '/' + key)
      return [key, { raw, value, reference, grade: grade || '未评测' }]
    }))
    const defense = { control: .35, support: .25, [r.kind === 'hero' ? 'survival' : 'block']: .4 }
    const weights = { output: { single: .25, swarm: .35, air: .15, siege: .25 }, defense, support: { support: .7, control: .3 } }
    const ratings = Object.fromEntries(Object.entries(weights).map(([role, parts]) => {
      const rating = r.ratings?.[role]
      const value = rating?.value ?? r[role + '_score'] ?? null
      if (value !== null && (Object.keys(parts).some(k => scores[k].value === null) || Math.abs(value - Object.entries(parts).reduce((sum, [k, w]) => sum + scores[k].value * w, 0)) > 1e-6)) throw new Error('Invalid composite: ' + r.id + '/' + role)
      return [role, { value, grade: rating?.grade ?? r[role + '_grade'] ?? '未评测', uncapped: rating?.uncapped ?? r[role + '_uncapped'] ?? null }]
    }))
    if (core) {
      const rounds = Object.values(original.rounds).flat()
      if (r.state !== 'complete' || original.errors.length || rounds.some(round => round.error)) throw new Error('Failed formal object: ' + r.id)
      const repeats = profile === 'standard' ? 5 : 3
      if (Object.keys(original.rounds).length !== (r.kind === 'hero' ? 12 : 11) || Object.values(original.rounds).some(rs => rs.length !== repeats)) throw new Error('Incomplete rounds: ' + r.id)
      coreTrials += rounds.length
    }
    return { id: r.id, templateId: r.template_id, name: r.name, kind: r.kind, group: r.group, core, state: r.state,
      primaryAvailable: r.primary_available ?? null, successfulTrials: r.successful_trials, failedTrials: r.failed_trials,
      cost: r.cost ?? null, scores, ratings, notes: r.notes || {}, annotation: r.annotation_limitation || '',
      errors: original.errors.slice(0, 3), evidence: evidence[r.template_id] }
  })
  if (coreTrials !== s.core_trials || objects.length !== 291) throw new Error('Formal coverage mismatch: ' + profile)
  const summary = { profile, gameVersion: s.game_version, commitHash: s.commit, runId: s.run_id, asOf: dates.sort().at(-1),
    seconds: profile === 'standard' ? 60 : 30, repeats: profile === 'standard' ? 5 : 3,
    templates: s.templates_total ?? s.templates, trials: s.trials_complete ?? s.attempted_trials, coreTrials,
    coreFailed: 0, failedTrials: s.error_trials ?? s.failed_trials, protocol: 'hero-combat-modes-v3', mobilityProtocol: 'native-rally-v1' }
  const dataset = { schema: 1, summary, objects, references: input.references || s.references,
    provenance: { sourceSummarySha256: sha(await readFile(path.join(sourceDir, 'native_reference.json'))), measurementSources: input.source_fingerprints || input.environment.measurement_sources,
      rawEvidence: 'Unmodified native session JSON compressed with gzip; capture-time provisional scores may differ from final cohort scores.' } }
  await save(path.join(outputDir, 'results.json'), dataset)
  await copyFile(path.join(sourceDir, 'native_scores.csv'), path.join(outputDir, 'native_scores.csv'))
  const pictures = (await readdir(sourceDir)).filter(f => /^(hero|tower).*_(output|defense|support)\.png$/.test(f))
  if (pictures.length !== 21) throw new Error('Expected 21 tier images: ' + profile)
  for (const file of pictures) await copyFile(path.join(sourceDir, file), path.join(outputDir, file))
  await save(path.join(outputDir, 'evidence-manifest.json'), evidence)
  profiles[profile] = { ...summary, file: `rating/${profile}/results.json`, sha256: sha(await readFile(path.join(outputDir, 'results.json'))) }
}
const methodsBytes = await readFile(path.resolve(option('--methods')))
await writeFile(path.join(root, 'public/rating/methodology.md'), methodsBytes)
// Render only trusted, locally authored methodology. Escape HTML before inline
// formatting; no raw HTML, scripts, or arbitrary Markdown links are accepted.
const escape = s => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
const inline = s => escape(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
const lines = methodsBytes.toString('utf8').split(/\r?\n/)
const blocks = []
for (let i = 0; i < lines.length;) {
  const line = lines[i]
  if (!line.trim()) { i++; continue }
  if (line.startsWith('```')) {
    const code = []; i++
    while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
    i++; blocks.push('<pre><code>' + escape(code.join('\n')) + '</code></pre>'); continue
  }
  const heading = /^(#{1,3}) (.+)/.exec(line)
  if (heading) { blocks.push(`<h${heading[1].length + 1}>${inline(heading[2])}</h${heading[1].length + 1}>`); i++; continue }
  if (line.startsWith('|') && /^\|\s*:?-/.test(lines[i + 1] || '')) {
    const cells = s => s.trim().slice(1, -1).split('|').map(c => c.trim())
    const headers = cells(line); i += 2
    const rows = []
    while (i < lines.length && lines[i].startsWith('|')) rows.push(cells(lines[i++]))
    blocks.push('<div class="methods-table"><table><thead><tr>' + headers.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(c => '<td>' + inline(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>'); continue
  }
  if (/^(?:- |\d+\. )/.test(line)) {
    const items = []
    while (i < lines.length && /^(?:- |\d+\. )/.test(lines[i])) items.push(lines[i++].replace(/^(?:- |\d+\. )/, ''))
    blocks.push('<ul>' + items.map(s => '<li>' + inline(s) + '</li>').join('') + '</ul>'); continue
  }
  const paragraph = []
  while (i < lines.length && lines[i].trim() && !/^(?:#|```|\||- |\d+\. )/.test(lines[i])) paragraph.push(lines[i++])
  if (!paragraph.length) paragraph.push(lines[i++])
  blocks.push('<p>' + inline(paragraph.join(' ')) + '</p>')
}
await mkdir(path.join(root, 'src/data'), { recursive: true })
await save(path.join(root, 'src/data/rating-methodology.json'), { sha256: sha(methodsBytes), html: blocks.join('\n') })
await save(path.join(root, 'src/data/rating-manifest.json'), { schema: 1, gameVersion: profiles.standard.gameVersion, commitHash: profiles.standard.commitHash, profiles })
console.log(JSON.stringify({ profiles, files: 'public/rating', evidence: 'Original raw JSON preserved as .json.gz' }, null, 2))
