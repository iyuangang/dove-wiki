import { describe, expect, it } from 'vitest'
import { hashForTab, tabFromHash } from './navigation'

describe('页面地址路由', () => {
  it('从固定地址恢复对应页面', () => {
    expect(tabFromHash('#/updates')).toBe('updates')
    expect(tabFromHash('#/technology/')).toBe('technology')
    expect(tabFromHash('#/calculator?source=tower')).toBe('calculator')
  })

  it('根地址和无效地址安全回到塔典', () => {
    expect(tabFromHash('')).toBe('catalog')
    expect(tabFromHash('#/')).toBe('catalog')
    expect(tabFromHash('#/missing')).toBe('catalog')
  })

  it('为每个页面生成 GitHub Pages 可刷新的 hash 地址', () => {
    expect(hashForTab('catalog')).toBe('#/')
    expect(hashForTab('updates')).toBe('#/updates')
    expect(hashForTab('heroes')).toBe('#/heroes')
  })
})
