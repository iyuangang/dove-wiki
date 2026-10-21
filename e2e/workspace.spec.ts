import { test, expect, type Page } from '@playwright/test'
import snapshot from '../src/data/dove-data.json' with { type: 'json' }
import ratingManifest from '../src/data/rating-manifest.json' with { type: 'json' }

const eye = snapshot.supportEffects.find(effect => effect.rangeFalloff)!
const eyeTower = snapshot.towers.find(tower => tower.id === eye.sourceTowerId)!
const heroEffect = snapshot.supportEffects.find(effect => effect.sourceType === 'hero' && effect.review?.valid !== false)!
const hero = snapshot.heroes.find(item => item.id === heroEffect.sourceHeroId)!
const eyeIsReviewed = eye.review?.valid !== false
const persistentEffect = eyeIsReviewed ? eye : heroEffect
const enemy = snapshot.enemies.find(item => item.statsByDifficulty.every(variant => variant.stats.hp !== null))!
const target = snapshot.towers.find(tower => tower.id === 'tower_high_elven')!
const pageErrors = new WeakMap<Page, string[]>()

async function navigate(page: Page, label: string) {
  const tab = page.getByRole('tab', { name: label, exact: true })
  const toggle = page.getByRole('button', { name: /^(展开|收起)导航$/ })
  const mobile = await toggle.isVisible()
  // A closing menu can still be visually present during its CSS transition.
  // Use the actual disclosure state rather than that transient visibility.
  if (mobile) {
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click()
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  }
  await tab.click()
  // The selected mobile tab leaves the accessibility tree when the menu closes.
  await expect(page.locator('#main-navigation [role="tab"][aria-selected="true"]')).toHaveText(label)
  if (mobile) await expect(toggle).toHaveAttribute('aria-expanded', 'false')
}
async function openTower(page: Page, id: string) {
  await navigate(page, '塔典')
  await page.getByRole('searchbox', { name: '搜索防御塔', exact: true }).fill(id)
  await page.locator('.tower-card .card-hit-area').first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
}
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
}
test.beforeEach(async ({ page }) => {
  pageErrors.set(page, [])
  page.on('pageerror', error => pageErrors.get(page)!.push(error.message))
  await page.goto('./')
})
test.afterEach(async ({ page }) => {
  expect(pageErrors.get(page)).toEqual([])
})

test('页面往返保留计算参数、辅助与滚动位置，并可完整重置', async ({ page }) => {
  await navigate(page, '辅助计算')
  await page.getByRole('checkbox', { name: '启用' + persistentEffect.name, exact: true }).check()
  if (eyeIsReviewed) await page.getByRole('spinbutton', { name: '两塔椭圆距离 / 半径（%）', exact: true }).fill('50')
  await page.getByRole('spinbutton', { name: '生命值', exact: true }).fill('2345')
  await page.evaluate(() => window.scrollTo({ top: 500, behavior: 'instant' }))
  await navigate(page, '敌人')
  await navigate(page, '强度天梯')
  await navigate(page, '辅助计算')
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(500)
  await expect(page.getByRole('checkbox', { name: '启用' + persistentEffect.name, exact: true })).toBeChecked()
  if (eyeIsReviewed) await expect(page.getByRole('spinbutton', { name: '两塔椭圆距离 / 半径（%）', exact: true })).toHaveValue('50')
  await expect(page.getByRole('spinbutton', { name: '生命值', exact: true })).toHaveValue('2345')
  await page.getByRole('button', { name: '重置计算配置', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: '启用' + persistentEffect.name, exact: true })).not.toBeChecked()
  await expect(page.getByRole('spinbutton', { name: '生命值', exact: true })).toHaveValue('1000')
  await expect(page.locator('#calculator-target')).toHaveValue('tower_ranger')
})

test('百科筛选与对比对象在导航及浏览器后退时保留', async ({ page }) => {
  const search = page.getByRole('searchbox', { name: '搜索防御塔', exact: true })
  await search.fill(target.id)
  await navigate(page, '双塔对比')
  await page.locator('#compare-left').selectOption(target.id)
  await navigate(page, '英雄')
  await page.goBack()
  await expect(page.locator('#compare-left')).toHaveValue(target.id)
  await navigate(page, '塔典')
  await expect(search).toHaveValue(target.id)
  await expect(page.locator('.tower-card')).toHaveCount(1)
})

test('塔详情带入目标和左右对比，同时保留现有辅助参数', async ({ page }) => {
  await navigate(page, '辅助计算')
  await page.getByRole('spinbutton', { name: '生命值', exact: true }).fill('4567')
  await openTower(page, target.id)
  await page.getByRole('button', { name: '作为计算目标', exact: true }).click()
  await expect(page.locator('#calculator-target')).toHaveValue(target.id)
  await expect(page.locator('#calculator-target')).toBeFocused()
  await expect(page.getByRole('spinbutton', { name: '生命值', exact: true })).toHaveValue('4567')
  await openTower(page, target.id)
  await page.getByRole('button', { name: '加入右侧对比', exact: true }).click()
  await expect(page.locator('#compare-right')).toHaveValue(target.id)
  await expect(page.locator('#compare-left')).toHaveValue('tower_ranger')
  await openTower(page, eyeTower.id)
  await page.getByRole('button', { name: '加入左侧对比', exact: true }).click()
  await expect(page.locator('#compare-left')).toHaveValue(eyeTower.id)
  await expect(page.locator('#compare-right')).toHaveValue(target.id)
})

test('辅助入口尊重来源审阅，累加有效选择并保留取消入口', async ({ page }) => {
  await openTower(page, eyeTower.id)
  if (eyeIsReviewed) {
    await page.getByRole('button', { name: '启用该塔辅助', exact: true }).click()
    await expect(page.getByRole('checkbox', { name: '启用' + eye.name, exact: true })).toBeChecked()
  } else {
    await expect(page.getByRole('button', { name: '启用该塔辅助', exact: true })).toHaveCount(0)
    await page.keyboard.press('Escape')
  }
  await navigate(page, '英雄')
  await page.getByRole('searchbox', { name: '搜索英雄、技能、移动方式或特性', exact: true }).fill(hero.id)
  await page.locator('.hero-card-hit').first().click()
  await page.getByRole('button', { name: '启用英雄辅助', exact: true }).click()
  await expect(page.getByRole('checkbox', { name: '启用' + heroEffect.name, exact: true })).toBeChecked()
  if (eyeIsReviewed) await expect(page.getByRole('checkbox', { name: '启用' + eye.name, exact: true })).toBeChecked()
  const excludedEffect = snapshot.supportEffects.find(effect => effect.excludeTowerIds?.length)!
  await page.getByRole('button', { name: /^全部\s/ }).click()
  if (excludedEffect.review?.valid === false) {
    await expect(page.getByRole('checkbox', { name: '启用' + excludedEffect.name, exact: true })).toBeDisabled()
    await page.getByRole('checkbox', { name: '启用' + heroEffect.name, exact: true }).uncheck()
    await expect(page.getByRole('checkbox', { name: '启用' + heroEffect.name, exact: true })).not.toBeChecked()
    return
  }
  await page.getByRole('checkbox', { name: '启用' + excludedEffect.name, exact: true }).check()
  await page.locator('#calculator-target').selectOption(excludedEffect.excludeTowerIds![0])
  const excludedCard = page.locator('.support-option').filter({ has: page.getByRole('checkbox', { name: '启用' + excludedEffect.name, exact: true }) })
  await expect(excludedCard.locator('.effect-status')).toContainText('不适用当前目标')
  await page.getByRole('checkbox', { name: '启用' + excludedEffect.name, exact: true }).uncheck()
  await expect(page.getByRole('checkbox', { name: '启用' + excludedEffect.name, exact: true })).not.toBeChecked()
})

test('敌人详情管理焦点并按难度载入，修改与待载入状态准确', async ({ page }) => {
  await navigate(page, '敌人')
  await page.getByRole('combobox', { name: '面板难度', exact: true }).selectOption('4')
  await page.getByRole('searchbox').fill(enemy.id)
  const opener = page.locator('.enemy-card-hit').first()
  await opener.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(dialog.getByRole('button', { name: '载入敌人面板', exact: true })).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(dialog.getByRole('button', { name: '关闭敌人详情', exact: true })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await opener.click()
  await page.getByRole('button', { name: '载入敌人面板', exact: true }).click()
  await expect(page.locator('#calculator-dummy')).toBeFocused()
  const hp = page.getByRole('spinbutton', { name: '生命值', exact: true })
  await expect(hp).toHaveValue(String(enemy.statsByDifficulty.find(variant => variant.difficulty === 4)!.stats.hp))
  await expect(page.locator('.enemy-panel-status')).toContainText('已载入')
  await hp.fill('789')
  await expect(page.locator('.enemy-panel-status')).toContainText('已修改')
  await page.getByRole('combobox', { name: '敌人难度', exact: true }).selectOption('1')
  await expect(page.locator('.enemy-panel-status')).toContainText('待载入')
  await expect(hp).toHaveValue('789')
  await page.getByRole('button', { name: '载入面板', exact: true }).click()
  await expect(hp).toHaveValue(String(enemy.statsByDifficulty.find(variant => variant.difficulty === 1)!.stats.hp))
  await expect(page.locator('.enemy-panel-status')).toContainText('已载入')
  await navigate(page, '敌人')
  await expect(page.getByRole('searchbox')).toHaveValue(enemy.id)
  await expect(page.getByRole('combobox', { name: '面板难度', exact: true })).toHaveValue('4')
})

test('无效数字与伤害顺序就地提示，修正后恢复模拟', async ({ page }) => {
  await navigate(page, '辅助计算')
  await page.getByRole('button', { name: '自定义攻击', exact: true }).click()
  const min = page.getByRole('spinbutton', { name: '最低伤害', exact: true })
  const max = page.getByRole('spinbutton', { name: '最高伤害', exact: true })
  await min.fill('200')
  await expect(min).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.dummy-stage')).toHaveCount(0)
  await max.fill('200')
  await expect(page.locator('.dummy-stage')).toBeVisible()
  const interval = page.getByRole('spinbutton', { name: '攻击间隔（秒）', exact: true })
  await interval.fill('')
  await expect(interval).toHaveAttribute('aria-invalid', 'true')
  const errorId = await interval.getAttribute('aria-describedby')
  await expect(page.locator('[id="' + errorId + '"]')).toHaveText('请填写有效数字')
  await interval.fill('0')
  await expect(interval).toHaveAttribute('aria-invalid', 'true')
  await interval.fill('1')
  const armor = page.getByRole('spinbutton', { name: '护甲 (%)', exact: true })
  await armor.fill('101')
  await expect(armor).toHaveValue('101')
  await expect(armor).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.attack-history')).toHaveCount(0)
  await armor.fill('0')
  await expect(page.locator('.dummy-stage')).toBeVisible()
  const hp = page.getByRole('spinbutton', { name: '生命值', exact: true })
  await hp.fill('-1')
  await expect(hp).toHaveAttribute('aria-invalid', 'true')
  await hp.fill('1000')
  await expect(page.locator('.dummy-stage')).toBeVisible()
  await noOverflow(page)
})

test('辅助半径和距离校验阻止误读，合法配置保持计算结果', async ({ page }) => {
  await navigate(page, '辅助计算')
  if (!eyeIsReviewed) {
    const checkbox = page.getByRole('checkbox', { name: '启用' + eye.name, exact: true })
    await expect(checkbox).toBeDisabled()
    const card = page.locator('.support-option').filter({ has: checkbox })
    await expect(card).toContainText('来源已变化，等待复核后恢复计算')
    await expect(card.locator('.support-inputs')).toHaveCount(0)
    await expect(page.locator('.result-stat-list')).toBeVisible()
    await noOverflow(page)
    return
  }
  await page.getByRole('checkbox', { name: '启用' + eye.name, exact: true }).check()
  const range = page.getByRole('spinbutton', { name: '源塔当前覆盖半径', exact: true })
  const distance = page.getByRole('spinbutton', { name: '两塔椭圆距离 / 半径（%）', exact: true })
  await distance.fill('101')
  await expect(distance).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.result-stat-list')).toHaveCount(0)
  await expect(page.locator('.effect-status')).toContainText('参数待修正')
  await distance.fill('50')
  await range.fill('')
  await expect(range).toHaveAttribute('aria-invalid', 'true')
  await range.fill('200')
  await expect(page.locator('.result-stat-list')).toBeVisible()
  await expect(page.locator('.effect-status')).toHaveText('已参与计算')
  const ranger = snapshot.towers.find(tower => tower.id === 'tower_ranger')!
  const level = eye.levels.at(-1)!
  const expectedRange = ranger.attack.range! * (1 + level.rangeBonus! * (1 - 0.5 * (1 - eye.rangeFalloff!.edgeFactor)))
  await expect(page.locator('.result-stat-list article').nth(1).locator('.before-after strong')).toHaveText(String(expectedRange))
  await noOverflow(page)
})

test('全部页面、详情操作和错误提示在各宽度无横向溢出', async ({ page }, testInfo) => {
  for (const label of ['塔典', '敌人', '英雄', '强度天梯', '科技', '更新', '辅助计算', '双塔对比', '数据说明']) {
    await navigate(page, label)
    await noOverflow(page)
  }
  await openTower(page, eyeTower.id)
  const dialog = page.getByRole('dialog')
  expect(await dialog.evaluate(element => element.scrollWidth - element.clientWidth)).toBeLessThanOrEqual(1)
  await expect(dialog).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await navigate(page, '辅助计算')
  await page.getByRole('spinbutton', { name: '生命值', exact: true }).fill('-1')
  await noOverflow(page)
  await page.screenshot({ path: testInfo.outputPath('calculator-validation.png'), fullPage: false })
})

test('条件科技数量与触发次数校验整数，修正后恢复结果', async ({ page }) => {
  await navigate(page, '辅助计算')
  const mage = snapshot.towers.find(tower => tower.families.includes('mage'))!
  await page.locator('#calculator-target').selectOption(mage.id)
  await page.getByRole('combobox', { name: '法师塔科技', exact: true }).selectOption('6')
  const count = page.getByRole('spinbutton', { name: '场上法师塔', exact: true })
  await count.fill('1.5')
  await expect(count).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.result-stat-list')).toHaveCount(0)
  await count.fill('10')
  await expect(count).toHaveAttribute('aria-invalid', 'true')
  await count.fill('4')
  await expect(page.locator('.result-stat-list')).toBeVisible()
  const triggered = snapshot.supportEffects.find(effect => effect.levels.some(level => level.damagePerTrigger))!
  if (triggered.review?.valid === false) {
    await expect(page.getByRole('checkbox', { name: '启用' + triggered.name, exact: true })).toBeDisabled()
    return
  }
  await page.getByRole('checkbox', { name: '启用' + triggered.name, exact: true }).check()
  const triggers = page.getByRole('spinbutton', { name: '目标获益次数', exact: true })
  await triggers.fill('1.5')
  await expect(triggers).toHaveAttribute('aria-invalid', 'true')
  await expect(page.locator('.result-stat-list')).toHaveCount(0)
  await triggers.fill('2')
  await expect(page.locator('.result-stat-list')).toBeVisible()
})

test('塔与英雄弹窗保持键盘焦点并恢复打开按钮', async ({ page }, testInfo) => {
  await openTower(page, eyeTower.id)
  const towerOpener = page.locator('.tower-card .card-hit-area').first()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  for (let index = 0; index < 25; index++) {
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Tab')
  }
  await page.screenshot({ path: testInfo.outputPath('tower-actions.png'), fullPage: false })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(towerOpener).toBeFocused()
  await navigate(page, '英雄')
  await page.getByRole('searchbox', { name: '搜索英雄、技能、移动方式或特性', exact: true }).fill(hero.id)
  const heroOpener = page.locator('.hero-card-hit').first()
  await heroOpener.click()
  await expect(dialog).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  for (let index = 0; index < 25; index++) {
    expect(await dialog.evaluate(element => element.contains(document.activeElement))).toBe(true)
    await page.keyboard.press('Tab')
  }
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(heroOpener).toBeFocused()
})

test('天梯保留两档实测、分类和版本边界，直接地址可刷新', async ({ page }) => {
  await navigate(page, '强度天梯')
  await expect(page.locator('.rating-section-heading').first()).toContainText(`已评级 ${ratingManifest.profiles.standard.groupCounts.hero_ranged} / ${ratingManifest.profiles.standard.groupCounts.hero_ranged}`)
  await expect(page.locator('.rating-facts')).toContainText(ratingManifest.profiles.standard.coreTrials.toLocaleString('en-US'))
  if (ratingManifest.commitHash !== snapshot.metadata.commitHash) {
    await expect(page.getByRole('note')).toContainText(`当前百科已同步至 ${snapshot.metadata.gameVersion}`)
  }
  await page.getByRole('combobox', { name: '对象类别', exact: true }).selectOption('tower_final')
  await expect(page.locator('.rating-section-heading').first()).toContainText(`已评级 ${ratingManifest.profiles.standard.groupCounts.tower_final} / ${ratingManifest.profiles.standard.groupCounts.tower_final}`)
  await page.getByRole('combobox', { name: '测评档位', exact: true }).selectOption('quick')
  await expect(page.locator('.rating-board')).toBeVisible()
  await expect(page.locator('.rating-facts')).toContainText(ratingManifest.profiles.quick.coreTrials.toLocaleString('en-US'))
  await expect(page.locator('.rating-section-heading').first()).toContainText(`已评级 ${ratingManifest.profiles.quick.groupCounts.tower_final} / ${ratingManifest.profiles.quick.groupCounts.tower_final}`)
  await expect(page.locator('.version-badge')).toContainText(`Game v${ratingManifest.profiles.quick.gameVersion}`)
  await expect(page.getByRole('img', { name: /八维雷达图/ })).toBeVisible()
  await noOverflow(page)
  await page.reload()
  await expect(page).toHaveURL(/#\/tierlist$/)
  await expect(page.locator('.rating-board')).toBeVisible()
})
