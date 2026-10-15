// REVISION: flow-v186-upstream-merge

/** The balloon's altitude in world rows, kept across the reload a setting change causes. */
export type BalloonAltitude = number

/** The scene and hue this session drew for `random` (hooks/pick.ts), kept across reloads. */
export type ScenePick = { scene: string; hue: number }

declare module 'claude-code' {
  interface PluginState {
    'flow-scenes': {
      altitude: BalloonAltitude
      pick: ScenePick | null
      /** Someone has been seen at the session (a key, a turn, a `/flow`): only then is the soundscape heard. */
      present: boolean
    }
  }
}
