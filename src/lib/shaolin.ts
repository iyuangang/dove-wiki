// Mirrors target_round = ceil(i / #targets) and the damage factor in
// scripts.decal_shaolin.update. This is a pre-defense, one-volley calculation.
export function shaolinVolley(monks: number, targets: number, min: number, max: number) {
  if (![monks, targets].every((value) => Number.isInteger(value) && value > 0) || monks > 6 || targets > 99) {
    throw new RangeError('Invalid Shaolin formation')
  }
  const hits = Array.from({ length: monks }, (_, index) => {
    const round = Math.ceil((index + 1) / targets)
    const factor = 1 / Math.sqrt(Math.max(round - 2, 1))
    return { monk: index + 1, target: index % targets + 1, round, factor, min: min * factor, max: max * factor }
  })
  return { hits, min: hits.reduce((sum, hit) => sum + hit.min, 0), max: hits.reduce((sum, hit) => sum + hit.max, 0) }
}
