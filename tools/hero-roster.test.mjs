import { describe, expect, it } from 'vitest'
import { heroRoomMetadata } from './hero-roster.mjs'

describe('native hero room metadata migration', () => {
  it('uses declared order, native i18n identity and per-hero provenance', () => {
    const raw = { id: 'hero_new', template_exists: true, template: { info: { i18n_key: 'HERO_NEW_ALIAS' } },
      specialties: ['Automatic skill', 'Talent'], template_sources: ['kr1/heroes/hero_new/templates.lua'],
      roster_source: 'kr1/heroes/registry.lua → declarations' }
    const original = structuredClone(raw)
    expect(heroRoomMetadata(raw, { HERO_NEW_ALIAS_SPECIAL: 'Old,Wrong' })).toMatchObject({
      token: 'NEW_ALIAS', specialties: ['Automatic skill', 'Talent'],
      sources: { template: 'kr1/heroes/hero_new/templates.lua', roster: raw.roster_source },
    })
    expect(raw).toEqual(original)
  })
  it('retains the legacy roster and localization fallback', () => {
    expect(heroRoomMetadata({ id: 'hero_gerald', template_exists: true }, { HERO_GERALD_SPECIAL: ' A， B ' }))
      .toMatchObject({ specialties: ['A', 'B'], sources: { roster: 'kr1-desktop/data/map_data.lua → hero_data' } })
  })
  it('does not replace an explicitly empty declaration with stale skill text', () => {
    expect(heroRoomMetadata({ id: 'hero_new', specialties: [] }, { HERO_NEW_SPECIAL: 'Stale' }).specialties).toEqual([])
    expect(heroRoomMetadata({ id: 'hero_new' }, {}).sources.template).toBeNull()
  })
})
