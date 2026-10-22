import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import manifest from '../data/rating-manifest.json'
import { loadRatingDataset, ratingAssetUrl } from './rating-loader'

const source = manifest.profiles.standard
const bytes = readFileSync(new URL(`../../public/${source.file}`, import.meta.url))
const signal = () => new AbortController().signal
const response = () => new Response(new Uint8Array(bytes))
afterEach(() => vi.unstubAllGlobals())

describe('跨版本测评缓存与校验', () => {
  it('把当前数据摘要放入请求地址，要求重新校验缓存', async () => {
    const fetcher = vi.fn().mockResolvedValue(response())
    vi.stubGlobal('fetch', fetcher)
    const data = await loadRatingDataset(source, 'standard', signal())
    expect(data.summary.runId).toBe(source.runId)
    expect(fetcher).toHaveBeenCalledOnce()
    expect(fetcher.mock.calls[0]![0]).toBe(ratingAssetUrl(source.file, source.sha256))
    expect(fetcher.mock.calls[0]![1].cache).toBe('no-cache')
  })
  it('旧缓存不匹配时，只额外获取一次新响应，再通过校验', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('{"previousRelease":true}')).mockResolvedValueOnce(response())
    vi.stubGlobal('fetch', fetcher)
    expect((await loadRatingDataset(source, 'standard', signal())).summary.runId).toBe(source.runId)
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(fetcher.mock.calls[1]![0]).toContain(`sha256=${source.sha256}&reload=`)
    expect(fetcher.mock.calls[1]![1].cache).toBe('reload')
  })
  it('重取后仍不匹配时拒绝数据，不取消完整性保护', async () => {
    const fetcher = vi.fn().mockImplementation(() => new Response('{}'))
    vi.stubGlobal('fetch', fetcher)
    await expect(loadRatingDataset(source, 'standard', signal())).rejects.toThrow('校验不一致')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('即使字节摘要正确，也不接受另一批次的结果', async () => {
    const data = JSON.parse(bytes.toString())
    data.summary.runId = 'different-run'
    const other = JSON.stringify(data)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(other)))
    await expect(loadRatingDataset({ ...source, sha256: createHash('sha256').update(other).digest('hex') }, 'standard', signal())).rejects.toThrow('批次')
  })
  it('切换档位中止后，不重试和返回迟到的旧数据', async () => {
    const controller = new AbortController()
    const fetcher = vi.fn().mockImplementation(() => { controller.abort(); return Promise.resolve(response()) })
    vi.stubGlobal('fetch', fetcher)
    await expect(loadRatingDataset(source, 'standard', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(fetcher).toHaveBeenCalledOnce()
  })
})
