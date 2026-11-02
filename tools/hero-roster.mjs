// Prefer the native room's declared order and already evaluated descriptions.
export function heroRoomMetadata(raw, localization) {
  const token = (raw.template?.info?.i18n_key || raw.id).replace(/^hero_/i, '').toUpperCase()
  const specialties = raw.specialties ?? (localization[`HERO_${token}_SPECIAL`] || '')
    .split(/[，,]/).map(name => name.trim()).filter(Boolean)
  return {
    token,
    specialties,
    sources: {
      template: raw.template_exists ? (raw.template_sources?.join(' + ') || 'kr1/heroes.lua + kr1/data/balance.lua') : null,
      roster: raw.roster_source || 'kr1-desktop/data/map_data.lua → hero_data',
      localization: '_assets/kr1-desktop/strings/zh-Hans.lua',
      portrait: '_assets/kr1-desktop/images/fullhd/hero_room',
    },
  }
}
