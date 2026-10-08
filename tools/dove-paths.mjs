import { statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

function isFile(path) {
  return statSync(path, { throwIfNoEntry: false })?.isFile() === true
}

export function resolveDovePaths({ gameDir, loveExe, defaultGameDirs = [] }) {
  const roots = gameDir ? [gameDir] : defaultGameDirs
  const candidates = [...new Set(roots.flatMap((root) => [
    resolve(root),
    resolve(root, 'KingdomRushDove'),
  ]))]
  const resolvedGameDir = candidates.find((root) =>
    isFile(join(root, 'kr1', 'game_settings.lua')),
  )

  if (!resolvedGameDir) {
    throw new Error(`未找到 Dove 游戏源码，请传入安装目录或 KingdomRushDove 目录。已检查：\n${candidates.map((root) => join(root, 'kr1', 'game_settings.lua')).join('\n')}`)
  }

  let resolvedLoveExe
  if (loveExe) {
    resolvedLoveExe = resolve(loveExe)
    if (!isFile(resolvedLoveExe)) {
      throw new Error(`指定的 LÖVE 运行时不存在：${resolvedLoveExe}`)
    }
  } else {
    const runtimeDirs = [dirname(resolvedGameDir), resolvedGameDir]
    const runtimes = ['lovec.exe', 'love.exe'].flatMap((name) =>
      runtimeDirs.map((root) => join(root, name)),
    )
    resolvedLoveExe = runtimes.find(isFile)
    if (!resolvedLoveExe) {
      throw new Error(`未找到 Dove 自带的 lovec.exe 或 love.exe，可通过 --love-exe 指定。已检查：\n${runtimes.join('\n')}`)
    }
  }

  return { gameDir: resolvedGameDir, loveExe: resolvedLoveExe }
}
