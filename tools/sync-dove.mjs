import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { homedir } from 'node:os'
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolveDovePaths } from './dove-paths.mjs'
import { updateGameChangelog } from './game-changelog.mjs'
import { buildPowerLevels, buildTowerUnits } from './tower-details.mjs'
import { inferTowerRoles } from './tower-roles.mjs'
import { buildTowerMechanics, loadMechanicReview } from './tower-mechanics.mjs'
import { buildHeroDetails, loadHeroReview, mergeHeroSnapshot } from './hero-details.mjs'
import { normalizeEnemy } from './enemy-data.mjs'
import { beginSync, generatedPaths } from './sync-transaction.mjs'
import { enemyValidation, snapshotHash, validateAssets, validateRaw, validateSnapshot } from './snapshot-validation.mjs'
import { loadCalculationRules } from './calculation-rules.mjs'
import { buildSupportEffects, loadSupportReview } from './support-effects.mjs'

const toolsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(toolsDir, '..')
const defaultGameDirs = [
  join(process.env.LOCALAPPDATA || join(homedir(), 'AppData', 'Local'), '王国保卫战Dove版'),
  'D:\\KingdomRushDove-Windows-Cycle2-v0.1.5\\KingdomRushDove',
]

function readOption(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

let gameDir
let loveExe
const rawDir = join(toolsDir, '.tmp')
let rawPath
const errorPath = join(rawDir, 'dove-error.log')
const dataDir = join(projectRoot, 'src', 'data')
const dataPath = join(dataDir, 'dove-data.json')
const changelogPath = join(dataDir, 'game-changelog.json')
let portraitDir, encyclopediaDir, encyclopediaThumbDir, skillIconDir, heroDir,
  heroThumbDir, enemyDir, enemyThumbDir, technologyDir, damageIconDir

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || projectRoot,
    encoding: 'utf8',
    env: options.env || process.env,
    stdio: options.quiet ? 'pipe' : 'inherit',
    windowsHide: true,
    timeout: options.timeout || 180_000,
  })

  if (result.status !== 0) {
    const diagnostic = result.error?.message ||
      (options.errorPath && existsSync(options.errorPath) ? readFileSync(options.errorPath, 'utf8') : '') ||
      (options.quiet ? result.stderr || result.stdout : '')
    const details = diagnostic ? `\n${diagnostic}` : ''
    throw new Error(`${basename(command)} 执行失败（退出码 ${result.status}）${details}`)
  }

  return result
}

async function walkLuaFiles(root) {
  const output = []
  const entries = await readdir(root, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(root, entry.name)
    if (entry.isDirectory()) {
      output.push(...(await walkLuaFiles(fullPath)))
    } else if (entry.isFile() && entry.name.endsWith('.lua')) {
      output.push(fullPath)
    }
  }

  return output
}

function quotedValues(source) {
  return [...source.matchAll(/["'](tower_[a-zA-Z0-9_]+)["']/g)].map(
    (match) => match[1],
  )
}

function findTableBodies(source, fieldName) {
  const bodies = []
  const pattern = new RegExp(`\\b${fieldName}\\s*=\\s*\\{`, 'g')

  for (const startMatch of source.matchAll(pattern)) {
    const start = startMatch.index + startMatch[0].length
    let depth = 1
    let quote = null
    let escaped = false

    for (let index = start; index < source.length; index += 1) {
      const char = source[index]
      if (quote) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === quote) quote = null
        continue
      }

      if (char === '"' || char === "'") quote = char
      else if (char === '{') depth += 1
      else if (char === '}') {
        depth -= 1
        if (depth === 0) {
          bodies.push(source.slice(start, index))
          break
        }
      }
    }
  }

  return bodies
}

function findTableBody(source, fieldName) {
  return findTableBodies(source, fieldName)[0] || ''
}

async function buildUnlockIndex(towerIds) {
  const slotPath = join(gameDir, 'kr1', 'data', 'slot_template.lua')
  const slotSource = await readFile(slotPath, 'utf8')
  const locked = new Set(quotedValues(findTableBody(slotSource, 'locked_towers')))
  const levelDir = join(gameDir, 'kr1', 'data', 'levels')
  const levelEntries = await readdir(levelDir)
  const unlockLevels = new Map()

  for (const filename of levelEntries) {
    const match = /^level(\d+)(?:_data)?\.lua$/.exec(filename)
    if (!match) continue
    const source = await readFile(join(levelDir, filename), 'utf8')
    const level = Number(match[1])
    const sourcePath = `kr1/data/levels/${filename}`

    for (const body of findTableBodies(source, 'unlock_towers')) {
      for (const towerId of quotedValues(body)) {
        const current = unlockLevels.get(towerId)
        if (
          !current ||
          level < current.level ||
          (level === current.level && sourcePath < current.source)
        ) {
          unlockLevels.set(towerId, { level, source: sourcePath })
        }
      }
    }
  }

  return new Map(
    towerIds.map((towerId) => {
      if (unlockLevels.has(towerId)) {
        const { level, source } = unlockLevels.get(towerId)
        return [
          towerId,
          {
            status: 'level',
            level,
            label: `第 ${level} 关开始可用，通关后永久解锁`,
            source,
          },
        ]
      }

      if (locked.has(towerId)) {
        return [
          towerId,
          {
            status: 'missing',
            label: '游戏数据未配置解锁关卡（初始为锁定）',
            source: 'kr1/data/slot_template.lua',
          },
        ]
      }

      return [
        towerId,
        {
          status: 'default',
          label: '默认可用（未列入初始锁定表）',
          source: 'kr1/data/slot_template.lua',
        },
      ]
    }),
  )
}

async function buildTemplateSourceIndex() {
  const files = await walkLuaFiles(join(gameDir, 'kr1'))
  const result = new Map()

  for (const file of files) {
    const source = await readFile(file, 'utf8')
    for (const match of source.matchAll(/(?:\bRT|\bE:register_t)\s*\(\s*["']([a-zA-Z0-9_]+)["']/g)) {
      if (!result.has(match[1])) {
        result.set(match[1], relative(gameDir, file).replaceAll('\\', '/'))
      }
    }
  }

  return result
}

function localizationCandidates(towerId, suffix) {
  const exact = `${towerId.toUpperCase()}_${suffix}`
  const withoutLevel = `${towerId.toUpperCase().replace(/_LVL4$/, '')}_${suffix}`
  return exact === withoutLevel ? [exact] : [exact, withoutLevel]
}

function localizeTower(localization, towerId) {
  const nameKey = localizationCandidates(towerId, 'NAME').find(
    (key) => localization[key],
  )
  const descriptionKey = localizationCandidates(towerId, 'DESCRIPTION').find(
    (key) => localization[key],
  )

  return {
    name: nameKey ? localization[nameKey] : towerId,
    description: descriptionKey ? localization[descriptionKey] : '暂无中文描述。',
    nameKey: nameKey || null,
    descriptionKey: descriptionKey || null,
  }
}

function cleanDynamicText(value) {
  return value?.replace(/%\$[^%]+%\$/g, '动态数值').replace(/\s+/g, ' ').trim()
}

function localizePowers(localization, towerId, powers = {}, powerIcons = {}) {
  const exactBase = towerId.toUpperCase()
  const bases = [...new Set([exactBase, exactBase.replace(/_LVL4$/, '')])]

  return Object.entries(powers).map(([powerId, power]) => {
    const powerToken = powerId.toUpperCase()
    const matchingKeys = Object.keys(localization).filter(
      (key) =>
        bases.some((base) => key.startsWith(`${base}_${powerToken}_`)),
    )
    const nameKey =
      matchingKeys.find((key) => /(?:_1_NAME|_NAME_1)$/.test(key)) ||
      matchingKeys.find((key) => key.endsWith('_NAME')) ||
      matchingKeys.find((key) => key.includes('_NAME'))
    const descriptionKeys = matchingKeys
      .filter((key) => key.includes('DESCRIPTION'))
      .sort((a, b) => a.localeCompare(b, 'en'))
    const descriptions = descriptionKeys.map((key) => ({
      key,
      text: cleanDynamicText(localization[key]),
    }))

    return {
      id: powerId,
      name: nameKey ? localization[nameKey] : powerId.replaceAll('_', ' '),
      icon: powerIcons[powerId] ? `/skills/${towerId}--${powerId}.png` : null,
      iconSprite: powerIcons[powerId]?.sprite || null,
      maxLevel: Number(power.max_level || 0),
      priceBase: Number.isFinite(power.price_base) ? power.price_base : null,
      priceIncrement: Number.isFinite(power.price_inc) ? power.price_inc : null,
      descriptions,
    }
  })
}

const damageTypeBits = [
  [1, '真实'],
  [512, '混合'],
  [32, '魔法范围'],
  [16, '电击'],
  [8, '物理范围'],
  [4, '魔法'],
  [64, '枪伤'],
  [128, '粗暴'],
  [256, '穿刺'],
  [2, '物理'],
]

function formatDamageType(value) {
  if (!Number.isFinite(value) || value === 0) return '未标注'
  const matches = damageTypeBits
    .filter(([bit]) => (value & bit) !== 0)
    .map(([, label]) => label)
  return matches.length ? [...new Set(matches)].join(' / ') : `类型 ${value}`
}

const technologyClassFamilies = {
  archers: 'archer',
  barracks: 'barrack',
  mages: 'mage',
  engineers: 'engineer',
  rain: 'rain',
  reinforcements: 'reinforcement',
}

const directDamageTechnologies = new Set([
  'archer_critical',
  'archer_fly_killer',
  'barrack_weapon',
  'mage_arcane_spell',
  'mage_empowered_magic',
  'mage_power',
  'engineer_concentrated_fire',
  'engineer_emergency_expansion',
])

const ceilPriceTechnologies = new Set([
  'archer_salvage',
  'mage_hermetic_study',
  'mage_rune_analysis',
])

const floorPriceTechnologies = new Set([
  'barrack_mobilize',
  'barrack_skill_master',
  'engineer_field_logistics',
  'engineer_emergency_expansion',
])

function technologyModifier(metric, operation, value, options = {}) {
  return { metric, operation, value, ...options }
}

function normalizeTechnologyModifiers(technologyId, technology) {
  const modifiers = []

  if (ceilPriceTechnologies.has(technologyId) && Number.isFinite(technology.cost_factor)) {
    modifiers.push(
      technologyModifier('price', 'multiply', technology.cost_factor, { rounding: 'ceil' }),
    )
  }
  if (floorPriceTechnologies.has(technologyId)) {
    const factor = technology.cost_factor ?? technology.price_factor
    if (Number.isFinite(factor)) {
      modifiers.push(technologyModifier('price', 'multiply', factor, { rounding: 'floor' }))
    }
  }

  if (Number.isFinite(technology.range_factor)) {
    if (technology.class === 'barracks') {
      modifiers.push(technologyModifier('rallyRange', 'multiply', technology.range_factor))
    } else {
      const options = technologyId === 'engineer_range_finder'
        ? { excludeTowerIds: ['tower_mech', 'tower_balloon'] }
        : {}
      modifiers.push(technologyModifier('range', 'multiply', technology.range_factor, options))
    }
  }
  if (Number.isFinite(technology.rally_range_factor)) {
    modifiers.push(
      technologyModifier('rallyRange', 'multiply', technology.rally_range_factor),
    )
  }

  if (
    directDamageTechnologies.has(technologyId) &&
    Number.isFinite(technology.damage_factor)
  ) {
    modifiers.push(technologyModifier('damage', 'multiply', technology.damage_factor))
  }
  if (technologyId === 'mage_harmony' && Number.isFinite(technology.damage_factor)) {
    modifiers.push(
      technologyModifier('damage', 'average', technology.damage_factor),
    )
  }
  if (
    technologyId === 'archer_precision' &&
    Number.isFinite(technology.chance) &&
    Number.isFinite(technology.damage_factor)
  ) {
    modifiers.push(
      technologyModifier(
        'expectedDps',
        'multiply',
        1 + technology.chance * (technology.damage_factor - 1),
      ),
    )
  }
  if (technologyId === 'mage_brilliance' && Array.isArray(technology.damage_factors)) {
    modifiers.push({
      metric: 'damage',
      operation: 'table',
      values: technology.damage_factors.map(Number),
    })
  }

  if (technologyId === 'archer_fast_shots' && Number.isFinite(technology.cooldown_factor)) {
    modifiers.push(
      technologyModifier('cooldown', 'multiply', 1 / (2 - technology.cooldown_factor)),
    )
  }
  if (technologyId === 'engineer_gnomish_tinkering') {
    modifiers.push(
      technologyModifier(
        'cooldown',
        'multiply',
        technology.cooldown_factor_electric,
        { includeTowerIds: ['tower_tesla', 'tower_frankenstein'] },
      ),
    )
  }
  if (
    ['barrack_go_on', 'barrack_improved_deployment'].includes(technologyId) &&
    Number.isFinite(technology.cooldown_factor)
  ) {
    modifiers.push(
      technologyModifier('respawn', 'multiply', technology.cooldown_factor),
    )
  }

  if (Number.isFinite(technology.health_factor)) {
    modifiers.push(
      technologyModifier('soldierHp', 'multiply', technology.health_factor),
    )
  }
  if (Number.isFinite(technology.armor_increase)) {
    modifiers.push(
      technologyModifier('soldierArmor', 'add', technology.armor_increase),
    )
  }
  if (Number.isFinite(technology.magic_armor_inc)) {
    modifiers.push(
      technologyModifier('soldierMagicArmor', 'add', technology.magic_armor_inc),
    )
  }

  if (technologyId === 'barrack_bodies') {
    const specialTowerIds = [
      'tower_baby_ashbite',
      'tower_pandas_lvl4',
      'tower_ogre_shipwreck',
      'tower_swamp_monster',
    ]
    modifiers.push(
      technologyModifier('soldierCount', 'add', 1, {
        excludeTowerIds: ['tower_baby_ashbite', 'tower_pandas_lvl4'],
      }),
      technologyModifier('soldierHp', 'multiply', 0.8, {
        excludeTowerIds: specialTowerIds,
      }),
      technologyModifier('damage', 'multiply', 1.3, {
        includeTowerIds: specialTowerIds,
      }),
    )
  }

  if (technologyId === 'engineer_magic_dust' && Number.isFinite(technology.damage_factor)) {
    modifiers.push(
      technologyModifier('damage', 'multiply', technology.damage_factor, {
        includeTowerIds: [
          'tower_tesla',
          'tower_frankenstein',
          'tower_rotten_forest',
          'tower_ignis_altar',
          'tower_sandworm',
        ],
      }),
    )
  }
  if (technologyId === 'engineer_diffusion' && Number.isFinite(technology.radius_factor)) {
    modifiers.push(
      technologyModifier('range', 'multiply', technology.radius_factor, {
        includeTowerIds: [
          'tower_rotten_forest',
          'tower_dwaarp',
          'tower_melting_furnace',
        ],
      }),
    )
  }
  if (technologyId === 'engineer_efficiency') {
    modifiers.push(
      technologyModifier('damage', 'multiply', 1.25, {
        includeTowerIds: [
          'tower_rotten_forest',
          'tower_ignis_altar',
          'tower_sandworm',
        ],
      }),
    )
  }

  return modifiers.filter((modifier) =>
    modifier.operation === 'table' || Number.isFinite(modifier.value),
  )
}

function buildTechnologyTrees(rawTechnology, localization) {
  const lists = Array.isArray(rawTechnology?.lists) ? rawTechnology.lists : []

  return lists.map((technologyList, index) => {
    const treeId = index + 1
    const technologies = Object.entries(technologyList)
      .filter(([, technology]) => technologyClassFamilies[technology.class])
      .map(([technologyId, technology]) => ({
        id: technologyId,
        family: technologyClassFamilies[technology.class],
        level: Number(technology.level),
        price: Number(technology.price),
        icon: `/technologies/${treeId}/${technologyId}.png`,
        iconSprite: technology.icon_sprite || null,
        name:
          localization[`UPGRADE_${treeId}_${technologyId}_NAME`] ||
          technologyId.replaceAll('_', ' '),
        description:
          localization[`UPGRADE_${treeId}_${technologyId}_DESCRIPTION`] ||
          '游戏脚本未提供中文说明。',
        modifiers: normalizeTechnologyModifiers(technologyId, technology),
      }))
      .sort((left, right) => {
        const familyOrder = ['archer', 'barrack', 'mage', 'engineer', 'rain', 'reinforcement']
        return (
          familyOrder.indexOf(left.family) - familyOrder.indexOf(right.family) ||
          left.level - right.level ||
          left.id.localeCompare(right.id, 'en')
        )
      })

    return {
      id: treeId,
      name: localization[`UPGRADES_${treeId}`] || `科技 ${treeId}`,
      source: 'kr1/upgrades.lua',
      maxLevel: Math.max(0, ...technologies.map((technology) => technology.level)),
      technologies,
    }
  })
}

function lastFinite(values) {
  if (!Array.isArray(values)) return null
  for (let index = values.length - 1; index >= 0; index -= 1) {
    if (Number.isFinite(values[index])) return values[index]
  }
  return null
}

function heroSkillMaxLevel(skill) {
  const mappedLevels = Object.values(skill?.xp_level_steps || {}).filter(Number.isFinite)
  const arrayLengths = Object.entries(skill || {})
    .filter(([key, value]) => key !== 'xp_level_steps' && Array.isArray(value))
    .map(([, value]) => value.length)
  return Math.max(1, ...mappedLevels, ...arrayLengths)
}

const heroAbilityDescriptionAliases = {
  'hero_hacksaw:伐伐伐木！': '伐伐伐木',
  'hero_monk:蛇形拳': '蛇型拳',
  'hero_bruce:流血利爪': '流血利刃',
  'hero_builder:加班加点': '正在施工',
  'hero_builder:拆迁专家': '拆迁达人',
  'hero_builder:防御炮台': '防御塔楼',
  'hero_builder:铁球横扫': '破城钢球',
  'hero_lava:烈焰席卷': '烈炎席卷',
  'hero_dianyun:至尊波': '势崩江河',
  'hero_beresad:龙息术': '爆炎',
  'hero_beresad:恐惧之龙': '惧龙',
  'hero_beresad:龙之爪牙': '龙生',
  'hero_beresad:湮灭射线': '片甲不留',
  'hero_beresad:地狱火雨': '地狱火',
}

function heroAbilityDescription(rawHero, name) {
  const descriptions = rawHero.skill_descriptions || {}
  const alias = heroAbilityDescriptionAliases[`${rawHero.id}:${name}`]
  return descriptions[name] || descriptions[alias] || '游戏脚本未提供可直接展示的技能说明。'
}

function normalizeHero(rawHero, localization) {
  const token = rawHero.id.replace(/^hero_/, '').toUpperCase()
  const levelStats = rawHero.template?.hero?.level_stats || {}
  const specialText = localization[`HERO_${token}_SPECIAL`] || ''
  const specialties = specialText
    .split(/[，,]/)
    .map((item) => item.trim())
    .filter(Boolean)
  const skills = Object.entries(rawHero.template?.hero?.skills || {})
    .map(([skillId, skill]) => ({
      id: skillId,
      maxLevel: heroSkillMaxLevel(skill),
      unlockLevels: Object.entries(skill?.xp_level_steps || {})
        .map(([heroLevel, skillLevel]) => ({
          heroLevel: Number(heroLevel),
          skillLevel: Number(skillLevel),
        }))
        .filter(
          (entry) => Number.isFinite(entry.heroLevel) && Number.isFinite(entry.skillLevel),
        )
        .sort((left, right) => left.skillLevel - right.skillLevel),
    }))
    .sort((left, right) => {
      const leftUnlock = left.unlockLevels[0]?.heroLevel ?? 99
      const rightUnlock = right.unlockLevels[0]?.heroLevel ?? 99
      return leftUnlock - rightUnlock || left.id.localeCompare(right.id, 'en')
    })

  const meleeDamageMin =
    lastFinite(levelStats.melee_damage_min) ?? lastFinite(levelStats.damage_min)
  const meleeDamageMax =
    lastFinite(levelStats.melee_damage_max) ?? lastFinite(levelStats.damage_max)

  return {
    id: rawHero.id,
    name: localization[`HERO_${token}_NAME`] || rawHero.id.replaceAll('_', ' '),
    description: localization[`HERO_${token}_DESCRIPTION`] || '游戏脚本未提供中文描述。',
    specialties,
    abilities: specialties.map((name) => ({
      name,
      description: heroAbilityDescription(rawHero, name),
    })),
    image: `/heroes/${rawHero.id}.png`,
    thumbnail: `/heroes/thumbs/${rawHero.id}.png`,
    sourceGame: Number(rawHero.from_kr || 1),
    availableLevel: Number(rawHero.available_level || 1),
    startingLevel: Number(rawHero.starting_level || 1),
    profileStats: (rawHero.stats || []).map(Number),
    maxStats: {
      hp: lastFinite(levelStats.hp_max),
      armor: lastFinite(levelStats.armor),
      magicArmor: lastFinite(levelStats.magic_armor),
      meleeDamageMin,
      meleeDamageMax,
      rangedDamageMin: lastFinite(levelStats.ranged_damage_min),
      rangedDamageMax: lastFinite(levelStats.ranged_damage_max),
    },
    skills,
    sources: {
      template: rawHero.template_exists ? 'kr1/heroes.lua + kr1/data/balance.lua' : null,
      roster: 'kr1-desktop/data/map_data.lua → hero_data',
      localization: '_assets/kr1-desktop/strings/zh-Hans.lua',
      portrait: '_assets/kr1-desktop/images/fullhd/hero_room.lua',
    },
  }
}

function normalizeTower(
  rawTower,
  localization,
  unlock,
  source,
  supportIds,
  encyclopediaOrder,
  sourceIndex,
) {
  const localized = localizeTower(localization, rawTower.id)
  rawTower.localized = localized
  const info = rawTower.computed_info || {}
  const attacks = rawTower.template?.attacks?.list || []
  const firstAttack = attacks[0] || {}
  const damageMin = Number.isFinite(info.damage_min) ? info.damage_min : null
  const damageMax = Number.isFinite(info.damage_max) ? info.damage_max : null
  const cooldown = Number.isFinite(info.cooldown) ? info.cooldown : null
  const dps =
    damageMin !== null && damageMax !== null && cooldown > 0
      ? (damageMin + damageMax) / 2 / cooldown
      : null
  const attackRange = Number.isFinite(info.range)
    ? info.range
    : Number.isFinite(rawTower.template?.attacks?.range)
      ? rawTower.template.attacks.range
      : null
  const rallyRange = Number.isFinite(rawTower.template?.barrack?.rally_range)
    ? rawTower.template.barrack.rally_range
    : null
  const canBeBuffed = rawTower.template?.tower?.can_be_mod !== false
  const encyclopediaListed = Boolean(rawTower.encyclopedia)
  const tower = {
    id: rawTower.id,
    name: localized.name,
    description: localized.description,
    families: rawTower.families,
    roles: [],
    image: encyclopediaListed
      ? `/encyclopedia/thumbs/${rawTower.id}.png`
      : `/portraits/${rawTower.id}.png`,
    encyclopediaImage: encyclopediaListed
      ? `/encyclopedia/${rawTower.id}.png`
      : `/portraits/${rawTower.id}.png`,
    encyclopediaOrder,
    encyclopediaListed,
    encyclopediaSprite: rawTower.encyclopedia?.detail_sprite || null,
    encyclopediaThumbSprite: rawTower.encyclopedia?.thumb_sprite || null,
    sourceGame: rawTower.encyclopedia?.from_kr || null,
    portraitSprite: rawTower.template?.info?.portrait || null,
    price: Number.isFinite(rawTower.template?.tower?.price)
      ? rawTower.template.tower.price
      : null,
    level: Number.isFinite(rawTower.template?.tower?.level)
      ? rawTower.template.tower.level
      : null,
    towerType: rawTower.template?.tower?.type || null,
    canBeBuffed,
    unlock,
    attack: {
      damageMin,
      damageMax,
      cooldown,
      dps,
      range: attackRange,
      rallyRange,
      damageType: formatDamageType(info.damage_type),
      damageTypeValue: Number.isFinite(info.damage_type) ? info.damage_type : null,
      kind: firstAttack.type || (rawTower.families.includes('barrack') ? 'soldier' : 'custom'),
      confidence: damageMin !== null ? '精确' : '不可统一折算',
      scope: rawTower.families.includes('barrack') ? '单个驻防单位' : '单目标基础攻击',
    },
    soldier: rawTower.families.includes('barrack')
      ? {
          count: Number.isFinite(rawTower.template?.barrack?.max_soldiers)
            ? rawTower.template.barrack.max_soldiers
            : null,
          hp: Number.isFinite(info.hp_max) ? info.hp_max : null,
          armor: Number.isFinite(info.armor) ? info.armor : null,
          magicArmor: Number.isFinite(info.magic_armor) ? info.magic_armor : null,
          respawn: Number.isFinite(info.respawn) ? info.respawn : null,
        }
      : null,
    powers: localizePowers(
      localization,
      rawTower.id,
      rawTower.template?.powers,
      rawTower.power_icons,
    ),
    sources: {
      template: source || null,
      nameKey: localized.nameKey,
      descriptionKey: localized.descriptionKey,
      localization: '_assets/kr1-desktop/strings/zh-Hans.lua',
      portrait: '_assets/kr1-desktop/images/fullhd/gui_portraits.lua',
      encyclopedia: encyclopediaListed
        ? 'kr1-desktop/data/map_data.lua + encyclopedia.lua + encyclopedia_creeps.lua'
        : null,
      unlock: unlock.source,
    },
  }


  for (const power of tower.powers) {
    power.levels = buildPowerLevels(power, rawTower.template.powers[power.id], rawTower.resolved_descriptions)
    power.descriptions = power.descriptions.map((description) => ({
      ...description,
      text: rawTower.resolved_descriptions?.[description.key]?.text || description.text,
    }))
  }
  tower.units = buildTowerUnits(rawTower, tower.powers, localization, sourceIndex, formatDamageType)

  return tower
}

async function main() {
  const transaction = await beginSync(projectRoot)
  try { await sync(transaction) } finally { await transaction.close() }
}

function reviewManifest(review) {
  return { ...review.manifest, invalidFiles: [...review.files].filter(([, source]) => !source.valid).map(([file]) => file) }
}

async function finishSnapshot(transaction, data, changelog, manifest, previous, checkOnly, heroesOnly) {
  const contract = JSON.parse(await readFile(join(projectRoot, 'src/data-contract.json'), 'utf8'))
  const problems = (data.validation.enemyMissingStats || []).filter((item) => !item.expected)
  const errors = data.validation.enemyInfoErrors || []
  if (!heroesOnly) {
    if (problems.length) data.validation.warnings.push(`${problems.length} 项敌人难度字段缺失，原因见校验清单。`)
    if (errors.length) data.validation.warnings.push(`${errors.length} 次敌人百科计算失败，已保留错误与可用模板字段。`)
  }
  validateSnapshot(data, manifest, contract)
  const assetCount = await validateAssets(data, transaction.stageRoot, heroesOnly ? projectRoot : undefined)
  const changes = {}
  for (const key of ['towers', 'heroes', 'enemies']) {
    const id = (item) => key === 'enemies' ? item.entryId : item.id
    const before = new Map((previous?.[key] || []).map((item) => [id(item), item]))
    const after = new Map(data[key].map((item) => [id(item), item]))
    if (previous && after.size < before.size * 0.8 && !process.argv.includes('--allow-count-drop')) throw new Error(`${key} 数量下降超过 20%；请检查提取结果，确认后可使用 --allow-count-drop。`)
    changes[key] = {
      added: [...after.keys()].filter((key) => !before.has(key)),
      removed: [...before.keys()].filter((key) => !after.has(key)),
      changed: [...after.keys()].filter((key) => before.has(key) && JSON.stringify(before.get(key)) !== JSON.stringify(after.get(key))),
    }
  }
  const report = {
    checkOnly, gameVersion: data.metadata.gameVersion, gameCommit: data.metadata.commitHash,
    assetCount, changes, validation: data.validation,
    pending: { towers: data.towers.flatMap((tower) => tower.mechanics.pending), heroes: data.heroes.flatMap((hero) => hero.details.pending) },
  }
  await writeFile(join(rawDir, 'sync-report.json'), `${JSON.stringify(report, null, 2)}\n`)
  const dataText = `${JSON.stringify(data, null, 2)}\n`
  manifest.dataHash = snapshotHash(dataText)
  await writeFile(join(transaction.stageRoot, 'src/data/dove-data.json'), dataText)
  await writeFile(join(transaction.stageRoot, 'src/data/snapshot-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  if (changelog) await writeFile(join(transaction.stageRoot, 'src/data/game-changelog.json'), `${JSON.stringify(changelog, null, 2)}\n`)
  if (!checkOnly) await transaction.promote(heroesOnly
    ? ['public/heroes', 'src/data/dove-data.json', 'src/data/snapshot-manifest.json']
    : generatedPaths)
  console.log(`[dove-wiki] ${checkOnly ? '检查通过，正式快照未修改' : '完整快照已发布'}；${assetCount} 个资源引用有效。差异报告：tools/.tmp/sync-report.json`)
}

async function sync(transaction) {
  const checkOnly = process.argv.includes('--check') || process.argv.includes('--dry-run')
  const runId = randomUUID()
  const stageRoot = transaction.stageRoot
  rawPath = join(transaction.tempRoot, 'dove-raw.json')
  portraitDir = join(stageRoot, 'public/portraits')
  encyclopediaDir = join(stageRoot, 'public/encyclopedia')
  encyclopediaThumbDir = join(encyclopediaDir, 'thumbs')
  skillIconDir = join(stageRoot, 'public/skills')
  heroDir = join(stageRoot, 'public/heroes')
  heroThumbDir = join(heroDir, 'thumbs')
  enemyDir = join(stageRoot, 'public/enemies')
  enemyThumbDir = join(enemyDir, 'thumbs')
  technologyDir = join(stageRoot, 'public/technologies')
  damageIconDir = join(stageRoot, 'public/damage-types')
  await mkdir(join(stageRoot, 'src/data'), { recursive: true })
  const heroesOnly = process.argv.includes('--heroes-only')
  const paths = resolveDovePaths({
    gameDir: readOption('--game-dir') || process.env.DOVE_GAME_DIR,
    loveExe: readOption('--love-exe') || process.env.LOVE_EXE,
    defaultGameDirs,
  })
  gameDir = paths.gameDir
  loveExe = paths.loveExe
  const previousData = existsSync(dataPath)
    ? JSON.parse(await readFile(dataPath, 'utf8'))
    : null
  const previousChangelog = existsSync(changelogPath)
    ? JSON.parse(await readFile(changelogPath, 'utf8'))
    : null
  if (heroesOnly && !previousData) throw new Error('仅更新英雄需要已有的完整站点快照。')

  await mkdir(rawDir, { recursive: true })
  await mkdir(dataDir, { recursive: true })
  await mkdir(portraitDir, { recursive: true })
  await mkdir(encyclopediaThumbDir, { recursive: true })
  await mkdir(skillIconDir, { recursive: true })
  await mkdir(heroThumbDir, { recursive: true })
  await mkdir(enemyThumbDir, { recursive: true })
  await mkdir(damageIconDir, { recursive: true })
  for (let treeId = 1; treeId <= 4; treeId += 1) {
    await mkdir(join(technologyDir, String(treeId)), { recursive: true })
  }

  console.log(`[dove-wiki] 读取游戏：${gameDir}`)
  console.log(`[dove-wiki] LÖVE 运行时：${loveExe}`)
  const extractionCommit = (await readFile(join(gameDir, 'current_version_commit_hash.txt'), 'utf8')).trim()
  if (existsSync(errorPath)) await unlink(errorPath)
  run(loveExe, [join(toolsDir, 'love-extractor')], {
    cwd: dirname(loveExe),
    errorPath,
    env: {
      ...process.env,
      DOVE_GAME_DIR: gameDir,
      DOVE_RUN_ID: runId,
      DOVE_RAW_OUTPUT: rawPath,
      DOVE_ERROR_OUTPUT: errorPath,
      DOVE_PORTRAIT_DIR: heroesOnly ? '' : portraitDir,
      DOVE_ENCYCLOPEDIA_DIR: heroesOnly ? '' : encyclopediaDir,
      DOVE_SKILL_ICON_DIR: heroesOnly ? '' : skillIconDir,
      DOVE_HERO_DIR: heroDir,
      DOVE_ENEMY_DIR: heroesOnly ? '' : enemyDir,
      DOVE_TECHNOLOGY_DIR: heroesOnly ? '' : technologyDir,
      DOVE_DAMAGE_ICON_DIR: heroesOnly ? '' : damageIconDir,
    },
  })

  const raw = JSON.parse(await readFile(rawPath, 'utf8'))
  if ((await readFile(join(gameDir, 'current_version_commit_hash.txt'), 'utf8')).trim() !== extractionCommit) throw new Error('提取期间游戏版本发生变化，请重新同步。')
  validateRaw(raw, runId)
  await writeFile(join(rawDir, 'dove-raw.json'), JSON.stringify(raw))
  if (heroesOnly) {
    const review = await loadHeroReview(gameDir)
    const heroes = raw.heroes.map((hero) => ({ ...normalizeHero(hero, raw.localization), details: buildHeroDetails(hero, review) }))
    const versionSource = await readFile(join(gameDir, 'version.lua'), 'utf8')
    const snapshot = {
      gameVersion: /^\s*id\s*=\s*["']([^"']+)/m.exec(versionSource)?.[1] || 'unknown',
      commitHash: (await readFile(join(gameDir, 'current_version_commit_hash.txt'), 'utf8')).trim(),
      generatedAt: new Date().toISOString(), sourceRoot: gameDir,
    }
    const data = mergeHeroSnapshot(previousData, heroes, snapshot)
    const manifest = JSON.parse(await readFile(join(dataDir, 'snapshot-manifest.json'), 'utf8'))
    manifest.reviews.heroes = reviewManifest(review)
    await finishSnapshot(transaction, data, null, manifest, previousData, checkOnly, true)
    console.log(`[dove-wiki] 已更新 ${heroes.length} 位英雄（${snapshot.gameVersion}）；其余数据与更新历史保持原快照。`)
    return
  }
  const towerIds = raw.towers.map((tower) => tower.id)
  const unlocks = await buildUnlockIndex(towerIds)
  const sourceIndex = await buildTemplateSourceIndex()
  const mechanicReview = await loadMechanicReview(gameDir)
  const supportReview = await loadSupportReview(gameDir)
  const supportEffects = buildSupportEffects(raw, supportReview)
  const supportIds = new Map()

  for (const effect of supportEffects) {
    if (effect.sourceType !== 'tower') continue
    if (!supportIds.has(effect.sourceTowerId)) supportIds.set(effect.sourceTowerId, [])
    supportIds.get(effect.sourceTowerId).push(effect)
  }

  const encyclopediaCount = raw.towers.filter((tower) => tower.encyclopedia).length
  let fallbackOrder = encyclopediaCount
  const towers = raw.towers
    .map((tower) =>
      normalizeTower(
        tower,
        raw.localization,
        unlocks.get(tower.id),
        sourceIndex.get(tower.id),
        supportIds,
        tower.encyclopedia?.order || ++fallbackOrder,
        sourceIndex,
      ),
    )
    .sort((a, b) => a.encyclopediaOrder - b.encyclopediaOrder)

  for (const tower of towers) {
    const rawTower = raw.towers.find((item) => item.id === tower.id)
    tower.mechanics = buildTowerMechanics(rawTower, tower, mechanicReview)
    Object.assign(tower, inferTowerRoles(rawTower, tower, supportIds))
    if (tower.id === 'tower_shaolin') tower.attack.scope = '单名僧众的一次攻击'
    if (tower.mechanics.items.some((item) => item.id === 'wizard-double-bolt')) tower.attack.scope = '单枚普攻弹丸参数（每轮两枚）'
    if (tower.mechanics.items.some((item) => item.id === 'culverine-splash')) tower.attack.scope = '普攻落点范围内的单个目标'
  }

  const versionSource = await readFile(join(gameDir, 'version.lua'), 'utf8')
  const commitHash = (
    await readFile(join(gameDir, 'current_version_commit_hash.txt'), 'utf8')
  ).trim()
  const missingUnlocks = towers.filter((tower) => tower.unlock.status === 'missing')
  const missingDamage = towers.filter((tower) => tower.attack.damageMin === null)
  const missingSources = towers.filter((tower) => !tower.sources.template)
  const supportTowerCount = new Set(
    supportEffects
      .filter((effect) => effect.sourceType === 'tower')
      .map((effect) => effect.sourceTowerId),
  ).size
  const supportHeroCount = new Set(
    supportEffects
      .filter((effect) => effect.sourceType === 'hero')
      .map((effect) => effect.sourceHeroId),
  ).size
  const skillIconCount = towers.flatMap((tower) => tower.powers).filter((power) => power.icon).length
  const technologyTrees = buildTechnologyTrees(raw.technology, raw.localization)
  const technologyCount = technologyTrees.reduce(
    (total, tree) => total + tree.technologies.length,
    0,
  )
  const heroReview = await loadHeroReview(gameDir)
  const heroes = raw.heroes.map((hero) => ({
    ...normalizeHero(hero, raw.localization),
    details: buildHeroDetails(hero, heroReview),
  }))
  const enemies = raw.enemies.map((enemy) => normalizeEnemy(enemy, raw.localization))
  const uniqueEnemyCount = new Set(enemies.map((enemy) => enemy.id)).size
  const normalizedSupportEffects = supportEffects.map((effect) => ({
    ...effect,
    icon:
      effect.sourceType === 'hero'
        ? `/heroes/thumbs/${effect.sourceHeroId}.png`
        : null,
  }))
  const contentVersion = /string_short\s*=\s*["']([^"']+)/.exec(versionSource)?.[1] || 'unknown'
  const gameVersion = /^\s*id\s*=\s*["']([^"']+)/m.exec(versionSource)?.[1] || 'unknown'
  const gameId = /^\s*identity\s*=\s*["']([^"']+)/m.exec(versionSource)?.[1] || 'unknown'
  const data = {
    schemaVersion: 2,
    calculationRules: await loadCalculationRules(gameDir),
    metadata: {
      title: '王国保卫战鸽子版 WIKI',
      gameVersion,
      contentVersion,
      gameId,
      commitHash,
      generatedAt: new Date().toISOString(),
      sourceRoot: gameDir,
      heroSnapshot: { gameVersion, commitHash, generatedAt: new Date().toISOString(), sourceRoot: gameDir },
      assumptions: [
        '科技树可在辅助计算中选择；条件触发、概率与特殊目标效果不强行折算进基础面板。',
        '英雄增益按游戏脚本的峰值生效状态计算；持续时间、冷却和触发条件单独标注。',
        '基础 DPS 是单目标理论值；范围伤害、召唤物与技能效果单独理解。',
        '兵营塔的增距结果表示集结范围。',
      ],
    },
    summary: {
      towerCount: towers.length,
      portraitCount: raw.towers.filter((tower) => tower.portrait_atlas).length,
      encyclopediaImageCount: encyclopediaCount,
      portraitFallbackCount: towers.length - encyclopediaCount,
      skillIconCount,
      technologyTreeCount: technologyTrees.length,
      technologyCount,
      heroCount: heroes.length,
      enemyCount: enemies.length,
      uniqueEnemyCount,
      enemyImageCount: new Set(
        raw.enemies.filter((enemy) => enemy.encyclopedia).map((enemy) => enemy.id),
      ).size,
      supportTowerCount,
      supportHeroCount,
      supportEffectCount: normalizedSupportEffects.length,
      levelUnlockCount: towers.filter((tower) => tower.unlock.status === 'level').length,
      defaultUnlockCount: towers.filter((tower) => tower.unlock.status === 'default').length,
      unlockAnomalyCount: missingUnlocks.length,
      exactDamageCount: towers.filter((tower) => tower.attack.damageMin !== null).length,
    },
    validation: {
      warnings: [
        missingUnlocks.length
          ? `${missingUnlocks.length} 座初始锁定塔没有关卡解锁记录。`
          : null,
        missingDamage.length
          ? `${missingDamage.length} 座塔没有可统一折算的基础伤害。`
          : null,
        missingSources.length
          ? `${missingSources.length} 座塔没有定位到静态模板定义文件。`
          : null,
      ].filter(Boolean),
      unlockAnomalies: missingUnlocks.map((tower) => tower.id),
      noUnifiedDamage: missingDamage.map((tower) => tower.id),
      missingTemplateSources: missingSources.map((tower) => tower.id),
      ...enemyValidation(enemies),
    },
    supportEffects: normalizedSupportEffects,
    technologyTrees,
    heroes,
    enemies,
    towers,
  }

  const nextChangelog = updateGameChangelog(previousData, data, previousChangelog)
  const manifest = {
    schemaVersion: data.schemaVersion, gameCommit: commitHash,
    reviews: { towers: reviewManifest(mechanicReview), heroes: reviewManifest(heroReview), supports: supportReview.manifest },
  }
  await finishSnapshot(transaction, data, nextChangelog, manifest, previousData, checkOnly, false)
  const dataSize = await stat(join(stageRoot, 'src/data/dove-data.json')).catch(() => stat(dataPath))
  console.log(
    `[dove-wiki] 完成：${towers.length} 座塔、${heroes.length} 名英雄、${enemies.length} 个敌人百科槽位（${uniqueEnemyCount} 个唯一敌人）、${technologyCount} 张科技图标、${encyclopediaCount} 套塔百科图、${skillIconCount} 张技能图标、${towers.length - encyclopediaCount} 张头像回退、${Math.round(dataSize.size / 1024)} KiB 数据`,
  )
  console.log(`[dove-wiki] 解锁异常：${missingUnlocks.length}；不可统一折算伤害：${missingDamage.length}`)
}

main().catch((error) => {
  console.error(`[dove-wiki] 同步失败：${error.message}`)
  process.exitCode = 1
})
