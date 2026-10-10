const numeric = (value) => Number.isFinite(value) ? value : null
// These two encounters use the ordinary enemy base rather than the boss base.
const bossExceptions = {
  eb_kingpin: 'kr1/boss.lua → eb_kingpin（关卡首领，20 点生命）',
  enemy_miniboss_stage_39: 'kr1/enemies.lua → enemy_miniboss_stage_39（小首领，20 点生命）',
}

export function enemyStats(raw) {
  const info = raw.computed_info || {}
  const template = raw.template || {}
  const melee = template.melee?.attacks?.find((attack) => !attack.disabled && Number.isFinite(attack.damage_min))
  const ranged = template.ranged?.attacks?.find((attack) => !attack.disabled && Number.isFinite(attack.damage_min))
  const hasMelee = Number.isFinite(info.damage_min) || Boolean(melee)
  const damageScope = hasMelee ? '近战' : Number.isFinite(info.ranged_damage_min) || ranged ? '远程' : '未提供攻击面板'
  const candidates = {
    hp: [info.hp_max, template.health?.hp_max, 'health.hp_max'],
    damageMin: [hasMelee ? info.damage_min : info.ranged_damage_min, hasMelee ? melee?.damage_min : ranged?.damage_min, `${hasMelee ? 'melee' : 'ranged'}.attacks.damage_min`],
    damageMax: [hasMelee ? info.damage_max : info.ranged_damage_max, hasMelee ? melee?.damage_max : ranged?.damage_max, `${hasMelee ? 'melee' : 'ranged'}.attacks.damage_max`],
    armor: [info.armor, template.health?.armor, 'health.armor'],
    magicArmor: [info.magic_armor, template.health?.magic_armor, 'health.magic_armor'],
    speed: [undefined, template.motion?.max_speed, 'motion.max_speed'],
    lives: [info.lives, template.enemy?.lives_cost, 'enemy.lives_cost'],
    gold: [undefined, template.enemy?.gold, 'enemy.gold'],
  }
  const stats = {}
  const fieldSources = {}
  const missingFields = {}
  const notApplicableFields = []
  for (const [field, [computed, fallback, path]] of Object.entries(candidates)) {
    stats[field] = numeric(computed) ?? numeric(fallback)
    fieldSources[field] = Number.isFinite(computed) ? 'info.fn' : Number.isFinite(fallback) ? `template.${path}` : null
    if (stats[field] === null) {
      missingFields[field] = Array.isArray(computed) || Array.isArray(fallback)
        ? '难度数组未展开'
        : raw.computed_info_error ? '百科计算失败，模板未提供可用数值' : '模板未提供可用数值'
      if (!raw.computed_info_error && (
        field.startsWith('damage') && !template.melee && !template.ranged && info.no_ranged === true ||
        field === 'speed' && !template.motion || field === 'gold' && !template.enemy
      )) {
        notApplicableFields.push(field)
        missingFields[field] = field.startsWith('damage') ? '模板没有近战或远程攻击面板' : '控制器未提供此项面板属性'
      }
    }
  }
  return { stats, fieldSources, missingFields, notApplicableFields, damageScope, infoError: raw.computed_info_error || null }
}

export function normalizeEnemy(raw, localization) {
  const key = raw.template?.info?.i18n_key || raw.id.toUpperCase()
  const variants = (raw.difficulty_stats || []).map((variant) => ({
    difficulty: variant.difficulty,
    label: ['休闲', '普通', '老兵', '不可能'][variant.difficulty - 1],
    ...enemyStats(variant),
  }))
  const normal = variants.find((variant) => variant.difficulty === 2) || enemyStats(raw)
  return {
    entryId: `${raw.id}--${raw.order}`, id: raw.id, order: Number(raw.order),
    name: localization[`${key}_NAME`] || raw.id.replaceAll('_', ' '),
    description: localization[`${key}_DESCRIPTION`] || '游戏百科未提供中文描述。',
    special: localization[`${raw.id.toUpperCase()}_SPECIAL`] || '',
    traits: (localization[`${key}_EXTRA`] || '').split(/\r?\n/).map((item) => item.replace(/^\s*[-•]\s*/, '').trim()).filter(Boolean),
    image: `/enemies/${raw.id}.png`, thumbnail: `/enemies/thumbs/${raw.id}.png`,
    imageSprite: raw.encyclopedia?.detail_sprite || null, thumbnailSprite: raw.encyclopedia?.thumb_sprite || null,
    sourceGame: Number(raw.source_game), alwaysShown: raw.always_shown === true, flying: raw.is_flying === true,
    boss: Boolean(raw.boss_evidence || bossExceptions[raw.id]), bossEvidence: raw.boss_evidence || bossExceptions[raw.id] || null,
    stats: normal.stats, statsByDifficulty: variants,
    diagnostics: { fieldSources: normal.fieldSources, missingFields: normal.missingFields, notApplicableFields: normal.notApplicableFields, damageScope: normal.damageScope, infoError: normal.infoError },
    sources: {
      roster: 'kr1/game_settings.lua → encyclopedia_enemies',
      template: raw.template_exists ? '游戏实体模板 + info.fn' : null,
      difficulty: 'all/difficulty.lua → patch_templates（不含关卡与波次加成）',
      localization: '_assets/kr1-desktop/strings/zh-Hans.lua',
      encyclopedia: '_assets/kr1-desktop/images/fullhd/encyclopedia.lua + encyclopedia_creeps.lua',
    },
  }
}
