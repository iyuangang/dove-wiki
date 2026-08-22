import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const toolsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(toolsDir, '..')
const defaultDataPath = resolve(projectRoot, 'src', 'data', 'dove-data.json')
const defaultHistoryPath = resolve(projectRoot, 'src', 'data', 'game-changelog.json')

const categoryLabels = {
  hero: '英雄',
  tower: '防御塔',
  enemy: '敌人',
  technology: '科技',
}

const numericFields = {
  hero: [
    ['availableLevel', '可用关卡'],
    ['startingLevel', '初始等级'],
    ['maxStats.hp', '最大生命'],
    ['maxStats.armor', '物理护甲'],
    ['maxStats.magicArmor', '魔法抗性'],
    ['maxStats.meleeDamageMin', '近战最低伤害'],
    ['maxStats.meleeDamageMax', '近战最高伤害'],
    ['maxStats.rangedDamageMin', '远程最低伤害'],
    ['maxStats.rangedDamageMax', '远程最高伤害'],
  ],
  tower: [
    ['price', '建造价格'],
    ['attack.damageMin', '最低伤害'],
    ['attack.damageMax', '最高伤害'],
    ['attack.cooldown', '攻击间隔'],
    ['attack.range', '攻击范围'],
    ['attack.rallyRange', '集结范围'],
    ['soldier.count', '士兵数量'],
    ['soldier.hp', '士兵生命'],
    ['soldier.armor', '士兵护甲'],
    ['soldier.magicArmor', '士兵魔抗'],
    ['soldier.respawn', '士兵重生时间'],
  ],
  enemy: [
    ['stats.hp', '生命'],
    ['stats.damageMin', '最低伤害'],
    ['stats.damageMax', '最高伤害'],
    ['stats.armor', '物理护甲'],
    ['stats.magicArmor', '魔法抗性'],
    ['stats.speed', '移动速度'],
    ['stats.lives', '扣除生命'],
    ['stats.gold', '赏金'],
  ],
}

function readPath(value, path) {
  return path.split('.').reduce((current, key) => current?.[key], value)
}

function comparable(value) {
  return value === undefined ? null : value
}

function valuesEqual(left, right) {
  return JSON.stringify(comparable(left)) === JSON.stringify(comparable(right))
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '无'
  if (typeof value === 'boolean') return value ? '是' : '否'
  if (Array.isArray(value)) return value.length ? value.join('；') : '无'
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)))
  return String(value)
}

function numericDetail(field, before, after) {
  let direction = 'changed'
  let delta = null

  if (typeof before === 'number' && typeof after === 'number') {
    direction = after > before ? 'increase' : after < before ? 'decrease' : 'changed'
    const difference = after - before
    const percentage = before === 0 ? null : (difference / Math.abs(before)) * 100
    delta = `${difference > 0 ? '+' : ''}${Number(difference.toFixed(4))}`
    if (percentage !== null) delta += `（${percentage > 0 ? '+' : ''}${percentage.toFixed(1)}%）`
  }

  return {
    field,
    before: formatValue(before),
    after: formatValue(after),
    delta,
    direction,
  }
}

function textDetail(field, before, after) {
  return {
    field,
    before: formatValue(before),
    after: formatValue(after),
    delta: null,
    direction: 'changed',
  }
}

function makeChange(category, kind, entity, details, options = {}) {
  const kindLabels = {
    added: '新增',
    removed: '移除',
    balance: '数值调整',
    content: '内容调整',
  }
  const entityName = entity.name || entity.id

  return {
    id: `${category}:${entity.id}:${kind}:${options.suffix || 'main'}`,
    category,
    kind,
    entityId: entity.id,
    entityName,
    title: options.title || `${kindLabels[kind]}${categoryLabels[category]}：${entityName}`,
    description: options.description || '',
    image: kind === 'removed'
      ? null
      : options.image || entity.thumbnail || entity.image || entity.icon || null,
    details,
  }
}

function additionDescription(category, entity) {
  if (category === 'hero') {
    const abilities = entity.abilities?.length || entity.specialties?.length || 0
    return `新增可用英雄，包含 ${abilities} 项能力。`
  }
  if (category === 'tower') return `新增防御塔，定位为${(entity.roles || []).join('、') || '未分类'}。`
  if (category === 'enemy') return `新增敌人百科条目。`
  if (category === 'technology') return `新增${entity.treeName || ''}科技。`
  return ''
}

function compareNumericFields(category, before, after) {
  return (numericFields[category] || [])
    .filter(([path]) => !valuesEqual(readPath(before, path), readPath(after, path)))
    .map(([path, label]) => numericDetail(label, readPath(before, path), readPath(after, path)))
}

function compareHeroContent(before, after) {
  const details = []
  if (before.description !== after.description) {
    details.push(textDetail('英雄说明', before.description, after.description))
  }
  if (!valuesEqual(before.specialties, after.specialties)) {
    details.push(textDetail('能力列表', before.specialties, after.specialties))
  }
  if (!valuesEqual(before.profileStats, after.profileStats)) {
    details.push(textDetail('英雄面板评级', before.profileStats, after.profileStats))
  }
  if (!valuesEqual(before.skills, after.skills)) {
    details.push(textDetail('技能等级与解锁', JSON.stringify(before.skills), JSON.stringify(after.skills)))
  }

  const beforeAbilities = new Map((before.abilities || []).map((ability) => [ability.name, ability]))
  const afterAbilities = new Map((after.abilities || []).map((ability) => [ability.name, ability]))
  for (const [name, ability] of afterAbilities) {
    const previousAbility = beforeAbilities.get(name)
    if (!previousAbility) details.push(textDetail(`新增能力：${name}`, null, ability.description))
    else if (previousAbility.description !== ability.description) {
      details.push(textDetail(`能力说明：${name}`, previousAbility.description, ability.description))
    }
  }
  for (const [name, ability] of beforeAbilities) {
    if (!afterAbilities.has(name)) details.push(textDetail(`移除能力：${name}`, ability.description, null))
  }
  return details
}

function compareTowerPowers(before, after) {
  const numeric = []
  const content = []
  const beforePowers = new Map((before.powers || []).map((power) => [power.id, power]))
  const afterPowers = new Map((after.powers || []).map((power) => [power.id, power]))

  for (const [id, power] of afterPowers) {
    const previousPower = beforePowers.get(id)
    if (!previousPower) {
      content.push(textDetail(`新增技能：${power.name}`, null, power.descriptions?.map((item) => item.text)))
      continue
    }
    for (const [key, label] of [
      ['priceBase', '基础价格'],
      ['priceIncrement', '升级价格'],
      ['maxLevel', '等级上限'],
    ]) {
      if (!valuesEqual(previousPower[key], power[key])) {
        numeric.push(numericDetail(`${power.name} · ${label}`, previousPower[key], power[key]))
      }
    }
    const previousDescriptions = (previousPower.descriptions || []).map((item) => item.text)
    const descriptions = (power.descriptions || []).map((item) => item.text)
    if (!valuesEqual(previousDescriptions, descriptions)) {
      content.push(textDetail(`${power.name} · 技能说明`, previousDescriptions, descriptions))
    }
  }
  for (const [id, power] of beforePowers) {
    if (!afterPowers.has(id)) {
      content.push(textDetail(`移除技能：${power.name}`, power.descriptions?.map((item) => item.text), null))
    }
  }
  if (before.description !== after.description) {
    content.push(textDetail('防御塔说明', before.description, after.description))
  }
  return { numeric, content }
}

function compareEnemyContent(before, after) {
  const details = []
  for (const [key, label] of [
    ['description', '敌人说明'],
    ['special', '特殊能力'],
    ['traits', '特性'],
  ]) {
    if (!valuesEqual(before[key], after[key])) details.push(textDetail(label, before[key], after[key]))
  }
  return details
}

function flattenTechnologies(data) {
  return (data.technologyTrees || []).flatMap((tree) =>
    tree.technologies.map((technology) => ({
      ...technology,
      id: `${tree.id}:${technology.id}`,
      treeName: tree.name,
    })),
  )
}

function compareTechnology(before, after) {
  const numeric = []
  const content = []
  if (before.price !== after.price) numeric.push(numericDetail('星级价格', before.price, after.price))
  if (before.description !== after.description) {
    content.push(textDetail('科技说明', before.description, after.description))
  }
  if (!valuesEqual(before.modifiers, after.modifiers)) {
    content.push(textDetail('数值规则', JSON.stringify(before.modifiers), JSON.stringify(after.modifiers)))
  }
  return { numeric, content }
}

function compareCollection(previousItems, currentItems, category, compareContent) {
  const changes = []
  const previousById = new Map(previousItems.map((entity) => [entity.id, entity]))
  const currentById = new Map(currentItems.map((entity) => [entity.id, entity]))

  for (const [id, entity] of currentById) {
    const before = previousById.get(id)
    if (!before) {
      changes.push(makeChange(category, 'added', entity, [], { description: additionDescription(category, entity) }))
      continue
    }

    const numeric = compareNumericFields(category, before, entity)
    let content = []
    if (category === 'hero') content = compareHeroContent(before, entity)
    if (category === 'enemy') content = compareEnemyContent(before, entity)
    if (compareContent) {
      const extra = compareContent(before, entity)
      numeric.push(...extra.numeric)
      content.push(...extra.content)
    }
    if (numeric.length) changes.push(makeChange(category, 'balance', entity, numeric))
    if (content.length) changes.push(makeChange(category, 'content', entity, content))
  }

  for (const [id, entity] of previousById) {
    if (!currentById.has(id)) changes.push(makeChange(category, 'removed', entity, []))
  }
  return changes
}

function uniqueEnemies(enemies) {
  return [...new Map((enemies || []).map((enemy) => [enemy.id, enemy])).values()]
}

export function createGameRelease(previousData, currentData) {
  const changes = [
    ...compareCollection(previousData.heroes || [], currentData.heroes || [], 'hero'),
    ...compareCollection(previousData.towers || [], currentData.towers || [], 'tower', compareTowerPowers),
    ...compareCollection(uniqueEnemies(previousData.enemies), uniqueEnemies(currentData.enemies), 'enemy'),
    ...compareCollection(
      flattenTechnologies(previousData),
      flattenTechnologies(currentData),
      'technology',
      compareTechnology,
    ),
  ]

  const categoryCounts = Object.fromEntries(
    Object.keys(categoryLabels).map((category) => [
      category,
      changes.filter((change) => change.category === category).length,
    ]),
  )
  const kindCounts = Object.fromEntries(
    ['added', 'removed', 'balance', 'content'].map((kind) => [
      kind,
      changes.filter((change) => change.kind === kind).length,
    ]),
  )

  return {
    id: `${currentData.metadata.gameVersion}-${currentData.metadata.commitHash.slice(0, 12)}`,
    version: currentData.metadata.gameVersion,
    previousVersion: previousData.metadata.gameVersion,
    contentVersion: currentData.metadata.contentVersion,
    commitHash: currentData.metadata.commitHash,
    previousCommitHash: previousData.metadata.commitHash,
    detectedAt: currentData.metadata.generatedAt,
    summary: {
      changeCount: changes.length,
      categoryCounts,
      kindCounts,
    },
    changes,
  }
}

export function updateGameChangelog(previousData, currentData, history = null) {
  const normalized = history || { schemaVersion: 1, generatedAt: null, releases: [] }
  if (!previousData || !currentData) return normalized
  if (previousData.metadata.commitHash === currentData.metadata.commitHash) return normalized
  if (normalized.releases.some((release) => release.commitHash === currentData.metadata.commitHash)) {
    return normalized
  }

  const release = createGameRelease(previousData, currentData)
  return {
    schemaVersion: 1,
    generatedAt: currentData.metadata.generatedAt,
    releases: [release, ...normalized.releases],
  }
}

async function readJson(path, fallback = null) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

function readOption(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

async function runCli() {
  const previousRef = readOption('--previous-ref') || 'HEAD'
  const currentPath = resolve(readOption('--current') || defaultDataPath)
  const historyPath = resolve(readOption('--output') || defaultHistoryPath)
  const previousData = JSON.parse(
    execFileSync('git', ['show', `${previousRef}:src/data/dove-data.json`], {
      cwd: projectRoot,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    }),
  )
  const currentData = await readJson(currentPath)
  const history = await readJson(historyPath)
  const nextHistory = updateGameChangelog(previousData, currentData, history)
  await writeFile(historyPath, `${JSON.stringify(nextHistory, null, 2)}\n`, 'utf8')
  const release = nextHistory.releases.find(
    (candidate) => candidate.commitHash === currentData.metadata.commitHash,
  )
  console.log(
    `[dove-wiki] 更新记录：${release?.previousVersion || '未知'} → ${release?.version || currentData.metadata.gameVersion}，${release?.summary.changeCount || 0} 组变化`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runCli().catch((error) => {
    console.error(`[dove-wiki] 更新记录生成失败：${error.message}`)
    process.exitCode = 1
  })
}
