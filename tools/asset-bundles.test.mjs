import { describe, it, expect } from 'vitest'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { gzipSync } from 'node:zlib'
import { restoreAssets, downloadBundle, groups, packGroup, unpackGroup, sha, validPath } from './asset-bundles.mjs'
async function fixture(run) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'dove-assets-'))
  try { for (const local of groups.game) { await mkdir(path.join(root,local),{recursive:true});await writeFile(path.join(root,local,'sample.png'),'old-'+local) } await run(root) }
  finally { await rm(root,{recursive:true,force:true}) }
}
describe('external generated asset bundles', () => {
  it('round trips exact bytes and produces deterministic content addresses', () => fixture(async root => {
    const first=await packGroup(root,'game'), second=await packGroup(root,'game')
    expect(first.sha256).toBe(second.sha256)
    await writeFile(path.join(root,groups.game[0],'sample.png'),'changed')
    await unpackGroup(root,'game',first,first.output)
    expect(await readFile(path.join(root,groups.game[0],'sample.png'),'utf8')).toBe('old-'+groups.game[0])
  }))
  it('rejects a checksum mismatch before touching current assets', () => fixture(async root => {
    const bundle=await packGroup(root,'game')
    await expect(unpackGroup(root,'game',{...bundle,sha256:'0'.repeat(64)},bundle.output)).rejects.toThrow('SHA-256')
    expect(await readFile(path.join(root,groups.game[0],'sample.png'),'utf8')).toBe('old-'+groups.game[0])
  }))
  it('resumes a partially downloaded bundle using HTTP ranges', () => fixture(async root => {
    const bytes=Buffer.from('a complete resource bundle'), target=path.join(root,'download.gz')
    await writeFile(target+'.pending',bytes.subarray(0,7))
    let requested
    const request=async (_url,options) => { requested=options.headers.Range; return new Response(bytes.subarray(7),{status:206,headers:{'content-range':`bytes 7-${bytes.length-1}/${bytes.length}`}}) }
    await downloadBundle({url:'https://example.test/file',file:'fixture',bytes:bytes.length,sha256:sha(bytes)},target,request)
    expect(requested).toBe('bytes=7-');expect(await readFile(target)).toEqual(bytes)
  }))
  it('rejects source data that does not match the pinned image bundle', () => fixture(async root => {
    await mkdir(path.join(root,'src/data'),{recursive:true});await writeFile(path.join(root,'src/data/dove-data.json'),'version one')
    await packGroup(root,'game');await writeFile(path.join(root,'src/data/dove-data.json'),'version two')
    await expect(restoreAssets(root)).rejects.toThrow('does not match')
  }))
  it('restores missing files even when a previous checkout left a matching state marker', () => fixture(async root => {
    await packGroup(root,'game');await rm(path.join(root,'public/heroes/sample.png'))
    await restoreAssets(root)
    expect(await readFile(path.join(root,'public/heroes/sample.png'),'utf8')).toBe('old-public/heroes')
  }))
  it('rejects traversal and unrelated project files', () => {
    for (const name of ['../outside','public/rating/../../x','C:/x','public/heroes\\x','src/App.vue','public/heroes//x']) expect(validPath(name,'game')).toBe(false)
    expect(validPath('public/heroes/thumbs/a.png','game')).toBe(true)
  })
  it('rejects truncated inventories without replacing the old directory', () => fixture(async root => {
    const files=[{path:'public/heroes/missing.png',bytes:3,sha256:sha('new')}], treeSha256=sha(JSON.stringify(files))
    const bytes=gzipSync(JSON.stringify({schema:1,kind:'game',files,treeSha256})+'\n'), archive=path.join(root,'bad.gz');await writeFile(archive,bytes)
    await expect(unpackGroup(root,'game',{sha256:sha(bytes),treeSha256,files:1},archive)).rejects.toThrow('Truncated')
    expect(await readFile(path.join(root,'public/heroes/sample.png'),'utf8')).toBe('old-public/heroes')
  }))
})
