import { test, expect } from '@playwright/test'
test('local experimental evidence remains separate and fits mobile',async({page},testInfo)=>{
  await page.goto('./#/tierlist')
  await expect(page.locator('.rating-board')).toBeVisible()
  await page.getByRole('button',{name:'独立实验室（机动、辅助、生存与同预算）',exact:true}).click()
  const data={schema:1,type:'dove-experiment',protocol:'dove-lab-experiments-v1',rankable:false,environment:{game_version:'2.0.9.9',commit:'abc'},conditions:{profile:'quick',seconds:30,repeats:3,budget:4000},notes:['固定种子观测范围不是置信区间'],subjects:[{id:'tower_ranger',name:'游侠',kind:'tower',rounds:{budget_single:[{seed:1729,unit_count:2,spent:3440,remaining:560}]},conditions:[{id:'budget_single',name:'同预算：对单',suite:'budget',state:'complete',attempted:1,failed:0,metrics:{dps:{mean:120,min:120,max:120,n:1}}}]}],rounds:1,errors:[]}
  await page.getByLabel('读取本地实验结果').setInputFiles({name:'experiments.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(data))})
  await expect(page.locator('.experiment-viewer article')).toContainText('游侠')
  await page.getByLabel('实验类型',{exact:true}).selectOption('budget')
  await expect(page.locator('.experiment-viewer article')).toContainText('120')
  await page.locator('.experiment-viewer').scrollIntoViewIfNeeded()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true)
  await page.screenshot({path:testInfo.outputPath('experiment-viewer.png')})
  await page.getByLabel('读取本地实验结果').setInputFiles({name:'wrong.json',mimeType:'application/json',buffer:Buffer.from('{"schema":1,"objects":[]}')})
  await expect(page.locator('.experiment-viewer [role=alert]')).toBeVisible()
  await expect(page.locator('.rating-board')).toBeVisible()
})
