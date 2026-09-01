import {
  Camera,
  Fish,
  Gauge,
  GraduationCap,
  LifeBuoy,
  type LucideIcon,
  Moon,
  Mountain,
  MountainSnow,
  Search,
  Ship,
  Snowflake,
  Timer,
  Users,
  Waves,
} from 'lucide-react'

// Dive type names come from DiveMate and are free-form (often German), so the
// icon is picked by keyword. Unmatched types fall back to the generic fish.
const iconMatchers: Array<[RegExp, LucideIcon]> = [
  [/nacht|night/i, Moon],
  [/wrack|wreck/i, Ship],
  [/eis|ice/i, Snowflake],
  [/foto|photo/i, Camera],
  [/höhle|hoehle|cave|grotte|cavern/i, Mountain],
  [/bergsee|altitude|mountain/i, MountainSnow],
  [/apnoe|apnea|freedive/i, Timer],
  [/rettung|rescue/i, LifeBuoy],
  [/such|search|bergung|recovery/i, Search],
  [
    /ausbildung|training|schüler|schueler|student|prüfung|pruefung|exam|kurs|course/i,
    GraduationCap,
  ],
  [/gruppe|group|führung|fuehrung|guide/i, Users],
  [/tief|deep/i, Gauge],
  [/strömung|stroemung|current|fluss|fluß|river|drift/i, Waves],
]

export function diveTypeIcon(diveTypeName: string | null | undefined): LucideIcon {
  if (diveTypeName) {
    for (const [pattern, icon] of iconMatchers) {
      if (pattern.test(diveTypeName)) return icon
    }
  }
  return Fish
}
