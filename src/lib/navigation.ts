export const navigationTabs = [
  { id: 'catalog', label: '塔典', eyebrow: 'CATALOG' },
  { id: 'enemies', label: '敌人', eyebrow: 'ENEMIES' },
  { id: 'heroes', label: '英雄', eyebrow: 'HEROES' },
  { id: 'technology', label: '科技', eyebrow: 'TECH' },
  { id: 'updates', label: '更新', eyebrow: 'UPDATES' },
  { id: 'calculator', label: '辅助计算', eyebrow: 'BUFF LAB' },
  { id: 'compare', label: '双塔对比', eyebrow: 'COMPARE' },
  { id: 'data', label: '数据说明', eyebrow: 'SOURCES' },
] as const

export type TabId = (typeof navigationTabs)[number]['id']

const tabIds = new Set<TabId>(navigationTabs.map((tab) => tab.id))

export function hashForTab(tab: TabId): string {
  return tab === 'catalog' ? '#/' : `#/${tab}`
}

export function tabFromHash(hash: string): TabId {
  const route = hash
    .replace(/^#/, '')
    .split('?')[0]
    .replace(/^\/+|\/+$/g, '')

  if (!route) return 'catalog'

  const tab = route.split('/')[0] as TabId
  return tabIds.has(tab) ? tab : 'catalog'
}
