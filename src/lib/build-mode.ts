declare const __DIVETRACX_DEMO_MODE__: boolean

export const DEMO_MODE =
  typeof __DIVETRACX_DEMO_MODE__ === 'boolean' ? __DIVETRACX_DEMO_MODE__ : false
