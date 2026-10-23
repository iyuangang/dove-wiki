import { ratingGroups, ratingRoles, type RatingProfile, type RatingRole } from './ratings'
export function readRatingRoute(hash: string) {
  const p = new URLSearchParams(hash.split('?')[1] || '')
  return { profile: (p.get('profile') === 'quick' ? 'quick' : 'standard') as RatingProfile,
    group: ratingGroups.some(g => g[0] === p.get('group')) ? p.get('group')! : 'hero_ranged',
    role: (Object.hasOwn(ratingRoles,p.get('role') || '') ? p.get('role') : 'output') as RatingRole,
    id: /^[\w_]{1,120}$/.test(p.get('id') || '') ? p.get('id')! : '', q: (p.get('q') || '').slice(0, 120) }
}
export function writeRatingRoute(route: ReturnType<typeof readRatingRoute>) {
  const p = new URLSearchParams({ profile: route.profile, group: route.group, role: route.role })
  if (route.id) p.set('id', route.id)
  if (route.q) p.set('q', route.q)
  return '#/tierlist?' + p
}
