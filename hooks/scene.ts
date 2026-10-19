// REVISION: flow-v193-upstream-merge
//
// What every harness adapter (Claude Code's register.tsx, opencode's
// opencode/tui.ts, pi's pi/index.ts) does the same way: one scene instance per style (so a switch resumes where
// that scene left off), the level the settings and the activity call for, whether
// anything shows at all, and pointing the current scene at those dials, the
// time of day and whether Claude waits on the person. Two drivers can share
// one cfg (each with its own scenes): the scene follows the shared style.
// `random` shows the scene the adapter picked as the session opened (`pick`),
// and the colour setting turns every frame to a hue (`cells()`); adapters draw
// from the driver, not the scene. Pure: no engine imports.

import { type Activity, FRAME_MS } from './activity'
import { Cells } from './cells'
import { HUES, NATURAL, paletteToward, type Palette } from './palette'
import { isNightAt, type Clock, type FlowConfig, type Shown } from './settings'
import { makeScene, sceneHue, type SceneName, type Scene } from './styles'

/** Frame pace while busy (~14 fps, the heat model's frame), and when calm: a low glow or off (8 fps). */
export { FRAME_MS }
const CALM_MS = 125

export class SceneDriver {
  private readonly scenes = new Map<SceneName, Scene>()
  /** The local time, which the adapter keeps current (noon until it first reads the clock). */
  clock: Clock = { hour: 12, minute: 0 }
  /** The scene `style: random` shows: the adapter picks it as the session opens. */
  pick: SceneName = 'fire'
  /** The hue (OKLCH degrees) `color: random` turns to: the adapter picks it, or a host hands it one. */
  pickHue: number | undefined
  /** Another program draws the scene (crabigator's own column): this one never shows. */
  external = false
  private palette: Palette = NATURAL
  private paletteKey = ''
  /** The turned frame (a copy: scenes reuse and read back their own grid). */
  private turned: Cells | undefined
  /** Called with each scene as it's built (the adapter resumes the balloon's altitude there). */
  onMake?: (style: SceneName, scene: Scene) => void
  /**
   * Where this driver's scenes take their seeds from: the adapter sets it from the clock, so each session's
   * scenes start their own way (0: makeScene's own counter).
   */
  seedBase = 0
  private made = 0

  constructor(
    readonly cfg: FlowConfig,
    readonly activity: Activity,
  ) {}

  /** The scene showing: the configured one, or the session's pick when it's random. */
  get sceneName(): SceneName {
    return this.cfg.style === 'random' ? this.pick : this.cfg.style
  }

  /** The scene for the configured style. */
  get scene(): Scene {
    return this.sceneFor(this.sceneName)
  }

  /** The one instance of a style, built on first use. */
  sceneFor(style: SceneName): Scene {
    let f = this.scenes.get(style)
    if (!f) {
      this.scenes.set(style, (f = makeScene(style, this.seedBase ? (this.seedBase + 7919 * this.made++) % 2147483647 : undefined)))
      this.onMake?.(style, f)
    }
    return f
  }

  /** The instance of a style if it's been built, without building it. */
  built(style: SceneName): Scene | undefined {
    return this.scenes.get(style)
  }

  /** Apply settings changes here at once (the caller saves and redraws). */
  apply(changes: Partial<FlowConfig>): void {
    Object.assign(this.cfg, changes)
  }

  /** The hue the colour setting asks for: a named one, the session's pick, or none (natural). */
  targetHue(): number | undefined {
    const c = this.cfg.color
    if (c === 'natural') return undefined
    if (c === 'random') return this.pickHue
    return HUES[c]
  }

  /** The palette for the scene showing: its hue turned toward the target, as far as it allows. */
  currentPalette(): Palette {
    const scene = this.sceneName
    const target = this.targetHue()
    const key = `${scene}:${target ?? ''}`
    if (key !== this.paletteKey) {
      this.paletteKey = key
      this.palette = paletteToward(sceneHue(scene), target)
    }
    return this.palette
  }

  /** What shows now, in words: the scene and its colour. */
  shown(): Shown {
    return { scene: this.sceneName, palette: this.currentPalette().name }
  }

  /** The level now: the manual setting, or what the work's activity calls for (faded, with fade on). */
  level(): number {
    const { cfg, activity } = this
    if (cfg.mode === 'manual') return cfg.level
    return cfg.fade === 'on' ? activity.strengthFaded(cfg.idle) : activity.strength(cfg.idle)
  }

  /** Whether the scene should show at all right now (dark idle gives the rows back). */
  isShown(): boolean {
    const { cfg, activity } = this
    if (this.external) return false
    if (cfg.mode === 'manual') return cfg.level > 0
    return cfg.idle > 0 || activity.isWorking || activity.isGlowing || (cfg.fade === 'on' && activity.isFading)
  }

  isNight(): boolean {
    return isNightAt(this.cfg.time, this.clock.hour)
  }

  /** The tint auto mode shows (a failure, a nearly-full context), or none in manual. */
  tint(): Scene['tint'] {
    return this.cfg.mode === 'auto' ? this.activity.tint : 'normal'
  }

  /** Whether auto mode shows Claude waiting on the person (a dialog is up for them); never in manual, as with the tints. */
  waiting(): boolean {
    return this.cfg.mode === 'auto' && this.activity.isAwaitingPerson
  }

  /** How long until the next frame: calm scenes (low, untinted) step slower. */
  pace(): number {
    const f = this.scene
    return f.strength <= 1 && f.tint === 'normal' ? CALM_MS : FRAME_MS
  }

  /** Point the current scene at this frame's dials, returning it. */
  dial(): Scene {
    const f = this.scene
    f.strength = this.level()
    // The subagents show in manual too: holding a level holds how busy it looks, not who's about.
    f.coverageBoost = this.activity.coverageBoost
    // Each subagent on its own, for the scenes that give each a companion.
    f.agents = this.activity.roster.dials()
    f.tint = this.tint()
    f.night = this.isNight()
    f.waiting = this.waiting()
    return f
  }

  /**
   * The current frame's cells in the session's colour: what every adapter
   * draws. Natural, or while the context-full tint shows (it must read as
   * blue), the scene's own grid.
   */
  cells(): Cells {
    const f = this.scene
    const grid = f.grid()
    const palette = this.currentPalette()
    if (palette.isNatural || f.tint === 'blue' || f.waiting) return grid
    let out = this.turned
    if (!out || out.columns !== grid.columns || out.rows !== grid.rows) out = this.turned = new Cells(grid.columns, grid.rows)
    return palette.apply(grid, out)
  }

  /** `cells()` encoded as Raster cells, for Claude Code's terminal. */
  frame(): string {
    return this.cells().encode()
  }
}
