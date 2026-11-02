import { expect, it } from 'vitest'
import { gameVersionLabel } from './game-version'

it('区分开发预览版，旧批次及正式分支保持原版本标记', () => {
  expect(gameVersionLabel({ gameVersion: '2.1.0.6', gameBranch: 'dev' })).toBe('2.1.0.6 · 开发预览版')
  expect(gameVersionLabel({ gameVersion: '2.0.9.9' })).toBe('2.0.9.9')
  expect(gameVersionLabel({ gameVersion: '2.1.0.6', gameBranch: 'master' })).toBe('2.1.0.6')
})
