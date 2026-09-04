import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { parseDiveMateDiveTeam } from '@/modules/divemate/dive-team'
import { decompressionFromTags, entryTypeFromTags } from './mapping'
import type {
  SubsurfaceCylinder,
  SubsurfaceDive,
  SubsurfaceLogbook,
  SubsurfacePerson,
  SubsurfaceSample,
  SubsurfaceSite,
} from './types'
import {
  parseBar,
  parseCelsius,
  parseDurationSeconds,
  parseGps,
  parseInteger,
  parseIsoDate,
  parseIsoTime,
  parseKilograms,
  parseLiters,
  parseMeters,
  parsePercent,
  parseRating,
  parseSalinity,
} from './units'

type Attributes = Record<string, string>

interface XmlElement {
  name: string
  attributes: Attributes
  children: XmlElement[]
  text: string
}

// Subsurface taxonomy categories (core/taxonomy.h).
const TAXONOMY_OCEAN = 1
const TAXONOMY_COUNTRY = 2
const TAXONOMY_ADMIN_L1 = 3

const FRESH_WATER_MAX_SALINITY = 1010
const MANUAL_DIVE_COMPUTER = /manually added dive|imported from csv/i

export class SubsurfaceParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SubsurfaceParseError'
  }
}

function toElement(name: string, node: Record<string, unknown>): XmlElement {
  const rawChildren = node[name]
  const attributes = (node[':@'] as Attributes | undefined) ?? {}
  const children: XmlElement[] = []
  let text = ''
  if (Array.isArray(rawChildren)) {
    for (const child of rawChildren as Array<Record<string, unknown>>) {
      if (typeof child['#text'] === 'string' || typeof child['#text'] === 'number') {
        text += String(child['#text'])
        continue
      }
      const childName = Object.keys(child).find((key) => key !== ':@')
      if (childName) children.push(toElement(childName, child))
    }
  }
  return { name, attributes, children, text: text.trim() }
}

function parseDocument(xml: string): XmlElement {
  if (/<!DOCTYPE/i.test(xml)) {
    throw new SubsurfaceParseError('Subsurface files must not declare a DOCTYPE')
  }
  const validation = XMLValidator.validate(xml)
  if (validation !== true) {
    throw new SubsurfaceParseError(
      `The file is not well-formed XML: ${validation.err.msg}`,
    )
  }
  const parser = new XMLParser({
    preserveOrder: true,
    ignoreAttributes: false,
    attributeNamePrefix: '',
    parseTagValue: false,
    parseAttributeValue: false,
    trimValues: false,
    processEntities: true,
    ignoreDeclaration: true,
    ignorePiTags: true,
    commentPropName: '#comment',
  })
  const nodes = parser.parse(xml) as Array<Record<string, unknown>>
  const rootNode = nodes.find((node) => {
    const key = Object.keys(node).find((candidate) => candidate !== ':@')
    return key !== undefined && key !== '#comment' && key !== '#text'
  })
  const rootName = rootNode
    ? Object.keys(rootNode).find((candidate) => candidate !== ':@')
    : undefined
  if (!rootNode || !rootName) {
    throw new SubsurfaceParseError('The file does not contain an XML document')
  }
  return toElement(rootName, rootNode)
}

function child(element: XmlElement, name: string) {
  return element.children.find((candidate) => candidate.name === name)
}

function childrenNamed(element: XmlElement, name: string) {
  return element.children.filter((candidate) => candidate.name === name)
}

function text(value: string | undefined | null) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function normalizeName(value: string) {
  return value.trim().replaceAll(/\s+/g, ' ').toLocaleLowerCase('en-US')
}

function coordinateName(latitude: number, longitude: number) {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

interface DiveComputerData {
  model: string | null
  maximumDepthMeters: number | null
  averageDepthMeters: number | null
  airTemperatureCelsius: number | null
  waterTemperatureCelsius: number | null
  salinity: number | null
  events: XmlElement[]
  samples: XmlElement[]
  hasContent: boolean
}

function emptyDiveComputer(): DiveComputerData {
  return {
    model: null,
    maximumDepthMeters: null,
    averageDepthMeters: null,
    airTemperatureCelsius: null,
    waterTemperatureCelsius: null,
    salinity: null,
    events: [],
    samples: [],
    hasContent: false,
  }
}

/**
 * Elements a dive computer block may contain. Legacy files place them directly
 * inside `<dive>`; Subsurface stores those in its first dive computer.
 */
function fillDiveComputer(target: DiveComputerData, element: XmlElement) {
  switch (element.name) {
    case 'depth':
      target.maximumDepthMeters = parseMeters(element.attributes.max)
      target.averageDepthMeters = parseMeters(element.attributes.mean)
      target.hasContent = true
      return true
    case 'temperature':
      target.airTemperatureCelsius = parseCelsius(element.attributes.air)
      target.waterTemperatureCelsius = parseCelsius(element.attributes.water)
      target.hasContent = true
      return true
    case 'water':
      target.salinity = parseSalinity(element.attributes.salinity)
      target.hasContent = true
      return true
    case 'event':
      target.events.push(element)
      target.hasContent = true
      return true
    case 'sample':
      target.samples.push(element)
      target.hasContent = true
      return true
    case 'surface':
    case 'surfacetime':
    case 'extradata':
    case 'tanksensormapping':
      target.hasContent = true
      return true
    default:
      return false
  }
}

function parseCylinder(element: XmlElement, sortOrder: number): SubsurfaceCylinder {
  const attributes = element.attributes
  return {
    sortOrder,
    description: text(attributes.description),
    volumeLiters: parseLiters(attributes.size),
    workingPressureBar: parseBar(attributes.workpressure),
    startPressureBar: parseBar(attributes.start),
    endPressureBar: parseBar(attributes.end),
    oxygenPercent: parsePercent(attributes.o2),
    heliumPercent: parsePercent(attributes.he),
  }
}

function mixMatches(
  cylinder: SubsurfaceCylinder,
  oxygenPercent: number,
  heliumPercent: number,
) {
  const o2 = cylinder.oxygenPercent ?? 21
  const he = cylinder.heliumPercent ?? 0
  return Math.round(o2) === oxygenPercent && Math.round(he) === heliumPercent
}

interface GasChange {
  elapsedSeconds: number
  cylinderIndex: number
}

function parseGasChanges(events: XmlElement[], cylinders: SubsurfaceCylinder[]) {
  const changes: GasChange[] = []
  for (const event of events) {
    if (event.attributes.name !== 'gaschange') continue
    const elapsedSeconds = parseDurationSeconds(event.attributes.time) ?? 0
    const explicitIndex = parseInteger(event.attributes.cylinder)
    let cylinderIndex: number | null = null
    if (
      explicitIndex !== null &&
      explicitIndex >= 0 &&
      explicitIndex < cylinders.length
    ) {
      cylinderIndex = explicitIndex
    } else {
      const oxygen = parsePercent(event.attributes.o2)
      const helium = parsePercent(event.attributes.he) ?? 0
      const value = parseInteger(event.attributes.value)
      // Older files encode the mix in `value`: O2 in the low 16 bits, He above.
      let oxygenPercent: number | null = null
      let heliumPercent = 0
      if (oxygen !== null) {
        oxygenPercent = Math.round(oxygen)
        heliumPercent = Math.round(helium)
      } else if (value !== null) {
        oxygenPercent = value & 0xffff
        heliumPercent = value >> 16
      }
      if (oxygenPercent !== null) {
        cylinderIndex = cylinders.findIndex((cylinder) =>
          mixMatches(cylinder, oxygenPercent, heliumPercent),
        )
        if (cylinderIndex < 0) cylinderIndex = null
      }
    }
    if (cylinderIndex !== null) changes.push({ elapsedSeconds, cylinderIndex })
  }
  return changes.sort((left, right) => left.elapsedSeconds - right.elapsedSeconds)
}

function activeCylinder(changes: GasChange[], elapsedSeconds: number) {
  let active = 0
  for (const change of changes) {
    if (change.elapsedSeconds > elapsedSeconds) break
    active = change.cylinderIndex
  }
  return active
}

function parseSamples(
  elements: XmlElement[],
  cylinders: SubsurfaceCylinder[],
  gasChanges: GasChange[],
  oxygenCylinderIndex: number,
): SubsurfaceSample[] {
  const samples: SubsurfaceSample[] = []
  // Subsurface starts every sample as a copy of the previous one, except for
  // pressures, so temperature and deco state carry forward when omitted.
  let temperature: number | null = null
  let inDeco = false
  let stopDepth: number | null = null
  let lastElapsed = -1

  for (const element of elements) {
    const attributes = element.attributes
    const elapsedSeconds = parseDurationSeconds(attributes.time ?? attributes.sampletime)
    const depthMeters = parseMeters(attributes.depth)
    if (elapsedSeconds === null || depthMeters === null || elapsedSeconds < lastElapsed) {
      continue
    }
    lastElapsed = elapsedSeconds

    const sampledTemperature = parseCelsius(attributes.temp ?? attributes.temperature)
    if (sampledTemperature !== null) temperature = sampledTemperature
    if (attributes.in_deco !== undefined) inDeco = attributes.in_deco === '1'
    if (attributes.stopdepth !== undefined) stopDepth = parseMeters(attributes.stopdepth)

    const pressures = new Map<number, number>()
    const sensorIndex = parseInteger(attributes.sensor ?? attributes.cylinderindex) ?? 0
    const primary = parseBar(
      attributes.pressure ?? attributes.cylpress ?? attributes.pdiluent,
    )
    if (primary !== null && primary > 0) pressures.set(sensorIndex, primary)
    const oxygen = parseBar(attributes.o2pressure)
    if (oxygen !== null && oxygen > 0) pressures.set(oxygenCylinderIndex, oxygen)
    for (let index = 0; index < 5; index += 1) {
      const value = parseBar(attributes[`pressure${index}`])
      if (value !== null && value > 0) pressures.set(index, value)
    }

    const active = activeCylinder(gasChanges, elapsedSeconds)
    const singleReading = pressures.size === 1 ? [...pressures.values()][0] : undefined
    samples.push({
      elapsedSeconds,
      depthMeters,
      temperatureCelsius: temperature,
      pressureBar: pressures.get(active) ?? singleReading ?? null,
      tank1PressureBar: pressures.get(0) ?? null,
      tank2PressureBar: pressures.get(1) ?? null,
      decoCeilingMeters: inDeco && stopDepth !== null && stopDepth > 0 ? stopDepth : null,
      tankNumber: gasChanges.length > 0 && cylinders.length > 0 ? active + 1 : null,
    })
  }
  return samples
}

function splitNames(value: string | null) {
  if (!value) return []
  return value
    .split(/[,;]|\r?\n/)
    .map((part) => part.trim().replaceAll(/\s+/g, ' '))
    .filter(Boolean)
}

function parsePeople(dive: XmlElement): SubsurfacePerson[] {
  const people = new Map<string, SubsurfacePerson>()
  const add = (person: SubsurfacePerson) => {
    const key = `${person.role}:${normalizeName(person.name)}`
    if (!people.has(key)) people.set(key, person)
  }
  for (const element of childrenNamed(dive, 'buddy')) {
    for (const name of splitNames(text(element.text))) add({ name, role: 'buddy' })
  }
  // Subsurface has one free-text guide field; Divetracx encodes roles into it
  // on export, so untagged names default to the element's historic meaning.
  for (const element of childrenNamed(dive, 'divemaster')) {
    for (const member of parseDiveMateDiveTeam(text(element.text))) add(member)
  }
  for (const element of childrenNamed(dive, 'diveguide')) {
    const value = text(element.text)
    const tagged = /^(divemaster|instructor|guide)\s*:/i.test(value ?? '')
    for (const member of parseDiveMateDiveTeam(value)) {
      add(tagged ? member : { ...member, role: 'guide' })
    }
  }
  return [...people.values()]
}

function parseTags(value: string | undefined) {
  if (!value) return []
  const seen = new Set<string>()
  const tags: string[] = []
  for (const tag of value.split(',')) {
    const trimmed = tag.trim().replaceAll(/\s+/g, ' ')
    const key = trimmed.toLocaleLowerCase('en-US')
    if (!trimmed || seen.has(key)) continue
    seen.add(key)
    tags.push(trimmed)
  }
  return tags
}

class SiteRegistry {
  readonly sites = new Map<string, SubsurfaceSite>()

  register(site: SubsurfaceSite) {
    const existing = this.sites.get(site.externalId)
    if (!existing) {
      this.sites.set(site.externalId, site)
      return site.externalId
    }
    existing.latitude ??= site.latitude
    existing.longitude ??= site.longitude
    existing.country ??= site.country
    existing.region ??= site.region
    existing.waterName ??= site.waterName
    existing.notes ??= site.notes
    return existing.externalId
  }

  fromDivesite(element: XmlElement) {
    const uuid = text(element.attributes.uuid)?.toLowerCase()
    const gps = parseGps(element.attributes.gps)
    const name = text(element.attributes.name)
    if (!uuid || (!name && !gps)) return null
    let country: string | null = null
    let region: string | null = null
    let ocean: string | null = null
    for (const geo of childrenNamed(element, 'geo')) {
      const category = parseInteger(geo.attributes.cat)
      const value = text(geo.attributes.value)
      if (!value) continue
      if (category === TAXONOMY_COUNTRY) country = value
      else if (category === TAXONOMY_ADMIN_L1) region = value
      else if (category === TAXONOMY_OCEAN) ocean = value
    }
    const notes = [
      text(child(element, 'notes')?.text),
      text(element.attributes.description),
    ]
      .filter((part): part is string => Boolean(part))
      .join('\n\n')
    return this.register({
      externalId: uuid,
      name: name ?? coordinateName(gps?.latitude ?? 0, gps?.longitude ?? 0),
      latitude: gps?.latitude ?? null,
      longitude: gps?.longitude ?? null,
      country,
      region,
      waterName: ocean,
      notes: notes || null,
    })
  }

  /** Legacy files describe the site inside each dive instead of by reference. */
  fromLegacyDive(dive: XmlElement) {
    let name: string | null = null
    let gps: ReturnType<typeof parseGps> = null
    for (const element of childrenNamed(dive, 'location')) {
      name ??= text(element.text)
      gps ??= parseGps(element.attributes.gps)
    }
    for (const element of childrenNamed(dive, 'gps')) gps ??= parseGps(element.text)
    if (!name && !gps) return null
    const externalId = name
      ? `name:${normalizeName(name)}`
      : `gps:${gps?.latitude},${gps?.longitude}`
    return this.register({
      externalId,
      name: name ?? coordinateName(gps?.latitude ?? 0, gps?.longitude ?? 0),
      latitude: gps?.latitude ?? null,
      longitude: gps?.longitude ?? null,
      country: null,
      region: null,
      waterName: null,
      notes: null,
    })
  }
}

function parseDive(
  element: XmlElement,
  registry: SiteRegistry,
  knownSiteIds: Set<string>,
): SubsurfaceDive | null {
  const attributes = element.attributes
  const diveDate = parseIsoDate(attributes.date)
  if (!diveDate) return null
  const entryTime = parseIsoTime(attributes.time)

  const computers: DiveComputerData[] = [emptyDiveComputer()]
  const cylinders: SubsurfaceCylinder[] = []
  let weightKg: number | null = null
  let userAirTemperature: number | null = null
  let userWaterTemperature: number | null = null

  for (const node of element.children) {
    if (node.name === 'divecomputer') {
      const first = computers[0]
      // A `<divecomputer>` merges into the implicit first computer while that
      // one is still empty, exactly like Subsurface's reader.
      const target =
        computers.length === 1 && first && !first.hasContent && first.model === null
          ? first
          : emptyDiveComputer()
      if (target !== first) computers.push(target)
      target.model = text(node.attributes.model)
      target.hasContent = true
      for (const inner of node.children) fillDiveComputer(target, inner)
      continue
    }
    const implicit = computers[0]
    if (implicit && fillDiveComputer(implicit, node)) continue
    if (node.name === 'cylinder') {
      cylinders.push(parseCylinder(node, cylinders.length))
    } else if (node.name === 'weightsystem') {
      const weight = parseKilograms(node.attributes.weight)
      if (weight !== null && weight > 0) weightKg = (weightKg ?? 0) + weight
    } else if (node.name === 'divetemperature') {
      userAirTemperature = parseCelsius(node.attributes.air)
      userWaterTemperature = parseCelsius(node.attributes.water)
    }
  }

  const primary = computers[0] ?? emptyDiveComputer()
  const sampleSource =
    computers.find((computer) => computer.samples.length > 0) ?? primary
  const oxygenCylinderIndex = Math.max(
    cylinders.findIndex((cylinder) => (cylinder.oxygenPercent ?? 0) >= 99),
    1,
  )
  const gasChanges = parseGasChanges(sampleSource.events, cylinders)
  const samples = parseSamples(
    sampleSource.samples,
    cylinders,
    gasChanges,
    oxygenCylinderIndex,
  )
  const sampleDepths = samples.map((sample) => sample.depthMeters)
  const sampleTemperatures = samples.flatMap((sample) =>
    sample.temperatureCelsius === null ? [] : [sample.temperatureCelsius],
  )

  const siteReference = text(attributes.divesiteid)?.toLowerCase()
  let siteExternalId: string | null =
    siteReference && knownSiteIds.has(siteReference) ? siteReference : null
  siteExternalId ??= registry.fromLegacyDive(element)

  const salinity = parseSalinity(attributes.watersalinity) ?? primary.salinity
  const model = computers.map((computer) => computer.model).find(Boolean) ?? null
  const isManual = model === null || MANUAL_DIVE_COMPUTER.test(model)
  const durationSeconds =
    parseDurationSeconds(attributes.duration) ?? samples.at(-1)?.elapsedSeconds ?? 0
  const number = parseInteger(attributes.number)
  const tags = parseTags(attributes.tags)

  return {
    externalId: `${diveDate}T${entryTime ?? '00:00:00'}`,
    number: number !== null && number > 0 ? number : null,
    diveDate,
    entryTime,
    durationSeconds,
    maximumDepthMeters:
      primary.maximumDepthMeters ??
      sampleSource.maximumDepthMeters ??
      (sampleDepths.length > 0 ? Math.max(...sampleDepths) : null),
    averageDepthMeters: primary.averageDepthMeters ?? sampleSource.averageDepthMeters,
    airTemperatureCelsius: userAirTemperature ?? primary.airTemperatureCelsius,
    waterTemperatureCelsius:
      userWaterTemperature ??
      primary.waterTemperatureCelsius ??
      (sampleTemperatures.length > 0 ? Math.min(...sampleTemperatures) : null),
    weightKg,
    rating: parseRating(attributes.rating),
    visibility: parseRating(attributes.visibility),
    waterType: salinity === null ? null : salinity <= FRESH_WATER_MAX_SALINITY ? 2 : 1,
    entryType: entryTypeFromTags(tags),
    tags,
    suit: text(child(element, 'suit')?.text ?? child(element, 'divesuit')?.text),
    computer: isManual ? null : model,
    notes: text(child(element, 'notes')?.text),
    decompressionDive:
      decompressionFromTags(tags) ||
      samples.some((sample) => sample.decoCeilingMeters !== null),
    siteExternalId,
    people: parsePeople(element),
    cylinders,
    samples,
  }
}

function collectDives(
  container: XmlElement,
  into: XmlElement[],
  trips: { count: number },
) {
  for (const node of container.children) {
    if (node.name === 'dive') into.push(node)
    else if (node.name === 'trip') {
      trips.count += 1
      collectDives(node, into, trips)
    }
  }
}

export function parseSubsurfaceLogbook(xml: string): SubsurfaceLogbook {
  const root = parseDocument(xml)
  let formatVersion: number
  let divesContainer: XmlElement
  if (root.name === 'divelog') {
    if (text(root.attributes.program)?.toLowerCase() !== 'subsurface') {
      throw new SubsurfaceParseError(
        'The <divelog> element was not written by Subsurface',
      )
    }
    formatVersion = parseInteger(root.attributes.version) ?? 2
    divesContainer = child(root, 'dives') ?? { ...root, children: [] }
  } else if (root.name === 'dives') {
    const program = child(root, 'program')
    if (program && text(program.attributes.name)?.toLowerCase() !== 'subsurface') {
      throw new SubsurfaceParseError('The <dives> element was not written by Subsurface')
    }
    formatVersion = parseInteger(program?.attributes.version) ?? 1
    divesContainer = root
  } else if (root.name === 'uddf') {
    throw new SubsurfaceParseError(
      'This is a UDDF file; export the logbook from Subsurface as .ssrf or .xml instead',
    )
  } else {
    throw new SubsurfaceParseError(
      `Expected a Subsurface <divelog> document but found <${root.name}>`,
    )
  }

  const registry = new SiteRegistry()
  const knownSiteIds = new Set<string>()
  const divesites = root.name === 'divelog' ? child(root, 'divesites') : undefined
  for (const site of divesites ? childrenNamed(divesites, 'site') : []) {
    const id = registry.fromDivesite(site)
    if (id) knownSiteIds.add(id)
  }

  const diveElements: XmlElement[] = []
  const trips = { count: 0 }
  collectDives(divesContainer, diveElements, trips)

  const dives: SubsurfaceDive[] = []
  const identities = new Map<string, number>()
  let divesSkipped = 0
  for (const element of diveElements) {
    const dive = parseDive(element, registry, knownSiteIds)
    if (!dive) {
      divesSkipped += 1
      continue
    }
    // Subsurface has no dive identifier; the start instant is the closest
    // stable key, disambiguated for duplicates within one file.
    const occurrences = (identities.get(dive.externalId) ?? 0) + 1
    identities.set(dive.externalId, occurrences)
    if (occurrences > 1) dive.externalId = `${dive.externalId}#${occurrences}`
    dives.push(dive)
  }

  return {
    formatVersion,
    sites: [...registry.sites.values()],
    dives,
    diagnostics: { divesSkipped, tripsSeen: trips.count },
  }
}
