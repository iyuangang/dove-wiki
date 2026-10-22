import contract from '../data/rating-contract.json'
export type RatingProfile = 'standard' | 'quick'
export type RatingRole = 'output' | 'defense' | 'support'
export interface RatingValue { value: number | null; grade: string; raw?: number | null; reference?: number | null; uncapped?: number | null }
export interface RatingObject {
  id: string; templateId: string; name: string; kind: 'hero' | 'tower'; group: string; core: boolean; state: string
  primaryAvailable: boolean | null; successfulTrials: number; failedTrials: number; cost: number | null
  variation?: Record<string, {n:number;min:number;max:number;sd:number;crossesGrade:boolean} | null>
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
export type RatingAxis = keyof typeof contract.axes
export const ratingGroups = contract.groups
export const ratingRoles = Object.fromEntries(contract.roles) as Record<RatingRole, string>
export const ratingAxes = Object.fromEntries(Object.entries(contract.axes).map(([key, item]) => [key, item.label])) as Record<RatingAxis, string>
export const axesFor = (kind: 'hero' | 'tower') => contract.axisOrders[kind] as RatingAxis[]
export const ratingTiers = [...contract.tiers.map(t => t.grade), '无', '未评测']
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

export function validRatingCoverage(data: RatingDataset) {
  const ids = new Set(data.objects.map(r => r.id))
  const templates = new Set(data.objects.map(r => r.templateId))
  const core = data.objects.filter(r => r.core)
  const melee = data.objects.filter(r => r.group === 'hero_melee').length
  return data.schema === 1 && data.summary.coreFailed === 0 && ids.size === data.objects.length &&
    templates.size === data.summary.templates && melee > 0 && melee === data.objects.filter(r => r.group === 'hero_ranged').length &&
    data.objects.some(r => r.group === 'tower_final') && core.every(r => r.state === 'complete' && r.failedTrials === 0) &&
    core.reduce((sum, r) => sum + r.successfulTrials, 0) === data.summary.coreTrials
}
