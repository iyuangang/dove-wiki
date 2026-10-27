import { readFileSync, existsSync } from 'node:fs'
import { execFileSync, spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

function bashExecutable() {
  if (process.platform !== 'win32') return 'bash'
  const gitExec = execFileSync('git', ['--exec-path'], { encoding: 'utf8', windowsHide: true }).trim()
  const bash = resolve(gitExec, '../../../bin/bash.exe')
  if (!existsSync(bash)) throw new Error('Workflow syntax tests require Git Bash from Git for Windows')
  return bash
}

// Preserve the exact run-block contents. Reformatting a case pattern could hide
// the same accidental newline that stopped the 2.1.0.3 deployment.
function runBlocks(source) {
  const lines = source.split(/\r?\n/), blocks = []
  for (let i = 0; i < lines.length; i++) {
    const start = /^(\s*)run: \|[-+]?\s*$/.exec(lines[i])
    if (!start) continue
    const block = [], indent = start[1].length
    while (++i < lines.length && (!lines[i].trim() || /^ */.exec(lines[i])[0].length > indent)) block.push(lines[i])
    i--
    const trim = Math.min(...block.filter(line => line.trim()).map(line => /^ */.exec(line)[0].length))
    blocks.push(block.map(line => line.slice(trim)).join('\n') + '\n')
  }
  return blocks
}

describe('release workflow Bash syntax', () => {
  const bash = bashExecutable()
  it('parses every multiline release script before any tag is created', () => {
    const source = readFileSync(new URL('../.github/workflows/release.yml', import.meta.url), 'utf8')
    const blocks = runBlocks(source)
    expect(blocks.length).toBeGreaterThan(1)
    for (const script of blocks) {
      const result = spawnSync(bash, ['-n'], { input: script, encoding: 'utf8', windowsHide: true })
      expect(result.error).toBeUndefined()
      expect(result.status, result.stderr).toBe(0)
    }
  })
  it('detects a split data-path pattern rather than silently joining it', () => {
    const [script] = runBlocks('run: |\n  case "$path" in\n    src/data/site-index.json\n    src/data/dove-data.json) ;;\n  esac\n')
    expect(spawnSync(bash, ['-n'], { input: script, encoding: 'utf8', windowsHide: true }).status).not.toBe(0)
  })
})
