import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import {
  mkdir,
  readFile,
  readdir,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { updateGameChangelog } from './game-changelog.mjs'

const toolsDir = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(toolsDir, '..')
const defaultGameDir = 'D:\\KingdomRushDove-Windows-Cycle2-v0.1.5\\KingdomRushDove'

function readOption(name) {
  const index = process.argv.indexOf(name)
  return index >= 0 ? process.argv[index + 1] : undefined
}

const gameDir = resolve(
  readOption('--game-dir') || process.env.DOVE_GAME_DIR || defaultGameDir,
)
const loveExe = resolve(
  readOption('--love-exe') || process.env.LOVE_EXE || join(gameDir, '..', 'lovec.exe'),
)
const rawDir = join(toolsDir, '.tmp')
const rawPath = join(rawDir, 'dove-raw.json')
const dataDir = join(projectRoot, 'src', 'data')
const dataPath = join(dataDir, 'dove-data.json')
const changelogPath = join(dataDir, 'game-changelog.json')
const portraitDir = join(projectRoot, 'public', 'portraits')
const encyclopediaDir = join(projectRoot, 'public', 'encyclopedia')
const encyclopediaThumbDir = join(encyclopediaDir, 'thumbs')
const skillIconDir = join(projectRoot, 'public', 'skills')
const heroDir = join(projectRoot, 'public', 'heroes')
const heroThumbDir = join(heroDir, 'thumbs')
const enemyDir = join(projectRoot, 'public', 'enemies')
const enemyThumbDir = join(enemyDir, 'thumbs')
const technologyDir = join(projectRoot, 'public', 'technologies')

function assertFile(path, label) {
  if (!existsSync(path)) {
    throw new Error(`${label}不存在：${path}`)
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || projectRoot,
    encoding: 'utf8',
    env: options.env || process.env,
    stdio: options.quiet ? 'pipe' : 'inherit',
    windowsHide: true,
  })

  if (result.status !== 0) {
    const details = options.quiet ? `\n${result.stderr || result.stdout || ''}` : ''
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
    for (const match of source.matchAll(/(?:\bRT|\bE:register_t)\s*\(\s*["'](tower_[a-zA-Z0-9_]+)["']/g)) {
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
        bases.some((base) => key.startsWith(`${base}_`)) && key.includes(powerToken),
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

function hasPositiveKey(value, keyPattern, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false
  seen.add(value)

  return Object.entries(value).some(([key, child]) => {
    if (keyPattern.test(key) && typeof child === 'number' && child > 0) return true
    return hasPositiveKey(child, keyPattern, seen)
  })
}

const supportEffects = [
  {
    id: 'crossbow-eagle',
    sourceType: 'tower',
    sourceTowerId: 'tower_crossbow',
    skillId: 'eagle',
    name: '驯鹰者',
    mode: 'aura',
    levels: [
      { level: 1, radius: 170, rangeBonus: 0.05, speedBonus: 0.15 },
      { level: 2, radius: 210, rangeBonus: 0.075, speedBonus: 0.2 },
      { level: 3, radius: 250, rangeBonus: 0.1, speedBonus: 0.25 },
    ],
    note: '范围倍率与其他增距来源相乘；攻速加成加入攻速除数。',
  },
  {
    id: 'pirate-watcher',
    sourceType: 'tower',
    sourceTowerId: 'tower_pirate_watchtower',
    skillId: 'watcher',
    name: '眺望',
    mode: 'aura',
    levels: [
      { level: 1, radius: 250, rangeBonus: 0.1 },
      { level: 2, radius: 250, rangeBonus: 0.2 },
      { level: 3, radius: 250, rangeBonus: 0.3 },
    ],
    note: '只改变攻击范围；对兵营塔显示为集结范围。',
  },
  {
    id: 'high-elven-sentinel',
    sourceType: 'tower',
    sourceTowerId: 'tower_high_elven',
    skillId: 'sentinel',
    name: '元素赐福',
    mode: 'aura',
    levels: [
      { level: 1, radius: 180, damageBonus: 0.135, speedBonus: 0.09 },
      { level: 2, radius: 240, damageBonus: 0.18, speedBonus: 0.12 },
      { level: 3, radius: 300, damageBonus: 0.225, speedBonus: 0.15 },
    ],
    note: '伤害百分比与其他增伤来源相加。',
  },
  {
    id: 'arcane-empowerment',
    sourceType: 'tower',
    sourceTowerId: 'tower_arcane_wizard_lvl4',
    skillId: 'empowerment',
    name: '强化光环',
    mode: 'aura',
    levels: [
      { level: 1, radius: 240, damageBonus: 0.15 },
      { level: 2, radius: 240, damageBonus: 0.25 },
      { level: 3, radius: 240, damageBonus: 0.4 },
    ],
    note: '同种强化光环取有效最高等级。',
  },
  {
    id: 'furnace-heat',
    sourceType: 'tower',
    sourceTowerId: 'tower_melting_furnace',
    skillId: 'heat',
    name: '摩擦生热',
    mode: 'aura',
    levels: [
      { level: 1, radius: 291.5, damageBonus: 0.15 },
      { level: 2, radius: 291.5, damageBonus: 0.3 },
    ],
    note: '常驻增伤光环。',
  },
  {
    id: 'furnace-fuel',
    sourceType: 'tower',
    sourceTowerId: 'tower_melting_furnace',
    skillId: 'fuel',
    name: '燃料爆燃',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 291.5, speedBonus: 0.5, duration: 10, cycle: 30 },
    ],
    note: '每 30 秒触发、持续 10 秒；结果显示生效期间的峰值。',
  },
  {
    id: 'dark-elf-hunt',
    sourceType: 'tower',
    sourceTowerId: 'tower_dark_elf_lvl4',
    skillId: 'skill_buff',
    name: '猎杀戾气',
    mode: 'triggered',
    levels: [
      { level: 1, radius: 225, damagePerTrigger: 0.008, triggerCap: 20 },
      { level: 2, radius: 225, damagePerTrigger: 0.008, triggerCap: 50 },
      { level: 3, radius: 225, damagePerTrigger: 0.008, triggerCap: 999999 },
    ],
    note: '每次击杀随机选择范围内一座塔；计算值是目标获得指定次数后的潜在增伤。',
  },
  {
    id: 'denas-resource-management',
    sourceType: 'hero',
    sourceHeroId: 'hero_denas',
    skillId: 'resource_management',
    name: '资源调配',
    mode: 'passive',
    requiresBuffable: false,
    levels: [{ level: 1, radius: 0, priceMultiplier: 0.95 }],
    note: '迪纳斯登场时将所有塔模板价格乘以 0.95 并向下取整；不受 tower.can_be_mod 限制。',
  },
  {
    id: 'denas-tower-buff',
    sourceType: 'hero',
    sourceHeroId: 'hero_denas',
    skillId: 'tower_buff',
    name: '皇家号令',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 200, rangeBonus: 0.25, cooldownMultiplier: 0.75, duration: 5, cycle: 11.7 },
      { level: 2, radius: 200, rangeBonus: 0.25, cooldownMultiplier: 0.75, duration: 8, cycle: 11.7 },
      { level: 3, radius: 200, rangeBonus: 0.25, cooldownMultiplier: 0.75, duration: 11, cycle: 11.7 },
    ],
    note: '范围乘以 1.25，冷却缩放系数为 0.75；显示技能生效期间的峰值。',
  },
  {
    id: 'priest-consecrate',
    sourceType: 'hero',
    sourceHeroId: 'hero_priest',
    skillId: 'consecrate',
    name: '神圣祝颂',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 160, damageBonus: 0.18, duration: 8, cycle: 8 },
      { level: 2, radius: 160, damageBonus: 0.24, duration: 15, cycle: 8 },
      { level: 3, radius: 160, damageBonus: 0.3, duration: 22, cycle: 8 },
    ],
    note: '每次选择范围内最近的一座未祝颂塔；伤害加成同时传递给兵营士兵。',
  },
  {
    id: 'minotaur-roar-of-fury',
    sourceType: 'hero',
    sourceHeroId: 'hero_minotaur',
    skillId: 'roaroffury',
    name: '野牛怒吼',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 0, damageBonus: 0.25, duration: 4, cycle: 15 },
      { level: 2, radius: 0, damageBonus: 0.5, duration: 4, cycle: 15 },
      { level: 3, radius: 0, damageBonus: 0.75, duration: 4, cycle: 15 },
    ],
    note: '对全场所有可被强化且未封锁的塔生效，显示 4 秒持续期内的峰值。',
  },
  {
    id: 'phoenix-flaming-path',
    sourceType: 'hero',
    sourceHeroId: 'hero_phoenix',
    skillId: 'flaming_path',
    name: '余烬之地',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 125, flatDps: 15, duration: 6.5, cycle: 30 },
      { level: 2, radius: 125, flatDps: 30, duration: 6.5, cycle: 30 },
      { level: 3, radius: 125, flatDps: 45, duration: 6.5, cycle: 30 },
    ],
    note: '附着到附近一座塔，每 2 秒造成 30/60/90 点范围真实伤害；额外 DPS 按持续期峰值计入。',
  },
  {
    id: 'space-elf-spatial-distortion',
    sourceType: 'hero',
    sourceHeroId: 'hero_space_elf',
    skillId: 'spatial_distortion',
    name: '空间扭曲',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 0, damageBonus: 0.04, rangeBonus: 0.04, cooldownMultiplier: 0.96, duration: 6, cycle: 25 },
      { level: 2, radius: 0, damageBonus: 0.06, rangeBonus: 0.06, cooldownMultiplier: 0.94, duration: 7, cycle: 23 },
      { level: 3, radius: 0, damageBonus: 0.08, rangeBonus: 0.08, cooldownMultiplier: 0.92, duration: 8, cycle: 20 },
    ],
    note: '对全场所有可强化塔同时生效；冷却缩放系数分别为 0.96/0.94/0.92。',
  },
  {
    id: 'lava-hotheaded',
    sourceType: 'hero',
    sourceHeroId: 'hero_lava',
    skillId: 'hotheaded',
    name: '烈焰之心',
    mode: 'triggered',
    levels: [
      { level: 1, radius: 180, damageBonus: 0.2, duration: 6 },
      { level: 2, radius: 180, damageBonus: 0.3, duration: 6 },
      { level: 3, radius: 180, damageBonus: 0.4, duration: 6 },
    ],
    note: '喀拉托复活时强化周围塔 6 秒；结果显示触发后的峰值。',
  },
  {
    id: 'oloch-hellish-infusion',
    sourceType: 'hero',
    sourceHeroId: 'hero_oloch',
    skillId: 'hellish_infusion',
    name: '地狱注入',
    mode: 'temporary',
    levels: [
      { level: 1, radius: 170, damageBonus: 0.1, duration: 6, cycle: 18 },
      { level: 2, radius: 170, damageBonus: 0.2, duration: 6, cycle: 18 },
      { level: 3, radius: 170, damageBonus: 0.3, duration: 6, cycle: 18 },
    ],
    note: '强化椭圆范围内全部可强化塔；显示 6 秒持续期内的峰值。',
  },
]

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

function normalizeEnemy(rawEnemy, localization) {
  const i18nKey = rawEnemy.template?.info?.i18n_key || rawEnemy.id.toUpperCase()
  const specialKey = `${rawEnemy.id.toUpperCase()}_SPECIAL`
  const extraText = localization[`${i18nKey}_EXTRA`] || ''
  const info = rawEnemy.computed_info || {}
  const boss = /(^|_)(eb|boss|miniboss)(_|$)/i.test(rawEnemy.id) ||
    rawEnemy.id.startsWith('controller_')

  return {
    entryId: `${rawEnemy.id}--${rawEnemy.order}`,
    id: rawEnemy.id,
    order: Number(rawEnemy.order),
    name: localization[`${i18nKey}_NAME`] || rawEnemy.id.replaceAll('_', ' '),
    description:
      localization[`${i18nKey}_DESCRIPTION`] || '游戏百科未提供中文描述。',
    special: localization[specialKey] || '',
    traits: extraText
      .split(/\r?\n/)
      .map((item) => item.replace(/^\s*[-•]\s*/, '').trim())
      .filter(Boolean),
    image: `/enemies/${rawEnemy.id}.png`,
    thumbnail: `/enemies/thumbs/${rawEnemy.id}.png`,
    imageSprite: rawEnemy.encyclopedia?.detail_sprite || null,
    thumbnailSprite: rawEnemy.encyclopedia?.thumb_sprite || null,
    sourceGame: Number(rawEnemy.source_game),
    alwaysShown: rawEnemy.always_shown === true,
    flying: rawEnemy.is_flying === true,
    boss,
    stats: {
      hp: Number.isFinite(info.hp_max) ? info.hp_max : null,
      damageMin: Number.isFinite(info.damage_min) ? info.damage_min : null,
      damageMax: Number.isFinite(info.damage_max) ? info.damage_max : null,
      armor: Number.isFinite(info.armor) ? info.armor : null,
      magicArmor: Number.isFinite(info.magic_armor) ? info.magic_armor : null,
      speed: Number.isFinite(rawEnemy.template?.motion?.max_speed)
        ? rawEnemy.template.motion.max_speed
        : null,
      lives: Number.isFinite(info.lives)
        ? info.lives
        : Number.isFinite(rawEnemy.template?.enemy?.lives_cost)
          ? rawEnemy.template.enemy.lives_cost
          : null,
      gold: Number.isFinite(rawEnemy.template?.enemy?.gold)
        ? rawEnemy.template.enemy.gold
        : null,
    },
    sources: {
      roster: 'kr1/game_settings.lua → encyclopedia_enemies',
      template: rawEnemy.template_exists ? '游戏实体模板 + info.fn' : null,
      localization: '_assets/kr1-desktop/strings/zh-Hans.lua',
      encyclopedia:
        '_assets/kr1-desktop/images/fullhd/encyclopedia.lua + encyclopedia_creeps.lua',
    },
  }
}

function inferRoles(tower, supportIds) {
  const roles = []
  const info = tower.computed_info || {}
  const searchText = JSON.stringify({
    id: tower.id,
    description: tower.localized.description,
    powers: tower.template?.powers,
    references: Object.keys(tower.references || {}),
  }).toLowerCase()

  if (Number.isFinite(info.damage_min)) roles.push('直接输出')
  if (
    hasPositiveKey(tower.references, /damage_radius/i) ||
    /explosion|bomb|blast|overcharge|area_attack|灼热|爆炸/.test(searchText)
  ) {
    roles.push('范围伤害')
  }
  if (/poison|burn|bleed|ignite|acid|岩浆|中毒|燃烧/.test(searchText)) {
    roles.push('持续伤害')
  }
  if (/slow|stun|teleport|thorn|root|freeze|silence|twister|polymorph|晕|减速|传送|缠绕/.test(searchText)) {
    roles.push('控制')
  }
  if (tower.families.includes('barrack') || /summon|spawn|召唤/.test(searchText)) {
    roles.push('召唤/拦截')
  }
  if (/gold|money|income|pickpocket|steal|loot|金币|赏金/.test(searchText)) {
    roles.push('经济辅助')
  }
  if (/reduce_armor|armor_reduction|curse|weakness|削减.*护甲|破甲/.test(searchText)) {
    roles.push('减益/破甲')
  }

  const effects = supportIds.get(tower.id) || []
  if (effects.some((effect) => effect.levels.some((level) => level.damageBonus || level.damagePerTrigger))) {
    roles.push('增伤辅助')
  }
  if (effects.some((effect) => effect.levels.some((level) => level.rangeBonus))) {
    roles.push('增距辅助')
  }
  if (effects.some((effect) => effect.levels.some((level) => level.speedBonus))) {
    roles.push('攻速辅助')
  }

  const unique = [...new Set(roles)]
  const utilityRoles = new Set([
    '控制',
    '召唤/拦截',
    '经济辅助',
    '减益/破甲',
    '增伤辅助',
    '增距辅助',
    '攻速辅助',
  ])
  if (unique.includes('直接输出') && !unique.some((role) => utilityRoles.has(role))) {
    unique.unshift('纯输出')
  }

  return unique
}

function normalizeTower(
  rawTower,
  localization,
  unlock,
  source,
  supportIds,
  encyclopediaOrder,
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

  tower.roles = inferRoles(rawTower, supportIds)
  return tower
}

async function cleanupPortraits(rawTowers) {
  const expected = new Set(rawTowers.map((tower) => `${tower.id}.png`))
  const resolvedPortraitDir = resolve(portraitDir)

  for (const filename of await readdir(portraitDir)) {
    const fullPath = resolve(portraitDir, filename)
    if (dirname(fullPath) !== resolvedPortraitDir) {
      throw new Error(`拒绝清理非头像目录文件：${fullPath}`)
    }
    if (filename.endsWith('.png') && !expected.has(filename)) await unlink(fullPath)
  }
}

async function cleanupEncyclopediaImages(rawTowers) {
  const expected = new Set(
    rawTowers
      .filter((tower) => tower.encyclopedia)
      .map((tower) => `${tower.id}.png`),
  )

  for (const directory of [encyclopediaDir, encyclopediaThumbDir]) {
    const resolvedDirectory = resolve(directory)
    for (const filename of await readdir(directory)) {
      const fullPath = resolve(directory, filename)
      if (dirname(fullPath) !== resolvedDirectory) continue
      if (filename.endsWith('.png') && !expected.has(filename)) await unlink(fullPath)
    }
  }
}

async function cleanupSkillIcons(rawTowers) {
  const expected = new Set(
    rawTowers.flatMap((tower) =>
      Object.keys(tower.power_icons || {}).map(
        (powerId) => `${tower.id}--${powerId}.png`,
      ),
    ),
  )
  const resolvedDirectory = resolve(skillIconDir)

  for (const filename of await readdir(skillIconDir)) {
    const fullPath = resolve(skillIconDir, filename)
    if (dirname(fullPath) !== resolvedDirectory) continue
    if (filename.endsWith('.png') && !expected.has(filename)) await unlink(fullPath)
  }
}

async function cleanupHeroImages(rawHeroes) {
  const expected = new Set(rawHeroes.map((hero) => `${hero.id}.png`))

  for (const directory of [heroDir, heroThumbDir]) {
    const resolvedDirectory = resolve(directory)
    for (const filename of await readdir(directory)) {
      const fullPath = resolve(directory, filename)
      if (dirname(fullPath) !== resolvedDirectory) continue
      if (filename.endsWith('.png') && !expected.has(filename)) await unlink(fullPath)
    }
  }
}

async function cleanupEnemyImages(rawEnemies) {
  const expected = new Set(
    rawEnemies
      .filter((enemy) => enemy.encyclopedia)
      .map((enemy) => `${enemy.id}.png`),
  )

  for (const directory of [enemyDir, enemyThumbDir]) {
    const resolvedDirectory = resolve(directory)
    for (const filename of await readdir(directory)) {
      const fullPath = resolve(directory, filename)
      if (dirname(fullPath) !== resolvedDirectory) continue
      if (filename.endsWith('.png') && !expected.has(filename)) await unlink(fullPath)
    }
  }
}

async function cleanupTechnologyImages(rawTechnology) {
  for (const [index, technologyList] of (rawTechnology?.lists || []).entries()) {
    const directory = join(technologyDir, String(index + 1))
    const expected = new Set(Object.keys(technologyList).map((id) => `${id}.png`))
    const resolvedDirectory = resolve(directory)

    for (const filename of await readdir(directory)) {
      const fullPath = resolve(directory, filename)
      if (dirname(fullPath) !== resolvedDirectory) continue
      if (filename.endsWith('.png') && !expected.has(filename)) await unlink(fullPath)
    }
  }
}

async function main() {
  assertFile(join(gameDir, 'kr1', 'game_settings.lua'), 'Dove 游戏目录')
  assertFile(loveExe, 'Dove 自带 lovec.exe')
  const previousData = existsSync(dataPath)
    ? JSON.parse(await readFile(dataPath, 'utf8'))
    : null
  const previousChangelog = existsSync(changelogPath)
    ? JSON.parse(await readFile(changelogPath, 'utf8'))
    : null

  await mkdir(rawDir, { recursive: true })
  await mkdir(dataDir, { recursive: true })
  await mkdir(portraitDir, { recursive: true })
  await mkdir(encyclopediaThumbDir, { recursive: true })
  await mkdir(skillIconDir, { recursive: true })
  await mkdir(heroThumbDir, { recursive: true })
  await mkdir(enemyThumbDir, { recursive: true })
  for (let treeId = 1; treeId <= 4; treeId += 1) {
    await mkdir(join(technologyDir, String(treeId)), { recursive: true })
  }

  console.log(`[dove-wiki] 读取游戏：${gameDir}`)
  run(loveExe, [join(toolsDir, 'love-extractor')], {
    cwd: dirname(loveExe),
    env: {
      ...process.env,
      DOVE_GAME_DIR: gameDir,
      DOVE_RAW_OUTPUT: rawPath,
      DOVE_PORTRAIT_DIR: portraitDir,
      DOVE_ENCYCLOPEDIA_DIR: encyclopediaDir,
      DOVE_SKILL_ICON_DIR: skillIconDir,
      DOVE_HERO_DIR: heroDir,
      DOVE_ENEMY_DIR: enemyDir,
      DOVE_TECHNOLOGY_DIR: technologyDir,
    },
  })

  const raw = JSON.parse(await readFile(rawPath, 'utf8'))
  const towerIds = raw.towers.map((tower) => tower.id)
  const unlocks = await buildUnlockIndex(towerIds)
  const sourceIndex = await buildTemplateSourceIndex()
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
      ),
    )
    .sort((a, b) => a.encyclopediaOrder - b.encyclopediaOrder)

  await cleanupPortraits(raw.towers)
  await cleanupEncyclopediaImages(raw.towers)
  await cleanupSkillIcons(raw.towers)
  await cleanupHeroImages(raw.heroes)
  await cleanupEnemyImages(raw.enemies)
  await cleanupTechnologyImages(raw.technology)

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
  const heroes = raw.heroes.map((hero) => normalizeHero(hero, raw.localization))
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
    metadata: {
      title: '王国保卫战鸽子版 WIKI',
      gameVersion,
      contentVersion,
      gameId,
      commitHash,
      generatedAt: new Date().toISOString(),
      sourceRoot: gameDir,
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
    },
    supportEffects: normalizedSupportEffects,
    technologyTrees,
    heroes,
    enemies,
    towers,
  }

  const nextChangelog = updateGameChangelog(previousData, data, previousChangelog)
  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  await writeFile(changelogPath, `${JSON.stringify(nextChangelog, null, 2)}\n`, 'utf8')
  const dataSize = await stat(dataPath)
  console.log(
    `[dove-wiki] 完成：${towers.length} 座塔、${heroes.length} 名英雄、${enemies.length} 个敌人百科槽位（${uniqueEnemyCount} 个唯一敌人）、${technologyCount} 张科技图标、${encyclopediaCount} 套塔百科图、${skillIconCount} 张技能图标、${towers.length - encyclopediaCount} 张头像回退、${Math.round(dataSize.size / 1024)} KiB 数据`,
  )
  console.log(`[dove-wiki] 解锁异常：${missingUnlocks.length}；不可统一折算伤害：${missingDamage.length}`)
}

main().catch((error) => {
  console.error(`[dove-wiki] 同步失败：${error.message}`)
  process.exitCode = 1
})
