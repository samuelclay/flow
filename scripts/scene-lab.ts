// REVISION: flow-v82-box-hue
//
// Shared by preview and check: build a scene at a size and a setting, warm it
// up, and count what Claude Code's Raster cares about. Not part of the mod.

import { hasNight, makeScene, SCENES, sceneHue, STYLES, type SceneName, type Tint } from '../hooks/styles'
import { Cells } from '../hooks/cells'
import { HUES, hueNamed, paletteToward } from '../hooks/palette'

export const TINTS: Tint[] = ['normal', 'smoke', 'blue']
export const BAND = { name: 'band', columns: 120, rows: 5 }
export const SPINE = { name: 'spine', columns: 22, rows: 40 }
/** crabigator's column: about 15% of the terminal's width, by its status rows. */
export const BOXES = [
  { columns: 16, rows: 4 },
  { columns: 24, rows: 7 },
  { columns: 30, rows: 9 },
  { columns: 40, rows: 12 },
] as const

/** A hue from the command line: a name or degrees (undefined: natural). */
export function hueArg(s: string | undefined): number | undefined {
  if (s === undefined || s === 'natural') return undefined
  const named = hueNamed(s)
  return named ? HUES[named] : Number.isFinite(Number(s)) ? Number(s) : undefined
}

/** A scene's frame turned toward a hue, as the driver draws it (a copy; natural: the frame itself). */
export function turned(scene: SceneName, grid: Cells, hue: number | undefined): Cells {
  const p = paletteToward(sceneHue(scene), hue)
  return p.isNatural ? grid : p.apply(grid, new Cells(grid.columns, grid.rows))
}

export type Setting = { level: number; night: boolean; tint: Tint }

/** The scenes named on the command line (all of them when none are), or exit with the names it knows. */
export function scenesFrom(argv: string[]): SceneName[] {
  const names = argv.filter(a => !a.startsWith('--'))
  for (const n of names) {
    if (!(STYLES as readonly string[]).includes(n)) {
      console.error(`no scene called "${n}"; there are: ${STYLES.join(', ')}`)
      process.exit(1)
    }
  }
  return names.length ? (names as SceneName[]) : [...STYLES]
}

export function nightsOf(scene: SceneName): boolean[] {
  return hasNight(scene) ? [false, true] : [false]
}

/** A scene at a size and setting, stepped `warm` frames so it has settled. */
export function build(scene: SceneName, columns: number, rows: number, s: Setting, warm = 90) {
  const f = makeScene(scene, 7)
  f.strength = s.level
  f.tint = s.tint
  f.night = s.night
  f.ensure(columns, rows)
  for (let i = 0; i < warm; i++) f.step()
  return f
}

/** Distinct (fg, bg) pairs in a frame: Raster paints 1024 and nearest-maps the rest. */
export function pairs(grid: Cells): number {
  const w = grid.words
  const set = new Set<number>()
  for (let i = 0; i < w.length; i += 3) set.add(w[i + 1]! * 0x2000000 + w[i + 2]!)
  return set.size
}

export const blurbOf = (scene: SceneName) => SCENES.find(d => d.name === scene)!.blurb
