import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve, sep } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { resolveDovePaths } from './dove-paths.mjs'

describe('Dove 安装路径识别', () => {
  let fixtureRoot
  const fixturePrefix = join(tmpdir(), 'dove-paths-')

  beforeEach(() => {
    fixtureRoot = mkdtempSync(fixturePrefix)
  })

  afterEach(() => {
    const target = resolve(fixtureRoot)
    if (!target.startsWith(resolve(fixturePrefix))) throw new Error('拒绝清理非测试目录')
    rmSync(target, { recursive: true, force: true })
  })

  function file(path) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, '')
    return path
  }

  function game(root) {
    file(join(root, 'kr1', 'game_settings.lua'))
    return root
  }

  it('兼容旧版源码目录和上一级 lovec.exe', () => {
    const gameDir = game(join(fixtureRoot, 'KingdomRushDove'))
    const loveExe = file(join(fixtureRoot, 'lovec.exe'))
    expect(resolveDovePaths({ gameDir })).toEqual({ gameDir, loveExe })
  })

  it('从中文安装路径及末尾斜杠识别子目录和新版 love.exe', () => {
    const installer = join(fixtureRoot, '王国保卫战Dove版')
    const gameDir = game(join(installer, 'KingdomRushDove'))
    const loveExe = file(join(installer, 'love.exe'))
    expect(resolveDovePaths({ gameDir: installer + sep })).toEqual({ gameDir, loveExe })
  })

  it('支持源码和运行时放在同一目录', () => {
    const gameDir = game(join(fixtureRoot, 'portable'))
    const loveExe = file(join(gameDir, 'love.exe'))
    expect(resolveDovePaths({ gameDir })).toEqual({ gameDir, loveExe })
  })

  it('优先使用可用的控制台运行时', () => {
    const gameDir = game(join(fixtureRoot, 'KingdomRushDove'))
    file(join(fixtureRoot, 'love.exe'))
    const loveExe = file(join(gameDir, 'lovec.exe'))
    expect(resolveDovePaths({ gameDir }).loveExe).toBe(loveExe)
  })

  it('显式指定的运行时优先于自动识别', () => {
    const gameDir = game(join(fixtureRoot, 'KingdomRushDove'))
    file(join(fixtureRoot, 'lovec.exe'))
    const loveExe = file(join(fixtureRoot, 'custom', 'love.exe'))
    expect(resolveDovePaths({ gameDir, loveExe })).toEqual({ gameDir, loveExe })
    expect(() => resolveDovePaths({ gameDir, loveExe: join(fixtureRoot, 'missing.exe') }))
      .toThrow('指定的 LÖVE 运行时不存在')
  })

  it('未指定游戏目录时按默认目录顺序查找并兼容旧路径', () => {
    const gameDir = game(join(fixtureRoot, 'legacy', 'KingdomRushDove'))
    const loveExe = file(join(fixtureRoot, 'legacy', 'lovec.exe'))
    const defaultGameDirs = [join(fixtureRoot, 'missing'), gameDir]
    expect(resolveDovePaths({ defaultGameDirs })).toEqual({ gameDir, loveExe })
    const newInstaller = join(fixtureRoot, 'new')
    const newGameDir = game(join(newInstaller, 'KingdomRushDove'))
    const newLoveExe = file(join(newInstaller, 'love.exe'))
    expect(resolveDovePaths({ defaultGameDirs: [newInstaller, gameDir] }))
      .toEqual({ gameDir: newGameDir, loveExe: newLoveExe })
  })

  it('显式指定的无效目录不会退回其他游戏版本', () => {
    const defaultRoot = game(join(fixtureRoot, 'default'))
    expect(() => resolveDovePaths({
      gameDir: join(fixtureRoot, 'missing'), defaultGameDirs: [defaultRoot],
    })).toThrow('未找到 Dove 游戏源码')
  })

  it('运行时缺失时提示两个文件名和覆盖参数', () => {
    const gameDir = game(join(fixtureRoot, 'KingdomRushDove'))
    expect(() => resolveDovePaths({ gameDir })).toThrow(/lovec\.exe.*love\.exe.*--love-exe/)
  })

  it('不把同名目录当成游戏源码或运行时文件', () => {
    const gameDir = join(fixtureRoot, 'KingdomRushDove')
    mkdirSync(join(gameDir, 'kr1', 'game_settings.lua'), { recursive: true })
    expect(() => resolveDovePaths({ gameDir })).toThrow('未找到 Dove 游戏源码')
    const validGameDir = game(join(fixtureRoot, 'valid'))
    mkdirSync(join(fixtureRoot, 'love.exe'))
    expect(() => resolveDovePaths({ gameDir: validGameDir })).toThrow('未找到 Dove 自带')
  })
})
