import { createHash } from 'node:crypto'
import { formatDiveMateDiveTeam } from '@/modules/divemate/dive-team'
import type { ExportSnapshot } from '@/modules/export/types'
import { tagsForExport } from './mapping'
import { formatGps, formatMilli, formatMinutes, formatPercent } from './units'

type Data = ExportSnapshot['data']
type Dive = Data['dives'][number]
type Tank = Data['tanks'][number]
type Sample = Data['diveProfileSamples'][number]

// Subsurface events (libdivecomputer's SAMPLE_EVENT_GASCHANGE2).
const GASCHANGE_EVENT_TYPE = 25
// Salinity values Subsurface itself uses for fresh and sea water.
const FRESH_WATER_SALINITY = '1000 g/l'
const SEA_WATER_SALINITY = '1030 g/l'

function attr(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll("'", '&apos;')
}

function attribute(name: string, value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return ''
  return ` ${name}='${attr(value)}'`
}

function element(name: string, value: string | null | undefined, indent: string) {
  if (!value) return []
  return [`${indent}<${name}>${attr(value)}</${name}>`]
}

/** Subsurface identifies sites with eight hex characters; derive them stably. */
function siteUuid(id: string) {
  return createHash('sha1').update(id).digest('hex').slice(0, 8)
}

function positive(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null
}

function nonNegative(value: string | number | null | undefined) {
  if (value === null || value === undefined) return null
  const numeric = Number(value)
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : null
}

function displayName(person: {
  firstName: string | null
  lastName: string | null
  email?: string | null
}) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
  return name || person.email || null
}

/** Divetracx keeps visibility as free text; "3/5" is how imports store Subsurface's 1-5 scale. */
function visibilityRating(value: string | null) {
  const match = /^\s*([1-5])\s*\/\s*5\s*$/.exec(value ?? '')
  return match?.[1] ? Number(match[1]) : null
}

function groupBy<T>(items: T[], key: (item: T) => string) {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const group = groups.get(key(item)) ?? []
    group.push(item)
    groups.set(key(item), group)
  }
  return groups
}

function sortedTanks(tanks: Tank[]) {
  return tanks
    .slice()
    .sort(
      (left, right) =>
        (left.sortOrder ?? 0) - (right.sortOrder ?? 0) ||
        (left.computerTankNumber ?? 0) - (right.computerTankNumber ?? 0),
    )
}

function cylinderXml(tank: Tank) {
  const volume = positive(tank.volumeLiters)
  const workingPressure = positive(tank.workingPressureBar)
  const start = positive(tank.startPressureBar)
  const end = nonNegative(tank.endPressureBar)
  const oxygen = positive(tank.oxygenPercent)
  const helium = positive(tank.heliumPercent)
  return `  <cylinder${attribute('size', volume === null ? null : formatMilli(volume, 'l'))}${attribute(
    'workpressure',
    workingPressure === null ? null : formatMilli(workingPressure, 'bar'),
  )}${attribute('description', tank.name)}${attribute(
    'o2',
    oxygen === null ? null : formatPercent(oxygen),
  )}${attribute('he', oxygen !== null && helium !== null ? formatPercent(helium) : null)}${attribute(
    'start',
    start === null ? null : formatMilli(start, 'bar'),
  )}${attribute('end', end === null ? null : formatMilli(end, 'bar'))} />`
}

/**
 * Divetracx stores which tank a sample was breathed from; Subsurface expects
 * gas-change events instead, so a change of tank between samples becomes one.
 */
function gasChangeEvents(samples: Sample[], tanks: Tank[]) {
  if (tanks.length < 2) return []
  const events: string[] = []
  let current: number | null = null
  for (const sample of samples) {
    const tankNumber = sample.tankNumber
    if (tankNumber === null || tankNumber === current) continue
    const cylinderIndex = tanks.findIndex(
      (tank) => tank.computerTankNumber === tankNumber,
    )
    const index = cylinderIndex >= 0 ? cylinderIndex : tankNumber - 1
    if (index < 0 || index >= tanks.length) continue
    if (current !== null || sample.elapsedSeconds > 0 || index !== 0) {
      const tank = tanks[index]
      const oxygen = positive(tank?.oxygenPercent)
      const helium = positive(tank?.heliumPercent)
      events.push(
        `  <event time='${formatMinutes(sample.elapsedSeconds)}' type='${GASCHANGE_EVENT_TYPE}' name='gaschange' cylinder='${index}'${attribute(
          'o2',
          oxygen === null ? null : formatPercent(oxygen),
        )}${attribute('he', oxygen !== null && helium !== null ? formatPercent(helium) : null)} />`,
      )
    }
    current = tankNumber
  }
  return events
}

function sampleXml(samples: Sample[], tanks: Tank[]) {
  const lines: string[] = []
  let lastTemperature: number | null = null
  let lastPressure = new Map<number, number>()
  let lastCeiling: number | null = null
  const sensorFor = (tankNumber: number) => {
    const index = tanks.findIndex((tank) => tank.computerTankNumber === tankNumber)
    return index >= 0 ? index : tankNumber - 1
  }
  for (const sample of samples) {
    let line = `  <sample time='${formatMinutes(sample.elapsedSeconds)}' depth='${formatMilli(sample.depthMeters, 'm')}'`
    const temperature =
      positive(sample.temperatureCelsius) ?? nonNegative(sample.temperatureCelsius)
    if (temperature !== null && temperature !== lastTemperature) {
      line += ` temp='${Number(temperature).toFixed(1)} C'`
      lastTemperature = temperature
    }
    const pressures = new Map<number, number>()
    const tank1 = positive(sample.tank1PressureBar)
    const tank2 = positive(sample.tank2PressureBar)
    const active = positive(sample.pressureBar)
    if (tank1 !== null) pressures.set(sensorFor(1), tank1)
    if (tank2 !== null) pressures.set(sensorFor(2), tank2)
    if (active !== null && pressures.size === 0) {
      pressures.set(sample.tankNumber === null ? 0 : sensorFor(sample.tankNumber), active)
    }
    for (const [sensor, pressure] of [...pressures].sort(([a], [b]) => a - b)) {
      if (sensor < 0 || lastPressure.get(sensor) === pressure) continue
      line += ` pressure${sensor}='${formatMilli(pressure, 'bar')}'`
    }
    lastPressure = pressures
    const ceiling = positive(sample.decoCeilingMeters)
    if (ceiling !== lastCeiling) {
      line += ` in_deco='${ceiling === null ? 0 : 1}'`
      line += ` stopdepth='${formatMilli(ceiling ?? 0, 'm')}'`
      lastCeiling = ceiling
    }
    lines.push(`${line} />`)
  }
  return lines
}

function diveXml(
  dive: Dive,
  lookups: {
    tanks: Map<string, Tank[]>
    samples: Map<string, Sample[]>
    buddies: Map<string, Data['diveBuddies']>
    people: Map<string, Data['buddies'][number]>
    diveTypes: Map<string, string>
    siteIds: Set<string>
  },
) {
  const tanks = sortedTanks(lookups.tanks.get(dive.id) ?? [])
  const samples = (lookups.samples.get(dive.id) ?? [])
    .slice()
    .sort(
      (left, right) =>
        left.elapsedSeconds - right.elapsedSeconds ||
        left.sampleIndex - right.sampleIndex,
    )
  const relations = lookups.buddies.get(dive.id) ?? []
  const buddyNames = relations
    .filter((relation) => relation.role === 'buddy')
    .flatMap((relation) => {
      const person = lookups.people.get(relation.buddyId)
      const name = person ? displayName(person) : null
      return name ? [name] : []
    })
  const staff = relations.flatMap((relation) => {
    if (relation.role === 'buddy') return []
    const person = lookups.people.get(relation.buddyId)
    const name = person ? displayName(person) : null
    return name ? [{ name, role: relation.role }] : []
  })
  // Subsurface's field is a plain divemaster name; other roles need a label so
  // the import recognises them again.
  const divemaster = staff.every((member) => member.role === 'divemaster')
    ? staff.map((member) => member.name).join(', ') || null
    : formatDiveMateDiveTeam(staff)
  const visibility = visibilityRating(dive.visibility)
  const tags = tagsForExport({
    diveTypeName: dive.diveTypeId
      ? (lookups.diveTypes.get(dive.diveTypeId) ?? null)
      : null,
    entryType: dive.entryType,
    decompressionDive: dive.decompressionDive,
  })
  const maximumDepth = positive(dive.maximumDepthMeters)
  const averageDepth = positive(dive.averageDepthMeters)
  const sampleDepths = samples.map((sample) => Number(sample.depthMeters))
  const depthMax =
    maximumDepth ?? (sampleDepths.length > 0 ? Math.max(...sampleDepths) : null)
  const airTemperature = dive.airTemperatureCelsius
  const waterTemperature = dive.waterTemperatureCelsius
  const weight = positive(dive.weightKg)
  const siteId = dive.siteId && lookups.siteIds.has(dive.siteId) ? dive.siteId : null

  const diveAttributes =
    attribute('number', dive.number !== null && dive.number > 0 ? dive.number : null) +
    attribute('rating', dive.rating !== null && dive.rating > 0 ? dive.rating : null) +
    attribute('visibility', visibility) +
    attribute('tags', tags.length > 0 ? tags.join(', ') : null) +
    attribute('divesiteid', siteId ? siteUuid(siteId) : null) +
    attribute(
      'watersalinity',
      dive.waterType === 2
        ? FRESH_WATER_SALINITY
        : dive.waterType === 1
          ? SEA_WATER_SALINITY
          : null,
    ) +
    attribute('date', dive.diveDate) +
    attribute('time', dive.entryTime ?? '00:00:00') +
    attribute(
      'duration',
      dive.durationSeconds > 0 ? formatMinutes(dive.durationSeconds) : null,
    )

  const notes = [
    dive.notes,
    dive.visibility && visibility === null ? `Visibility: ${dive.visibility}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
  const hasComputerBlock =
    depthMax !== null ||
    averageDepth !== null ||
    airTemperature !== null ||
    waterTemperature !== null ||
    samples.length > 0

  return [
    `<dive${diveAttributes}>`,
    ...element('divemaster', divemaster, '  '),
    ...element('buddy', buddyNames.length > 0 ? buddyNames.join(', ') : null, '  '),
    ...element('notes', notes || null, '  '),
    ...element('suit', dive.suit, '  '),
    ...tanks.map(cylinderXml),
    ...(weight === null
      ? []
      : [
          `  <weightsystem weight='${formatMilli(weight, 'kg')}' description='weight' />`,
        ]),
    ...(hasComputerBlock
      ? [
          `  <divecomputer${attribute('model', dive.computer ?? (dive.captureSource === 'manual' ? 'manually added dive' : null))}>`,
          ...(depthMax !== null || averageDepth !== null
            ? [
                `  <depth${attribute('max', depthMax === null ? null : formatMilli(depthMax, 'm'))}${attribute(
                  'mean',
                  averageDepth === null ? null : formatMilli(averageDepth, 'm'),
                )} />`,
              ]
            : []),
          ...(airTemperature !== null || waterTemperature !== null
            ? [
                `  <temperature${attribute(
                  'air',
                  airTemperature === null
                    ? null
                    : `${Number(airTemperature).toFixed(1)} C`,
                )}${attribute(
                  'water',
                  waterTemperature === null
                    ? null
                    : `${Number(waterTemperature).toFixed(1)} C`,
                )} />`,
              ]
            : []),
          ...gasChangeEvents(samples, tanks),
          ...sampleXml(samples, tanks),
          '  </divecomputer>',
        ]
      : []),
    '</dive>',
  ]
}

export function buildSubsurfaceExport(snapshot: ExportSnapshot) {
  const { data } = snapshot
  const usedSiteIds = new Set(
    data.dives.flatMap((dive) => (dive.siteId ? [dive.siteId] : [])),
  )
  const sites = data.diveSites
    .filter((site) => usedSiteIds.has(site.id))
    .sort((left, right) => siteUuid(left.id).localeCompare(siteUuid(right.id)))
  const siteIds = new Set(sites.map((site) => site.id))

  const sitesXml = sites.flatMap((site) => {
    const latitude = site.latitude === null ? null : Number(site.latitude)
    const longitude = site.longitude === null ? null : Number(site.longitude)
    const hasGps =
      latitude !== null &&
      longitude !== null &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      !(latitude === 0 && longitude === 0)
    return [
      `<site uuid='${siteUuid(site.id)}'${attribute('name', site.name)}${attribute(
        'gps',
        hasGps ? formatGps(latitude, longitude) : null,
      )}>`,
      ...element('notes', site.notes, '  '),
      ...(site.waterName
        ? [`  <geo cat='1' origin='2' value='${attr(site.waterName)}'/>`]
        : []),
      ...(site.country
        ? [`  <geo cat='2' origin='2' value='${attr(site.country)}'/>`]
        : []),
      ...(site.region
        ? [`  <geo cat='3' origin='2' value='${attr(site.region)}'/>`]
        : []),
      '</site>',
    ]
  })

  const lookups = {
    tanks: groupBy(data.tanks, (tank) => tank.diveId),
    samples: groupBy(data.diveProfileSamples, (sample) => sample.diveId),
    buddies: groupBy(data.diveBuddies, (relation) => relation.diveId),
    people: new Map(data.buddies.map((buddy) => [buddy.id, buddy])),
    diveTypes: new Map(data.diveTypes.map((type) => [type.id, type.name])),
    siteIds,
  }
  const divesXml = data.dives
    .slice()
    .sort(
      (left, right) =>
        left.diveDate.localeCompare(right.diveDate) ||
        (left.entryTime ?? '').localeCompare(right.entryTime ?? '') ||
        (left.number ?? 0) - (right.number ?? 0),
    )
    .flatMap((dive) => diveXml(dive, lookups))

  return [
    "<divelog program='subsurface' version='3'>",
    '<settings>',
    '</settings>',
    '<divesites>',
    ...sitesXml,
    '</divesites>',
    '<dives>',
    ...divesXml,
    '</dives>',
    '</divelog>',
    '',
  ].join('\n')
}
