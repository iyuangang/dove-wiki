import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

// Invoke Node entry points directly so the same command works on Windows and CI.
const build = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/vue-tsc/bin/vue-tsc.js', import.meta.url)), '-b'], { stdio: 'inherit' })
if (build.status !== 0) process.exit(build.status || 1)
const bundle = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'build'], { stdio: 'inherit', env: { ...process.env, VITE_BASE_PATH: '/dove-wiki/' } })
if (bundle.status !== 0) process.exit(bundle.status || 1)
const tests = spawnSync(process.execPath, [fileURLToPath(new URL('../node_modules/@playwright/test/cli.js', import.meta.url)), 'test', ...process.argv.slice(2)], { stdio: 'inherit' })
process.exit(tests.status ?? 1)
