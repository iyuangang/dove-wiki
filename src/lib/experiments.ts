export interface ExperimentStat { mean:number; min:number; max:number; n:number }
export interface ExperimentCondition { id:string;name:string;suite:string;state:string;attempted:number;failed:number;metrics:Record<string,ExperimentStat> }
export interface ExperimentSubject { id:string;name:string;kind:'hero'|'tower';conditions:ExperimentCondition[];rounds:Record<string,unknown[]> }
export interface ExperimentResult {schema:1;type:'dove-experiment';protocol:string;rankable:false;environment:{game_version:string;commit:string};conditions:{profile:string;seconds:number;repeats:number;budget:number};notes:string[];subjects:ExperimentSubject[];rounds:number;errors:string[]}
export const experimentMetrics:Record<string,string>={dps:'主体有效输出 / 秒',ally_dps:'友军输出 / 秒',ally_dps_gain:'较同种子无主体参照的友军输出增量 / 秒',alive_percent:'主体存活时间 %',ally_alive:'平均存活友军数',healed:'主体治疗友军 / 秒',control:'控制秒 / 秒',block:'拦截秒 / 秒',received:'主体受伤 / 秒',deaths:'主体死亡次数',leaks:'漏怪数',first_arrival:'首段落地耗时（秒，越低越快）',mobility:'持续机动路程 / 秒',unit_count:'实际建造数量',spent:'实际投入金币',remaining:'剩余金币'}
export function parseExperiment(text:string):ExperimentResult {
  if(text.length>50*1024*1024)throw new Error('实验文件不能超过50 MB')
  const d=JSON.parse(text)
  if(d?.schema!==1||d.type!=='dove-experiment'||d.protocol!=='dove-lab-experiments-v1'||d.rankable!==false||
    !Array.isArray(d.subjects)||d.subjects.length<1||d.subjects.length>400||!Array.isArray(d.notes)||d.notes.some((v:unknown)=>typeof v!=='string')||
    !d.environment||typeof d.environment.game_version!=='string'||typeof d.environment.commit!=='string'||
    !d.conditions||!Number.isFinite(d.conditions.seconds)||!Number.isFinite(d.conditions.repeats)||!Array.isArray(d.errors))throw new Error('需要独立实验生成的 experiments.json；正式天梯文件不能作为实验导入')
  const ids=new Set<string>()
  for(const s of d.subjects){
    if(typeof s.id!=='string'||ids.has(s.id)||typeof s.name!=='string'||!['hero','tower'].includes(s.kind)||!Array.isArray(s.conditions)||s.conditions.length>20||!s.rounds||typeof s.rounds!=='object')throw new Error('实验对象不完整或重复')
    ids.add(s.id)
    for(const c of s.conditions){
      if(typeof c.id!=='string'||typeof c.name!=='string'||!['mobility','support','survival','budget'].includes(c.suite)||!Number.isInteger(c.attempted)||!Number.isInteger(c.failed)||c.failed<0||c.failed>c.attempted||!c.metrics||!Array.isArray(s.rounds[c.id]))throw new Error('实验条件与证据不完整')
      if(c.attempted!==s.rounds[c.id].length)throw new Error('实验轮数与原始证据不一致')
      for(const m of Object.values(c.metrics) as ExperimentStat[])if(!m||![m.mean,m.min,m.max,m.n].every(Number.isFinite)||m.min>m.mean||m.mean>m.max||!Number.isInteger(m.n)||m.n<1||m.n>c.attempted-c.failed)throw new Error('实验指标不合法')
    }
  }
  return d as ExperimentResult
}
