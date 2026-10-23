// Observed paired-seed ranges, never an estimate of a population confidence interval.
export function seedVariation(object, scores, contract) {
  const seedIds = [...new Set(Object.values(object.rounds).flat().filter(r => !r.error).map(r => r.seed))]
  const samples = seedIds.map(seed => {
    const rounds = Object.fromEntries(Object.entries(object.rounds).map(([key, rows]) => [key, rows.find(r => r.seed === seed && !r.error)]))
    const rate = key => rounds[key] ? (rounds[key].damage + (rounds[key].instant_hp || 0)) / rounds[key].duration : null
    const combine = keys => keys.every(k => rate(k) !== null) ? keys.reduce((sum,k) => sum + rate(k),0) / keys.length : null
    const raw = { single:rate('single'), swarm:rate('swarm'), air:combine(['air','air_swarm']), siege:combine(['armor','magic','boss']) }
    if (rounds.control) { raw.control = rounds.control.control / rounds.control.duration; raw.block = rounds.control.block / rounds.control.duration }
    if (rounds.survival) raw.survival = Math.max(0,100*rounds.survival.alive/rounds.survival.duration-5*rounds.survival.deaths)
    if (rounds.mobility) raw.mobility = rounds.mobility.mobility || 0
    const r = rounds.support, b = rounds.support_base
    if (r && b) raw.support = Math.max(0,(r.ally_damage-b.ally_damage)/Math.max(1,b.ally_damage)) + Math.max(0,(r.ally_alive-b.ally_alive)/(3*r.duration)) + r.healed/Math.max(1,r.duration*30)
    const cost = object.cost && object.cost + (object.hire_spent_mean || 0)
    if(cost && ['single','swarm','air','siege','block'].every(k => raw[k] != null)) raw.economy = (raw.single*.25+raw.swarm*.35+raw.air*.15+raw.siege*.25+raw.block*30)/(cost/1000)
    return raw
  })
  return Object.fromEntries(Object.entries(scores).map(([key, score]) => {
    const values = samples.map(r => r[key]).filter(v => typeof v === 'number' && Number.isFinite(v))
    if (!values.length) return [key, null]
    const min = Math.min(...values), max = Math.max(...values), mean=values.reduce((a,b)=>a+b,0)/values.length
    const grade = raw => raw === 0 ? '无' : contract.tiers.find(t => t.exclusive ? Math.min(100,70*Math.sqrt(raw/score.reference)) > t.min : Math.min(100,70*Math.sqrt(raw/score.reference)) >= t.min)?.grade
    return [key, { n:values.length, min, max, sd:Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/values.length), crossesGrade:!!score.reference && grade(min)!==grade(max) }]
  }))
}
