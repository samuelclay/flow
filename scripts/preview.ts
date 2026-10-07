// REVISION: flow-v82-box-hue
//
// Prints scenes into this terminal the way Flow draws them: the band at
// levels 1, 5 and 10 with each tint, then the spine the same way side by side,
// by day and (for a scene with one) by night. Not part of the mod (Node).
//
//   npm run preview -- surf               one scene (or several, or none for all)
//   npm run preview -- surf --night       only night;  --day only day
//   npm run preview -- surf --levels 3,7  other levels
//   npm run preview -- surf --band        only the band;  --spine only the spine
//   npm run preview -- surf --box         crabigator's column, at its sizes
//   npm run preview -- fire --hue violet  in a colour (a name, or degrees)

import { gridToAnsi } from '../pi/ansi'
import { BAND, BOXES, blurbOf, build, hueArg, nightsOf, scenesFrom, SPINE, TINTS, turned } from './scene-lab'

const argv = process.argv.slice(2)
const opt = (name: string) => {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : undefined
}
const levelsArg = opt('--levels')
const levels = levelsArg ? levelsArg.split(',').map(Number) : [1, 5, 10]
const hueText = opt('--hue')
const hue = hueArg(hueText)
const rest = argv.filter((a, i) => !((a === levelsArg && argv[i - 1] === '--levels') || (a === hueText && argv[i - 1] === '--hue')))
const width = Math.max(40, Math.min(250, (process.stdout.columns || 120) - 2))
const onlyBox = rest.includes('--box')
const showBand = !onlyBox && !rest.includes('--spine')
const showSpine = !onlyBox && !rest.includes('--band')
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`

for (const scene of scenesFrom(rest)) {
  console.log(`\n\x1b[1m${scene}\x1b[0m ${dim(`— ${blurbOf(scene)}`)}`)
  for (const night of nightsOf(scene)) {
    if (night ? rest.includes('--day') : rest.includes('--night')) continue
    const when = night ? 'night' : 'day'
    if (showBand) {
      for (const level of levels) {
        for (const tint of TINTS) {
          console.log(dim(`band ${width}×${BAND.rows} · level ${level} · ${when} · ${tint}`))
          for (const line of gridToAnsi(turned(scene, build(scene, width, BAND.rows, { level, night, tint }).grid(), hue))) console.log(line)
        }
      }
    }
    if (showSpine) {
      // Every level × tint as a spine, side by side, as many as fit across.
      const panels = levels.flatMap(level => TINTS.map(tint => ({ level, tint })))
      const per = Math.max(1, Math.floor((width + 2) / (SPINE.columns + 2)))
      for (let at = 0; at < panels.length; at += per) {
        const row = panels.slice(at, at + per)
        console.log(dim(row.map(p => `${p.level} ${p.tint}`.padEnd(SPINE.columns + 2)).join('') + `(spine ${SPINE.columns}×${SPINE.rows}, ${when})`))
        const grids = row.map(p => gridToAnsi(turned(scene, build(scene, SPINE.columns, SPINE.rows, { ...p, night }).grid(), hue)))
        for (let r = 0; r < SPINE.rows; r++) console.log(grids.map(g => g[r]).join('  '))
      }
    }
    if (onlyBox) {
      // crabigator's column at each of its sizes, every level side by side (the tints, a row each).
      for (const box of BOXES) {
        for (const tint of TINTS) {
          const per = Math.max(1, Math.floor((width + 2) / (box.columns + 2)))
          const shown = levels.slice(0, per)
          console.log(dim(`box ${box.columns}×${box.rows} · levels ${shown.join(', ')} · ${when} · ${tint}${hueText ? ` · ${hueText}` : ''}`))
          const grids = shown.map(level => gridToAnsi(turned(scene, build(scene, box.columns, box.rows, { level, night, tint }).grid(), hue)))
          for (let r = 0; r < box.rows; r++) console.log(grids.map(g => g[r]).join('  '))
        }
      }
    }
  }
}
