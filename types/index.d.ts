// REVISION: flow-v60-session-pick

/** The balloon's altitude in world rows, kept across the reload a setting change causes. */
export type BalloonAltitude = number

/** The scene and hue this session drew for `random` (hooks/pick.ts), kept across reloads. */
export type ScenePick = { scene: string; hue: number }

declare module 'claude-code' {
  interface PluginState {
    flow: {
      altitude: BalloonAltitude
      pick: ScenePick | null
    }
  }
}
