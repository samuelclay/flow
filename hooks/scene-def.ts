// REVISION: flow-v186-upstream-merge
//
// What a scene file exports so Flow can list it: its name, a line for
// /config, whether it has a night, and how to build one. `styles.ts` keeps
// the one list of them (SCENES); everything else (the /flow names, the
// /config options, `/flow next`, which scenes have a night) comes from it.

import type { SceneHue } from './palette'
import type { Scene } from './styles'

export interface SceneDef<N extends string = string> {
  /** What `/flow <name>` and /config call it: lowercase, one word. */
  name: N
  /** A few words for /config's list of scenes, e.g. 'a surfer and the swell'. */
  blurb: string
  /** It draws a night version too (follows `/flow day | night | clock`). */
  night?: boolean
  /** Old names that still pick it. */
  aliases?: readonly string[]
  /**
   * Its main hue (OKLCH degrees) and how far a palette may turn it: a fire
   * turns any way (180), a sky only a little, or it would go green.
   */
  hue?: SceneHue
  /** A new instance; `seed` makes it repeatable (tests, previews). */
  make(seed?: number): Scene
}

/** A scene's entry for SCENES, keeping its name as a literal type. */
export function defineScene<const N extends string>(def: SceneDef<N>): SceneDef<N> {
  return def
}
