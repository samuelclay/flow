// REVISION: flow-v82-random-colors
//
// Writes the scene list into .claude-plugin/plugin.json from SCENES
// (hooks/styles.ts): the `style` options (and `random`) and description, the
// `time` description's night scenes, and the `color` row's hues (palette.ts). plugin.json has to be literal JSON, so this
// copies; a test fails when the two drift. Not part of the mod (Node).
//
//   npm run sync

import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { HUE_NAMES } from '../hooks/palette'
import { STYLES, styleDescription, timeDescription } from '../hooks/styles'

export const MANIFEST = join(import.meta.dirname, '..', '.claude-plugin', 'plugin.json')

/** Brings plugin.json in step with SCENES; returns whether it had drifted. `write: false` only checks. */
export function syncManifest(write = true): boolean {
  const before = readFileSync(MANIFEST, 'utf8')
  const m = JSON.parse(before)
  const rows = m.userConfig
  rows.style.options = [...STYLES, 'random']
  rows.style.description = `${styleDescription()}; random: a scene picked as each session opens`
  if (!rows.style.options.includes(rows.style.default)) rows.style.default = STYLES[0]
  rows.time.description = timeDescription()
  if (rows.color) rows.color.options = ['natural', 'random', ...HUE_NAMES]
  const after = `${JSON.stringify(m, null, 2)}\n`
  if (write && after !== before) writeFileSync(MANIFEST, after)
  return after !== before
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log(syncManifest() ? 'plugin.json: scene list updated' : 'plugin.json: already up to date')
}
