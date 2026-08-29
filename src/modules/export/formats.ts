import type { ExportSnapshot } from './types'

const CSV_FORMULA_PREFIX = /^[\t\r\n ]*[=+\-@]/

function stringifyJsonValue(_key: string, value: unknown) {
  return value instanceof Date ? value.toISOString() : value
}

function csvCell(value: unknown, protectText = false) {
  let content = value === null || value === undefined ? '' : String(value)
  if (protectText && CSV_FORMULA_PREFIX.test(content)) {
    content = `'${content}`
  }
  return `"${content.replaceAll('"', '""')}"`
}

function displayName(
  person: { firstName: string | null; lastName: string | null; email?: string | null },
  fallback: string,
) {
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ').trim()
  return name || person.email || fallback
}

function tankSummary(tank: ExportSnapshot['data']['tanks'][number]) {
  const parts = [tank.name || 'Tank']
  if (tank.computerTankNumber !== null) {
    parts.push(`channel ${tank.computerTankNumber}`)
  }
  if (tank.volumeLiters) parts.push(`${tank.volumeLiters} L`)
  if (tank.startPressureBar || tank.endPressureBar) {
    parts.push(`${tank.startPressureBar ?? '?'}-${tank.endPressureBar ?? '?'} bar`)
  }
  if (tank.oxygenPercent) parts.push(`${tank.oxygenPercent}% O2`)
  if (tank.heliumPercent && Number(tank.heliumPercent) > 0) {
    parts.push(`${tank.heliumPercent}% He`)
  }
  return parts.join(' · ')
}

function xml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function xmlId(prefix: string, value: string) {
  return `${prefix}-${value.replaceAll(/[^A-Za-z0-9_.-]/g, '-')}`
}

function diveDateTime(
  diveDate: string,
  entryTime: string | null,
  utcOffsetMinutes: number | null,
) {
  const time = entryTime || '00:00:00'
  if (utcOffsetMinutes === null) return `${diveDate}T${time}`

  const sign = utcOffsetMinutes < 0 ? '-' : '+'
  const absoluteMinutes = Math.abs(utcOffsetMinutes)
  const hours = String(Math.floor(absoluteMinutes / 60)).padStart(2, '0')
  const minutes = String(absoluteMinutes % 60).padStart(2, '0')
  return `${diveDate}T${time}${sign}${hours}:${minutes}`
}

function kelvin(celsius: string) {
  return (Number(celsius) + 273.15).toFixed(2)
}

export function buildJsonExport(snapshot: ExportSnapshot) {
  return `${JSON.stringify(snapshot, stringifyJsonValue, 2)}\n`
}

export function buildCsvExport(snapshot: ExportSnapshot) {
  const { data } = snapshot
  const sites = new Map(data.diveSites.map((site) => [site.id, site]))
  const shops = new Map(data.shops.map((shop) => [shop.id, shop]))
  const diveTypes = new Map(data.diveTypes.map((type) => [type.id, type]))
  const buddies = new Map(data.buddies.map((buddy) => [buddy.id, buddy]))
  const equipment = new Map(data.equipment.map((item) => [item.id, item]))

  const buddyIdsByDive = new Map<string, string[]>()
  for (const relation of data.diveBuddies) {
    const ids = buddyIdsByDive.get(relation.diveId) ?? []
    ids.push(relation.buddyId)
    buddyIdsByDive.set(relation.diveId, ids)
  }

  const equipmentIdsByDive = new Map<string, string[]>()
  for (const relation of data.diveEquipment) {
    const ids = equipmentIdsByDive.get(relation.diveId) ?? []
    ids.push(relation.equipmentId)
    equipmentIdsByDive.set(relation.diveId, ids)
  }

  const tanksByDive = new Map<string, ExportSnapshot['data']['tanks']>()
  for (const tank of data.tanks) {
    const diveTanks = tanksByDive.get(tank.diveId) ?? []
    diveTanks.push(tank)
    tanksByDive.set(tank.diveId, diveTanks)
  }

  const profileSamplesByDive = new Map<
    string,
    ExportSnapshot['data']['diveProfileSamples']
  >()
  for (const sample of data.diveProfileSamples) {
    const samples = profileSamplesByDive.get(sample.diveId) ?? []
    samples.push(sample)
    profileSamplesByDive.set(sample.diveId, samples)
  }

  const headers = [
    'dive_number',
    'date',
    'entry_time',
    'utc_offset_minutes',
    'duration_seconds',
    'duration_minutes',
    'maximum_depth_meters',
    'average_depth_meters',
    'site',
    'country',
    'region',
    'water',
    'latitude',
    'longitude',
    'dive_type',
    'dive_shop',
    'air_temperature_celsius',
    'water_temperature_celsius',
    'weight_kg',
    'visibility',
    'current',
    'waves',
    'weather',
    'rating',
    'computer',
    'suit',
    'boat',
    'divemaster',
    'buddies',
    'equipment',
    'tanks',
    'profile_sample_count',
    'profile_samples_seconds_depth_meters_temperature_celsius_pressure_bar_deco_ceiling_meters_tank_channel',
    'notes',
    'source',
    'source_id',
  ]

  const rows = data.dives
    .slice()
    .sort((left, right) => {
      const dateComparison = left.diveDate.localeCompare(right.diveDate)
      if (dateComparison !== 0) return dateComparison
      return (left.number ?? 0) - (right.number ?? 0)
    })
    .map((dive) => {
      const site = dive.siteId ? sites.get(dive.siteId) : undefined
      const buddyNames = (buddyIdsByDive.get(dive.id) ?? [])
        .map((id) => {
          const buddy = buddies.get(id)
          return buddy ? displayName(buddy, id) : id
        })
        .join('; ')
      const equipmentNames = (equipmentIdsByDive.get(dive.id) ?? [])
        .map((id) => {
          const item = equipment.get(id)
          if (!item) return id
          return [item.name, item.model].filter(Boolean).join(' · ')
        })
        .join('; ')
      const tankNames = (tanksByDive.get(dive.id) ?? [])
        .slice()
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
        .map(tankSummary)
        .join('; ')
      const profileSamples = (profileSamplesByDive.get(dive.id) ?? [])
        .slice()
        .sort(
          (left, right) =>
            left.elapsedSeconds - right.elapsedSeconds ||
            left.sampleIndex - right.sampleIndex,
        )

      return [
        csvCell(dive.number),
        csvCell(dive.diveDate),
        csvCell(dive.entryTime),
        csvCell(dive.utcOffsetMinutes),
        csvCell(dive.durationSeconds),
        csvCell((dive.durationSeconds / 60).toFixed(1)),
        csvCell(dive.maximumDepthMeters),
        csvCell(dive.averageDepthMeters),
        csvCell(site?.name, true),
        csvCell(site?.country, true),
        csvCell(site?.region, true),
        csvCell(site?.waterName, true),
        csvCell(site?.latitude),
        csvCell(site?.longitude),
        csvCell(dive.diveTypeId ? diveTypes.get(dive.diveTypeId)?.name : '', true),
        csvCell(dive.shopId ? shops.get(dive.shopId)?.name : '', true),
        csvCell(dive.airTemperatureCelsius),
        csvCell(dive.waterTemperatureCelsius),
        csvCell(dive.weightKg),
        csvCell(dive.visibility, true),
        csvCell(dive.current, true),
        csvCell(dive.waves, true),
        csvCell(dive.weather, true),
        csvCell(dive.rating),
        csvCell(dive.computer, true),
        csvCell(dive.suit, true),
        csvCell(dive.boat, true),
        csvCell(dive.divemaster, true),
        csvCell(buddyNames, true),
        csvCell(equipmentNames, true),
        csvCell(tankNames, true),
        csvCell(profileSamples.length),
        csvCell(
          profileSamples
            .map((sample) =>
              [
                sample.elapsedSeconds,
                sample.depthMeters,
                sample.temperatureCelsius ?? '',
                sample.pressureBar ?? '',
                sample.decoCeilingMeters ?? '',
                sample.tankNumber ?? '',
              ].join(':'),
            )
            .join(';'),
        ),
        csvCell(dive.notes, true),
        csvCell(dive.sourceKey, true),
        csvCell(dive.externalId, true),
      ].join(',')
    })

  return `\uFEFF${[headers.map((header) => csvCell(header)).join(','), ...rows].join('\r\n')}\r\n`
}

export function buildUddfExport(snapshot: ExportSnapshot) {
  const { data } = snapshot
  const diver = data.divers[0]
  const siteIds = new Set(
    data.dives.flatMap((dive) => (dive.siteId ? [dive.siteId] : [])),
  )
  const relevantSites = data.diveSites.filter((site) => siteIds.has(site.id))
  const profileSamplesByDive = new Map<
    string,
    ExportSnapshot['data']['diveProfileSamples']
  >()
  for (const sample of data.diveProfileSamples) {
    const samples = profileSamplesByDive.get(sample.diveId) ?? []
    samples.push(sample)
    profileSamplesByDive.set(sample.diveId, samples)
  }

  const diverXml = diver
    ? [
        '  <diver>',
        `    <owner id="${xmlId('diver', diver.id)}">`,
        '      <personal>',
        `        <firstname>${xml(diver.firstName)}</firstname>`,
        `        <lastname>${xml(diver.lastName)}</lastname>`,
        '      </personal>',
        '    </owner>',
        '  </diver>',
      ]
    : []

  const sitesXml = relevantSites.flatMap((site) => [
    `    <site id="${xmlId('site', site.id)}">`,
    `      <name>${xml(site.name)}</name>`,
    '      <geography>',
    `        <location>${xml(site.waterName || [site.region, site.country].filter(Boolean).join(', ') || site.name)}</location>`,
    ...(site.country
      ? [
          '        <address>',
          `          <country>${xml(site.country)}</country>`,
          ...(site.region ? [`          <province>${xml(site.region)}</province>`] : []),
          '        </address>',
        ]
      : []),
    ...(site.latitude ? [`        <latitude>${xml(site.latitude)}</latitude>`] : []),
    ...(site.longitude ? [`        <longitude>${xml(site.longitude)}</longitude>`] : []),
    '      </geography>',
    ...(site.notes
      ? ['      <notes>', `        <para>${xml(site.notes)}</para>`, '      </notes>']
      : []),
    '    </site>',
  ])

  const divesXml = data.dives
    .slice()
    .sort((left, right) => left.diveDate.localeCompare(right.diveDate))
    .flatMap((dive) => {
      const samples = (profileSamplesByDive.get(dive.id) ?? [])
        .slice()
        .sort(
          (left, right) =>
            left.elapsedSeconds - right.elapsedSeconds ||
            left.sampleIndex - right.sampleIndex,
        )
      return [
        `      <dive id="${xmlId('dive', dive.id)}">`,
        '        <informationbeforedive>',
        ...(dive.siteId ? [`          <link ref="${xmlId('site', dive.siteId)}"/>`] : []),
        ...(dive.number !== null && dive.number > 0
          ? [`          <divenumber>${dive.number}</divenumber>`]
          : []),
        `          <datetime>${xml(diveDateTime(dive.diveDate, dive.entryTime, dive.utcOffsetMinutes))}</datetime>`,
        ...(dive.airTemperatureCelsius
          ? [
              `          <airtemperature>${kelvin(dive.airTemperatureCelsius)}</airtemperature>`,
            ]
          : []),
        '        </informationbeforedive>',
        ...(samples.length > 0
          ? [
              '        <samples>',
              ...samples.flatMap((sample) => [
                '          <waypoint>',
                `            <divetime>${sample.elapsedSeconds}</divetime>`,
                `            <depth>${xml(sample.depthMeters)}</depth>`,
                '          </waypoint>',
              ]),
              '        </samples>',
            ]
          : []),
        '        <informationafterdive>',
        ...(dive.waterTemperatureCelsius
          ? [
              `          <lowesttemperature>${kelvin(dive.waterTemperatureCelsius)}</lowesttemperature>`,
            ]
          : []),
        `          <greatestdepth>${xml(dive.maximumDepthMeters ?? 0)}</greatestdepth>`,
        ...(dive.averageDepthMeters
          ? [`          <averagedepth>${xml(dive.averageDepthMeters)}</averagedepth>`]
          : []),
        `          <diveduration>${dive.durationSeconds}</diveduration>`,
        ...(dive.notes
          ? [
              '          <notes>',
              `            <para>${xml(dive.notes)}</para>`,
              '          </notes>',
            ]
          : []),
        '        </informationafterdive>',
        '      </dive>',
      ]
    })

  const profileXml =
    divesXml.length > 0
      ? [
          '  <profiledata>',
          '    <repetitiongroup id="divetracx-logbook">',
          ...divesXml,
          '    </repetitiongroup>',
          '  </profiledata>',
        ]
      : []

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<uddf xmlns="http://www.streit.cc/uddf/3.2/" version="3.2.3">',
    '  <generator>',
    '    <name>Divetracx</name>',
    '    <type>logbook</type>',
    '  </generator>',
    ...diverXml,
    '  <divesite>',
    ...sitesXml,
    '  </divesite>',
    ...profileXml,
    '</uddf>',
    '',
  ].join('\n')
}
