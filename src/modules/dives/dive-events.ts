export type DiveEventKind = 'gas_switch' | 'alert' | 'marker'

/**
 * Plain-language labels for the alerts a Garmin dive computer raises (FIT
 * `dive_alert`). Dismissals are bookkeeping, not events, and are dropped.
 */
export const GARMIN_DIVE_ALERT_LABELS: Record<string, string> = {
  ndlReached: 'No-deco limit reached',
  gasSwitchPrompted: 'Gas switch prompted',
  nearSurface: 'Near surface',
  approachingNdl: 'Approaching no-deco limit',
  po2Warn: 'ppO₂ warning',
  po2CritHigh: 'ppO₂ critically high',
  po2CritLow: 'ppO₂ critically low',
  timeAlert: 'Time alert',
  depthAlert: 'Depth alert',
  decoCeilingBroken: 'Deco ceiling broken',
  decoComplete: 'Decompression complete',
  safetyStopBroken: 'Safety stop broken',
  safetyStopComplete: 'Safety stop complete',
  safetyStopStarted: 'Safety stop started',
  cnsWarning: 'CNS warning',
  cnsCritical: 'CNS critical',
  otuWarning: 'OTU warning',
  otuCritical: 'OTU critical',
  ascentCritical: 'Ascent rate critical',
  batteryLow: 'Battery low',
  batteryCritical: 'Battery critical',
  approachingFirstDecoStop: 'Approaching first deco stop',
  setpointSwitchAutoLow: 'Setpoint switched to low',
  setpointSwitchAutoHigh: 'Setpoint switched to high',
  setpointSwitchManualLow: 'Setpoint switched to low',
  setpointSwitchManualHigh: 'Setpoint switched to high',
  autoSetpointSwitchIgnored: 'Automatic setpoint switch ignored',
  switchedToOpenCircuit: 'Switched to open circuit',
  switchedToClosedCircuit: 'Switched to closed circuit',
  tankBatteryLow: 'Transmitter battery low',
  po2CcrDilLow: 'Diluent ppO₂ low',
  decoStopCleared: 'Deco stop cleared',
  apneaNeutralBuoyancy: 'Neutral buoyancy depth',
  apneaTargetDepth: 'Target depth reached',
  apneaSurface: 'Surfaced',
  apneaHighSpeed: 'Ascent too fast',
  apneaLowSpeed: 'Ascent too slow',
}

const DISMISSALS = new Set(['alertDismissedByKey', 'alertDismissedByTimeout'])

/** Alerts that mean something went wrong, shown with the warning treatment. */
export const CRITICAL_DIVE_EVENT_CODES = new Set([
  'ascentCritical',
  'decoCeilingBroken',
  'safetyStopBroken',
  'po2CritHigh',
  'po2CritLow',
  'cnsCritical',
  'otuCritical',
  'batteryCritical',
  'po2CcrDilLow',
])

export function isGarminAlertDismissal(code: string) {
  return DISMISSALS.has(code)
}

export function garminAlertLabel(code: string) {
  return (
    GARMIN_DIVE_ALERT_LABELS[code] ??
    code
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/^./, (letter) => letter.toUpperCase())
  )
}

export function isCriticalDiveEvent(event: { kind: DiveEventKind; code: string }) {
  return event.kind === 'alert' && CRITICAL_DIVE_EVENT_CODES.has(event.code)
}
