import { readFile } from 'node:fs/promises'
import { snapshotHash, validateAssets, validateSnapshot } from './snapshot-validation.mjs'

const root = new URL('../', import.meta.url)
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'))
const dataText = await readFile(new URL('src/data/dove-data.json', root), 'utf8')
const data = JSON.parse(dataText)
const manifest = await readJson('src/data/snapshot-manifest.json')
validateSnapshot(data, manifest, await readJson('src/data-contract.json'))
if (snapshotHash(dataText) !== manifest.dataHash) throw new Error('数据快照与清单哈希不一致，请重新同步。')
const { fileURLToPath } = await import('node:url')
const assets = await validateAssets(data, fileURLToPath(root))
console.log(`[dove-wiki] 快照格式、审阅证据与 ${assets} 个资源引用校验通过。`)
