import { test, expect } from '@playwright/test'
test('rating deep link survives reload and defers encyclopedia data', async ({page})=>{
  const requests:string[]=[];page.on('request',r=>requests.push(r.url()))
  await page.goto('./#/tierlist?profile=quick&group=tower_final&role=defense&id=tower_ranger')
  await expect(page.getByLabel('测评档位')).toHaveValue('quick')
  await expect(page.locator('#rating-detail-title')).toContainText('游侠')
  expect(requests.some(url=>/\/dove-data-[^/]+\.js/.test(url))).toBe(false)
  await page.reload()
  await expect(page.locator('#rating-detail-title')).toContainText('游侠')
  await expect(page.getByLabel('评价方向')).toHaveValue('defense')
})
