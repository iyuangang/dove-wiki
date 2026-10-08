import { describe, it, expect } from 'vitest'
import { decodeAnimationData } from './animation-data.mjs'
import { sourceHash } from './tower-mechanics.mjs'

function binary(entries) {
  const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b }
  const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n); return b }
  const str = (s) => { const b = Buffer.from(s); return Buffer.concat([u16(b.length), b]) }
  return Buffer.concat([u32(entries.length), ...entries.flatMap(([name, prefix, frames]) => [str(name), str(prefix), u32(frames.length)]), ...entries.flatMap(([, , frames]) => frames.map(u16))])
}

describe('新版编译动画表', () => {
  it('目录与帧区分别读取，保留逆序和重复帧，按键定位而非字符串搜索', () => {
    const decoded = decodeAnimationData(binary([
      ['punchIn', 'monk', [1, 2, 3, 3]], ['kickOut', 'monk', [12, 11, 10]],
    ]))
    expect(decoded.get('punchIn')).toEqual({ prefix: 'monk', frameCount: 4, frames: [1, 2, 3, 3] })
    expect(decoded.get('kickOut').frames).toEqual([12, 11, 10])
    expect(decoded.has('monk')).toBe(false)
  })
  it('拒绝截断帧区、截断目录、重复动画键与未知尾部', () => {
    const data = binary([['hit', 'actor', [1, 2]]])
    expect(() => decodeAnimationData(data.subarray(0, -1))).toThrow('越界')
    expect(() => decodeAnimationData(data.subarray(0, 5))).toThrow('越界')
    expect(() => decodeAnimationData(binary([['hit', 'actor', []], ['hit', 'actor', []]]))).toThrow('重复键')
    expect(() => decodeAnimationData(Buffer.concat([data, Buffer.from([0])]))).toThrow('尾部')
  })
  it('二进制指纹逐字节校验，不对 CR/LF 字节做文本换行转换', () => {
    expect(sourceHash(Buffer.from([13, 10]))).not.toBe(sourceHash(Buffer.from([10])))
  })
})
