// REVISION: flow-v1-pick
//
// Leaving the scene or its colour to chance (`/flow random`, `/flow color
// random`): each session opening draws from a shuffle bag kept where every
// session sees it, so sessions opened one after another each get another
// until every one has had its turn; a fresh bag never starts with the one
// just drawn. What a session drew is kept for its life (a settings reload
// carries on with it). Pure.

import { HUES, HUE_NAMES } from './palette'
import { STYLES, styleNamed, type SceneName } from './styles'

/** A bag as stored: what's left to draw this round, and the last drawn. */
export type Bag<T extends string> = { left: T[]; last?: T }

/** What a session drew: its scene, and the hue `color: random` turns it to (OKLCH degrees). */
export type SessionPick = { scene: SceneName; hue: number }

/** A stored bag, validated against what can be drawn (anything else is dropped). */
export function readBag<T extends string>(stored: unknown, all: readonly T[]): Bag<T> {
  const o = stored && typeof stored === 'object' ? (stored as Record<string, unknown>) : {}
  const known = (v: unknown): v is T => typeof v === 'string' && (all as readonly string[]).includes(v)
  const left = Array.isArray(o.left) ? [...new Set(o.left.filter(known))] : []
  return known(o.last) ? { left, last: o.last } : { left }
}

/**
 * Draw one (`r` in 0..1) from the bag: the pick and the bag to keep. An empty
 * bag refills with everything, the last drawn held back until after this draw.
 */
export function draw<T extends string>(bag: Bag<T>, all: readonly T[], r: number): { pick: T; bag: Bag<T> } {
  let left = bag.left
  let held: T | undefined
  if (!left.length) {
    left = all.filter(v => v !== bag.last)
    if (left.length && left.length < all.length) held = bag.last
    if (!left.length) left = [...all]
  }
  const i = Math.max(0, Math.min(left.length - 1, Math.floor(r * left.length)))
  const pick = left[i]!
  const rest = left.filter((_, j) => j !== i)
  if (held !== undefined) rest.push(held)
  return { pick, bag: { left: rest, last: pick } }
}

/** Draw a session's scene and hue from the two bags (`r1`, `r2` in 0..1), answering the bags to keep. */
export function drawSession(
  scenes: unknown,
  hues: unknown,
  r1: number,
  r2: number,
): { pick: SessionPick; scenes: Bag<SceneName>; hues: Bag<string> } {
  const s = draw(readBag(scenes, STYLES), STYLES, r1)
  const h = draw(readBag(hues, HUE_NAMES), HUE_NAMES, r2)
  return { pick: { scene: s.pick, hue: HUES[h.pick as keyof typeof HUES] }, scenes: s.bag, hues: h.bag }
}

/** A kept pick, validated (anything else: none, so the session draws afresh). */
export function readPick(v: unknown): SessionPick | undefined {
  if (!v || typeof v !== 'object') return undefined
  const o = v as Record<string, unknown>
  const scene = typeof o.scene === 'string' ? styleNamed(o.scene) : undefined
  if (!scene || typeof o.hue !== 'number' || !Number.isFinite(o.hue)) return undefined
  return { scene, hue: o.hue }
}
