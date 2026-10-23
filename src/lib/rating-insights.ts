import { ratingAxes, ratingNumber, type RatingDataset, type RatingObject } from './ratings'
export function cohortComparison(data: RatingDataset, row: RatingObject) {
  const cohort = data.objects.filter(r => r.group === row.group && r.state === 'complete')
  return Object.keys(row.scores).map(key => {
    const sorted = cohort.filter(r => Number.isFinite(r.scores[key]?.raw)).sort((a,b) => b.scores[key]!.raw! - a.scores[key]!.raw! || a.id.localeCompare(b.id))
    const top = sorted[0]; const n = sorted.length
    const median = n ? (sorted[Math.floor((n-1)/2)]!.scores[key]!.raw! + sorted[Math.floor(n/2)]!.scores[key]!.raw!) / 2 : null
    const raw = row.scores[key]?.raw
    const delta = (ref: number | null | undefined) => raw == null || ref == null ? '不可比较' : ref === 0 ? `参照为零；差值 ${ratingNumber(raw - ref, true)}` : `${raw >= ref ? '+' : ''}${((raw/ref-1)*100).toFixed(1)}%`
    return { key, label: ratingAxes[key as keyof typeof ratingAxes], count:n, top: top?.name || '未评测', best: top?.scores[key]?.raw, median, versusTop: delta(top?.scores[key]?.raw), versusMedian: delta(median) }
  })
}
export function feedbackBundle(data: RatingDataset, row: RatingObject, route: string) {
  return { schema: 1, type: 'dove-rating-feedback', route, objectId: row.id, profile: data.summary.profile,
    gameVersion: data.summary.gameVersion, commit: data.summary.commitHash, runId: data.summary.runId,
    protocols: [data.summary.protocol, data.summary.mobilityProtocol], evidence: row.evidence,
    sources: data.provenance.measurementSources, observation: { scenario:'', seed:'', expected:'', actual:'', reproduction:'', evidenceLink:'' } }
}
