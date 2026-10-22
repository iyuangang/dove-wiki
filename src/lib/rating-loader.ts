import { publicAssetUrl } from './public-assets'
import { validRatingCoverage, type RatingDataset, type RatingProfile } from './ratings'

export interface RatingSource {
  file: string
  sha256: string
  gameVersion: string
  commitHash: string
  runId: string
  sourceSummarySha256: string
}

export function ratingAssetUrl(file: string, sha256: string) {
  return `${publicAssetUrl(file)}?sha256=${encodeURIComponent(sha256)}`
}

export async function loadRatingDataset(source: RatingSource, profile: RatingProfile, signal: AbortSignal): Promise<RatingDataset> {
  if (!globalThis.crypto?.subtle) throw new Error('当前浏览器无法校验测评文件，请使用新版浏览器通过 HTTPS 访问')
  const url = ratingAssetUrl(source.file, source.sha256)
  for (let attempt = 0; attempt < 2; attempt++) {
    signal.throwIfAborted()
    // A stable filename may still hold the previous deployment in a browser or
    // CDN cache. Bind the URL to the expected bytes; retry a mismatch once with
    // a fresh request, without accepting or grading the mismatched response.
    const response = await fetch(attempt ? `${url}&reload=${Date.now()}` : url, {
      signal, cache: attempt ? 'reload' : 'no-cache',
    })
    if (!response.ok) throw new Error(`读取结果失败（HTTP ${response.status}）`)
    const bytes = await response.arrayBuffer()
    const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(n => n.toString(16).padStart(2, '0')).join('')
    signal.throwIfAborted()
    if (hash !== source.sha256) {
      if (!attempt) continue
      throw new Error('结果文件校验不一致，请刷新后重试')
    }
    let result: RatingDataset
    try {
      result = JSON.parse(new TextDecoder().decode(bytes)) as RatingDataset
      if (!validRatingCoverage(result) || result.summary.profile !== profile || result.summary.gameVersion !== source.gameVersion ||
        result.summary.commitHash !== source.commitHash || result.summary.runId !== source.runId ||
        result.provenance.sourceSummarySha256 !== source.sourceSummarySha256) throw new Error()
    } catch {
      throw new Error('测评格式、批次或完整性检查未通过')
    }
    return result
  }
  throw new Error('无法读取测评结果')
}
