export type RatingProfile = 'standard' | 'quick'
export type RatingRole = 'output' | 'defense' | 'support'
export interface RatingValue { value: number | null; grade: string; raw?: number | null; reference?: number | null; uncapped?: number | null }
export interface RatingObject {
  id: string; templateId: string; name: string; kind: 'hero' | 'tower'; group: string; core: boolean; state: string
  primaryAvailable: boolean | null; successfulTrials: number; failedTrials: number; cost: number | null
  scores: Record<string, RatingValue>; ratings: Record<RatingRole, RatingValue>
  notes: Record<string, string>; annotation: string; errors: string[]
  evidence: { file: string; sha256: string; gzipSha256: string; bytes: number; compressedBytes: number }
}
export interface RatingDataset {
  schema: number
  summary: { profile: RatingProfile; gameVersion: string; commitHash: string; runId: string; asOf: string; seconds: number; repeats: number; templates: number; trials: number; coreTrials: number; coreFailed: number; failedTrials: number; protocol: string; mobilityProtocol: string }
  objects: RatingObject[]
  references: Record<string, Record<string, number>>
  provenance: { sourceSummarySha256: string; measurementSources: Record<string, string>; rawEvidence: string }
}
export const ratingGroups = [
  ['hero_melee', '英雄 · 近战'], ['hero_ranged', '英雄 · 远程'], ['tower_final', '防御塔 · 最终阶级'],
  ['tower_lower', '防御塔 · 过渡阶级'], ['tower_special', '关卡特殊塔 · 附录'],
  ['hero_special_melee', '特殊英雄 · 近战附录'], ['hero_special_ranged', '特殊英雄 · 远程附录'],
] as const
export const ratingRoles = { output: '输出', defense: '守线', support: '辅助' } as const
export const ratingAxes = { single: '对单', swarm: '对群', air: '对空', siege: '攻坚', control: '控场', survival: '生存', block: '拦截', support: '辅助', mobility: '机动', economy: '性价比' } as const
export const axesFor = (kind: 'hero' | 'tower') => kind === 'hero'
  ? ['single', 'swarm', 'air', 'siege', 'control', 'survival', 'support', 'mobility'] as const
  : ['single', 'swarm', 'air', 'siege', 'control', 'block', 'support', 'economy'] as const
export const ratingTiers = ['S', 'A', 'B', 'C', 'D', 'E', '无', '未评测']
export function ratingTier(row: RatingObject, role: RatingRole) {
  return row.state === 'complete' && row.ratings[role].value !== null ? row.ratings[role].grade : '未评测'
}
export function filterRatings(rows: RatingObject[], group: string, role: RatingRole, search: string) {
  const query = search.trim().toLocaleLowerCase()
  return rows.filter(r => r.group === group && (!query || `${r.name} ${r.id}`.toLocaleLowerCase().includes(query))).sort((a, b) =>
    (b.ratings[role].value ?? -1) - (a.ratings[role].value ?? -1) ||
    (b.ratings[role].uncapped ?? -1) - (a.ratings[role].uncapped ?? -1) || a.id.localeCompare(b.id))
}
export function radarPoint(index: number, value: number, radius = 130): [number, number] {
  const angle = index * Math.PI / 4 - Math.PI / 2
  return [200 + Math.cos(angle) * radius * value / 100, 192 + Math.sin(angle) * radius * value / 100]
}
export function radarPolygon(row: RatingObject) {
  const axes = axesFor(row.kind)
  return axes.every(k => row.scores[k].value !== null)
    ? axes.map((k, i) => radarPoint(i, row.scores[k].value!).join(',')).join(' ')
    : null
}
export function ratingNumber(value: number | null | undefined, raw = false) {
  return value === null || value === undefined ? '未评测' : value.toLocaleString('zh-CN', {
    minimumFractionDigits: raw ? 0 : 1,
    maximumFractionDigits: raw && value !== 0 && Math.abs(value) < 1 ? 4 : raw ? 2 : 1,
  })
}
