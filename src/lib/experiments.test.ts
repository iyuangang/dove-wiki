import { describe, expect, it } from 'vitest'
import { parseExperiment } from './experiments'
const valid=()=>({schema:1,type:'dove-experiment',protocol:'dove-lab-experiments-v1',rankable:false,environment:{game_version:'2.0.9.9',commit:'abc'},conditions:{profile:'quick',seconds:30,repeats:3,budget:4000},notes:['实验不评级'],subjects:[{id:'tower_ranger',name:'游侠',kind:'tower',rounds:{budget_single:[{seed:1729}]},conditions:[{id:'budget_single',name:'同预算对单',suite:'budget',state:'complete',attempted:1,failed:0,metrics:{dps:{mean:120,min:120,max:120,n:1}}}]}],rounds:1,errors:[]})
describe('independent experimental evidence',()=>{
  it('accepts a separate unranked protocol',()=>expect(parseExperiment(JSON.stringify(valid())).rankable).toBe(false))
  it('rejects formal datasets and experimental grades',()=>{
    expect(()=>parseExperiment(JSON.stringify({schema:1,objects:[]}))).toThrow()
    const d=valid();d.rankable=true;expect(()=>parseExperiment(JSON.stringify(d))).toThrow()
  })
  it('rejects conflicting sample count and invalid ranges',()=>{
    const d=valid();d.subjects[0]!.conditions[0]!.attempted=3;expect(()=>parseExperiment(JSON.stringify(d))).toThrow()
    d.subjects[0]!.conditions[0]!.attempted=1;d.subjects[0]!.conditions[0]!.metrics.dps.min=150
    expect(()=>parseExperiment(JSON.stringify(d))).toThrow()
  })
})
