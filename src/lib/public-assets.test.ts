import { describe, expect, it } from 'vitest'
import { publicAssetUrl } from './public-assets'

describe('publicAssetUrl', () => {
  it('保留本地根路径', () => {
    expect(publicAssetUrl('/skills/tower_ranger--poison.png', '/')).toBe(
      '/skills/tower_ranger--poison.png',
    )
  })

  it('为 GitHub Pages 项目站点添加 base path', () => {
    expect(publicAssetUrl('/encyclopedia/tower_ranger.png', '/dove-wiki/')).toBe(
      '/dove-wiki/encyclopedia/tower_ranger.png',
    )
    expect(publicAssetUrl('portraits/tower_archer_1.png', 'dove-wiki')).toBe(
      '/dove-wiki/portraits/tower_archer_1.png',
    )
  })

  it('不改写外部资源地址', () => {
    expect(publicAssetUrl('https://example.com/icon.png', '/dove-wiki/')).toBe(
      'https://example.com/icon.png',
    )
  })
})
