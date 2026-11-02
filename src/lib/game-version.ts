export function gameVersionLabel(source: { gameVersion: string; gameBranch?: string | null }): string {
  return source.gameVersion + (source.gameBranch === 'dev' ? ' · 开发预览版' : '')
}
