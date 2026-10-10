import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sourceHash } from './tower-mechanics.mjs'

// The review is maintained manually; syncing only verifies its existing hashes.
export async function loadCalculationRules(gameDir) {
  const review = JSON.parse(await readFile(new URL('./calculation-rules-review.json', import.meta.url), 'utf8'))
  const invalidFiles = []
  for (const [file, hash] of Object.entries(review.files)) {
    try {
      if (sourceHash(await readFile(join(gameDir, file), 'utf8')) !== hash) invalidFiles.push(file)
    } catch { invalidFiles.push(file) }
  }
  return { ...review, valid: invalidFiles.length === 0, invalidFiles }
}
