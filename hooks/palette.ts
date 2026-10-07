// REVISION: flow-v1-palettes
//
// A colour for each session: the same scene in another hue (a violet fire, an
// azure one, a crimson one), so sessions side by side tell apart. A palette
// turns every colour of a finished frame around the hue wheel by one angle,
// in OKLCH: lightness and chroma stay, so the scene keeps its shape and its
// contrast, and only its hue moves (pulled back into sRGB where a hue has no
// such colour). The terminal's own colour and greys (smoke, snow, steel) are
// left as they are. A scene says which hue it mostly is and how far it may
// turn (`SceneDef.hue`): a fire turns any way; a sky only a little, and only
// the colours near its own (the sky and the sea turn; the balloon, the flame
// and the skier keep theirs). Pure.

import { type Cells, DEFAULT_COLOR } from './cells'

/** Colours closer to grey than this (OKLCH chroma) keep their colour. */
const GREY = 0.02
/** Memoized colours a palette keeps before starting afresh (scenes quantize, so few). */
const MEMO = 4096

/** The hues by name, around the OKLCH wheel (degrees). */
export const HUES = {
  rose: 0,
  crimson: 25,
  ember: 50,
  amber: 70,
  gold: 95,
  lime: 125,
  jade: 155,
  teal: 185,
  cyan: 210,
  azure: 240,
  blue: 265,
  indigo: 285,
  violet: 305,
  magenta: 335,
} as const
export type HueName = keyof typeof HUES
export const HUE_NAMES = Object.keys(HUES) as HueName[]

/** A hue by name, or undefined. */
export function hueNamed(s: unknown): HueName | undefined {
  return typeof s === 'string' && (HUE_NAMES as readonly string[]).includes(s) ? (s as HueName) : undefined
}

/** The nearest named hue to an angle. */
export function hueName(deg: number): HueName {
  let best: HueName = 'rose'
  let gap = Infinity
  for (const name of HUE_NAMES) {
    const d = Math.abs(wrap(deg - HUES[name]))
    if (d < gap) {
      gap = d
      best = name
    }
  }
  return best
}

/** An angle folded into -180..180. */
export function wrap(deg: number): number {
  const d = (((deg + 180) % 360) + 360) % 360
  return d - 180
}

const toLinear = (c: number) => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}
const toByte = (v: number) => {
  const s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055
  return Math.round(Math.max(0, Math.min(1, s)) * 255)
}

/** 0xRRGGBB to OKLab. */
export function oklab(color: number): [number, number, number] {
  const r = toLinear((color >> 16) & 255)
  const g = toLinear((color >> 8) & 255)
  const b = toLinear(color & 255)
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** OKLab to linear sRGB (may fall outside 0..1). */
function linearOf(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ]
}

const inGamut = ([r, g, b]: [number, number, number]) => r >= -1e-4 && r <= 1.0001 && g >= -1e-4 && g <= 1.0001 && b >= -1e-4 && b <= 1.0001

/** OKLCH (hue in degrees) to 0xRRGGBB, chroma pulled in until the colour exists in sRGB. */
export function fromOklch(L: number, C: number, h: number): number {
  const rad = (h * Math.PI) / 180
  const ca = Math.cos(rad)
  const sa = Math.sin(rad)
  let rgb = linearOf(L, C * ca, C * sa)
  if (!inGamut(rgb)) {
    let lo = 0
    let hi = C
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2
      if (inGamut(linearOf(L, mid * ca, mid * sa))) lo = mid
      else hi = mid
    }
    rgb = linearOf(L, lo * ca, lo * sa)
  }
  return (toByte(rgb[0]) << 16) | (toByte(rgb[1]) << 8) | toByte(rgb[2])
}

/** A colour's OKLCH chroma and hue (degrees). */
export function chromaHue(color: number): { chroma: number; hue: number } {
  const [, a, b] = oklab(color)
  return { chroma: Math.hypot(a, b), hue: ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360 }
}

/** The hue of the most colourful of these (0xRRGGBB), or undefined when they're all near grey. */
export function hueOf(colors: readonly number[]): number | undefined {
  let best: { chroma: number; hue: number } | undefined
  for (const c of colors) {
    const ch = chromaHue(c)
    if (!best || ch.chroma > best.chroma) best = ch
  }
  return best && best.chroma >= GREY * 2 ? best.hue : undefined
}

/**
 * How a scene takes a palette: its own main hue (OKLCH degrees), how far
 * around the wheel it may turn, and (`spread`) how near its main hue a colour
 * must be to turn at all; none: every colour turns.
 */
export type SceneHue = { key: number; range: number; spread?: number }

/** Past `spread`, a colour's turn fades out over this many degrees. */
const SPREAD_FADE = 30

/** A turn of the hue wheel for every colour of a frame. */
export class Palette {
  private readonly memo = new Map<number, number>()

  /** `shift` in degrees; `name` is what `/flow` calls it (`natural` for none); `near`: only colours near this hue turn. */
  constructor(
    readonly shift: number,
    readonly name: string,
    readonly near?: { key: number; spread: number },
  ) {}

  get isNatural(): boolean {
    return this.shift === 0
  }

  /** One colour turned (the terminal's own colour and greys as they are). */
  color(c: number): number {
    if (c === DEFAULT_COLOR || this.shift === 0) return c
    const hit = this.memo.get(c)
    if (hit !== undefined) return hit
    const [L, a, b] = oklab(c)
    const C = Math.hypot(a, b)
    let out = c
    if (C >= GREY) {
      const hue = (Math.atan2(b, a) * 180) / Math.PI
      let turn = this.shift
      if (this.near) {
        const off = Math.abs(wrap(hue - this.near.key)) - this.near.spread
        turn *= Math.max(0, Math.min(1, 1 - off / SPREAD_FADE))
      }
      if (Math.abs(turn) >= 0.5) out = fromOklch(L, C, hue + turn)
    }
    if (this.memo.size >= MEMO) this.memo.clear()
    this.memo.set(c, out)
    return out
  }

  /** `src` with every colour turned, written into `out` (the same size); `src` is untouched. */
  apply(src: Cells, out: Cells): Cells {
    const from = src.words
    const to = out.words
    for (let i = 0; i < from.length; i += 3) {
      to[i] = from[i]!
      to[i + 1] = this.color(from[i + 1]!)
      to[i + 2] = this.color(from[i + 2]!)
    }
    return out
  }
}

export const NATURAL = new Palette(0, 'natural')

/**
 * The palette that turns a scene toward a hue (degrees). A scene that turns
 * any way lands on it; one that turns less goes the same way, as far again
 * in proportion (a target halfway round turns it half its range), so every
 * target still gives each scene its own look. None: natural.
 */
export function paletteToward(scene: SceneHue, target: number | undefined): Palette {
  if (target === undefined) return NATURAL
  const shift = (wrap(target - scene.key) * scene.range) / 180
  if (Math.abs(shift) < 1) return NATURAL
  const near = scene.spread === undefined ? undefined : { key: scene.key, spread: scene.spread }
  return new Palette(shift, hueName(scene.key + shift), near)
}
