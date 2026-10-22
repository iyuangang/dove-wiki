import { describe, expect, it } from 'vitest'
import { readRatingRoute, writeRatingRoute } from './rating-route'
describe('rating share route',()=>{
  it('round trips profile, class, role, object and non-ASCII search',()=>{
    const route={profile:'quick' as const,group:'tower_final',role:'defense' as const,id:'tower_ranger',q:'游侠 & 近战'}
    expect(readRatingRoute(writeRatingRoute(route))).toEqual(route)
  })
  it('rejects invalid selectors and executable object identifiers',()=>{
    expect(readRatingRoute('#/tierlist?profile=other&group=bad&role=__proto__&id=<script>')).toEqual({profile:'standard',group:'hero_ranged',role:'output',id:'',q:''})
  })
})
