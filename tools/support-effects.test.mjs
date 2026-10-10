import { describe, expect, it } from 'vitest'
import { mkdtemp, writeFile, readFile, mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { buildSupportEffects, loadSupportReview } from './support-effects.mjs'
import { sourceHash } from './tower-mechanics.mjs'

describe('support source review', () => {
  it('reads new tower support values from the extracted runtime, allowing parameters to change independently of prose', async () => {
    const raw = { towers: [
      { id: 'tower_archers', template: { attacks: { range: 240 }, powers: { skill_b: { range_factor: [1.2, 1.4, 1.6] } } } },
      { id: 'tower_wizard', template: { attacks: { range: 210, list: [{}, {}, { damage_factor: [1.25, 1.5, 1.75], duration: [5, 7, 9], cooldown: 22, vis_bans: 4096, vis_flags: 4100 }] } } },
      { id: 'tower_flag_banned', template: { vis: { flags: 4096 } } },
      { id: 'tower_mod_banned', template: { vis: { bans: 4 } } },
    ] }
    const manifest = JSON.parse(await readFile(new URL('./support-effects-review.json', import.meta.url), 'utf8'))
    const effects = buildSupportEffects(raw, { manifest: { ...manifest, invalidFiles: [] } })
    expect(effects.find((effect) => effect.id === 'archers-eye')?.levels[2]).toMatchObject({ radius: 240, rangeBonus: expect.closeTo(0.6) })
    expect(effects.find((effect) => effect.id === 'wizard-knowledge')?.levels[2]).toEqual({ level: 3, radius: 210, damageBonus: 0.75, duration: 9, cycle: 22 })
    expect(effects.find((effect) => effect.id === 'wizard-knowledge')?.excludeTowerIds).toEqual(['tower_flag_banned', 'tower_mod_banned'])
    const stale = buildSupportEffects(raw, { manifest: { ...manifest, invalidFiles: ['kr1/archer_towers.lua'] } })
    expect(stale.find((effect) => effect.id === 'archers-eye')?.review.valid).toBe(false)
    expect(stale.find((effect) => effect.id === 'wizard-knowledge')?.review.valid).toBe(true)
  })

  it('does not renew a reviewed fingerprint after source edits or missing files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dove-support-review-'))
    try {
      await mkdir(join(root, 'kr1'))
      const source = join(root, 'kr1/tower_scripts.lua')
      const review = join(root, 'review.json')
      const text = 'reviewed source\n'
      const manifest = { version: '2.0.9.3', files: { 'kr1/tower_scripts.lua': sourceHash(text) } }
      await writeFile(source, text)
      await writeFile(review, JSON.stringify(manifest))
      expect((await loadSupportReview(root, review)).manifest.invalidFiles).toEqual([])
      await writeFile(source, 'changed source\n')
      expect((await loadSupportReview(root, review)).manifest.invalidFiles).toEqual(['kr1/tower_scripts.lua'])
      expect(JSON.parse(await readFile(review, 'utf8'))).toEqual(manifest)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
})
