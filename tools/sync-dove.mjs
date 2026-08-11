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
const portraitDir = join(projectRoot, 'public', 'portraits')
const encyclopediaDir = join(projectRoot, 'public', 'encyclopedia')
const encyclopediaThumbDir = join(encyclopediaDir, 'thumbs')
const skillIconDir = join(projectRoot, 'public', 'skills')

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

function findTableBody(source, fieldName) {
  const startMatch = new RegExp(`${fieldName}\\s*=\\s*\\{`).exec(source)
  if (!startMatch) return ''

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
      if (depth === 0) return source.slice(start, index)
    }
  }

  return ''
}

async function buildUnlockIndex(towerIds) {
  const slotPath = join(gameDir, 'kr1', 'data', 'slot_template.lua')
  const slotSource = await readFile(slotPath, 'utf8')
  const locked = new Set(quotedValues(findTableBody(slotSource, 'locked_towers')))
  const levelDir = join(gameDir, 'kr1', 'data', 'levels')
  const levelEntries = await readdir(levelDir)
  const unlockLevels = new Map()

  for (const filename of levelEntries) {
    const match = /^level(\d+)_data\.lua$/.exec(filename)
    if (!match) continue
    const source = await readFile(join(levelDir, filename), 'utf8')
    const body = findTableBody(source, 'unlock_towers')
    if (!body) continue

    for (const towerId of quotedValues(body)) {
      const level = Number(match[1])
      if (!unlockLevels.has(towerId) || level < unlockLevels.get(towerId)) {
        unlockLevels.set(towerId, level)
      }
    }
  }

  return new Map(
    towerIds.map((towerId) => {
      if (unlockLevels.has(towerId)) {
        const level = unlockLevels.get(towerId)
        return [
          towerId,
          {
            status: 'level',
            level,
            label: `第 ${level} 关开始可用，通关后永久解锁`,
            source: `kr1/data/levels/level${level}_data.lua`,
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
]

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

async function main() {
  assertFile(join(gameDir, 'kr1', 'game_settings.lua'), 'Dove 游戏目录')
  assertFile(loveExe, 'Dove 自带 lovec.exe')
  await mkdir(rawDir, { recursive: true })
  await mkdir(dataDir, { recursive: true })
  await mkdir(portraitDir, { recursive: true })
  await mkdir(encyclopediaThumbDir, { recursive: true })
  await mkdir(skillIconDir, { recursive: true })

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
    },
  })

  const raw = JSON.parse(await readFile(rawPath, 'utf8'))
  const towerIds = raw.towers.map((tower) => tower.id)
  const unlocks = await buildUnlockIndex(towerIds)
  const sourceIndex = await buildTemplateSourceIndex()
  const supportIds = new Map()

  for (const effect of supportEffects) {
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

  const versionSource = await readFile(join(gameDir, 'version.lua'), 'utf8')
  const commitHash = (
    await readFile(join(gameDir, 'current_version_commit_hash.txt'), 'utf8')
  ).trim()
  const gameVersion = /string_short\s*=\s*["']([^"']+)/.exec(versionSource)?.[1] || 'unknown'
  const gameId = /^\s*id\s*=\s*["']([^"']+)/m.exec(versionSource)?.[1] || 'unknown'
  const missingUnlocks = towers.filter((tower) => tower.unlock.status === 'missing')
  const missingDamage = towers.filter((tower) => tower.attack.damageMin === null)
  const missingSources = towers.filter((tower) => !tower.sources.template)
  const supportTowerCount = new Set(supportEffects.map((effect) => effect.sourceTowerId)).size
  const skillIconCount = towers.flatMap((tower) => tower.powers).filter((power) => power.icon).length
  const data = {
    metadata: {
      title: 'Dove 防御塔 Wiki',
      gameVersion,
      gameId,
      commitHash,
      generatedAt: new Date().toISOString(),
      sourceRoot: gameDir,
      assumptions: [
        '不计算星级科技、英雄、地图环境与外部配置修改。',
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
      supportTowerCount,
      supportEffectCount: supportEffects.length,
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
    supportEffects,
    towers,
  }

  await writeFile(dataPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
  const dataSize = await stat(dataPath)
  console.log(
    `[dove-wiki] 完成：${towers.length} 座塔、${encyclopediaCount} 套百科图、${skillIconCount} 张技能图标、${towers.length - encyclopediaCount} 张头像回退、${Math.round(dataSize.size / 1024)} KiB 数据`,
  )
  console.log(`[dove-wiki] 解锁异常：${missingUnlocks.length}；不可统一折算伤害：${missingDamage.length}`)
}

main().catch((error) => {
  console.error(`[dove-wiki] 同步失败：${error.message}`)
  process.exitCode = 1
})
