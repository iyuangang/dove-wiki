// Matches all/animation_db.lua: directory followed by little-endian u16 frames.
export function decodeAnimationData(bytes) {
  const data = Buffer.from(bytes)
  let offset = 0
  const take = (size) => {
    if (size > data.length - offset) throw new Error('动画表数据越界')
    const start = offset
    offset += size
    return start
  }
  const u16 = () => data.readUInt16LE(take(2))
  const u32 = () => data.readUInt32LE(take(4))
  const string = () => { const size = u16(); return data.toString('utf8', take(size), offset) }
  const count = u32()
  const entries = new Map()
  for (let i = 0; i < count; i++) {
    const name = string(), prefix = string(), frameCount = u32()
    if (!name || entries.has(name)) throw new Error('动画表存在空键或重复键')
    entries.set(name, { prefix, frameCount })
  }
  for (const entry of entries.values()) {
    const start = take(entry.frameCount * 2)
    entry.frames = Array.from({ length: entry.frameCount }, (_, i) => data.readUInt16LE(start + i * 2))
  }
  if (offset !== data.length) throw new Error('动画表存在未识别的尾部数据')
  return entries
}
