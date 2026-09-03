import '@tanstack/react-start/server-only'

import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import diverFallbackImage from '@/assets/diver-fallback.png?inline'
import { getStorage } from '@/lib/storage'
import { formatPersonName } from '@/modules/dives/format'
import { agencyCatalog, agencyInitials } from '@/modules/profile/agency-catalog'
import { loadProfile } from './queries.server'

const CARD_WIDTH = 1200
const CARD_HEIGHT = 630

function xml(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function compact(value: string, maximum = 34) {
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized.length > maximum
    ? `${normalized.slice(0, maximum - 1).trimEnd()}…`
    : normalized
}

function formatHours(seconds: number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(
    seconds / 3600,
  )
}

function skillFontSize(label: string) {
  const widthInEms = [...label].reduce((width, character) => {
    if (/\s/.test(character)) return width + 0.3
    if (/[MW@%&]/.test(character)) return width + 0.9
    if (/[A-Z]/.test(character)) return width + 0.67
    if (/[ilI1|.,'!:;]/.test(character)) return width + 0.3
    return width + 0.56
  }, 0)
  if (widthInEms === 0) return 18
  return Math.min(18, Math.floor((255 / widthInEms) * 0.94 * 10) / 10)
}

async function profileImageData(storagePath: string | null | undefined) {
  if (!storagePath) return null
  const storage = getStorage()
  if (!(await storage.exists(storagePath))) return null
  const blob = await storage.download(storagePath)
  const sharp = (await import('sharp')).default
  const image = await sharp(Buffer.from(await blob.arrayBuffer()))
    .rotate()
    .resize(300, 300, { fit: 'cover' })
    .png()
    .toBuffer()
  return `data:image/png;base64,${image.toString('base64')}`
}

async function agencyLogoData(source: string | null) {
  if (!source) return null
  let bytes: Uint8Array

  if (source.startsWith('/')) {
    const relativePath = source.slice(1)
    if (relativePath.includes('..')) return null
    const candidates = [
      resolve(process.cwd(), 'public', relativePath),
      resolve(process.cwd(), '.output/public', relativePath),
    ]
    const local = await Promise.allSettled(candidates.map((path) => readFile(path)))
    const match = local.find((result) => result.status === 'fulfilled')
    if (match?.status !== 'fulfilled') return null
    bytes = match.value
  } else {
    const approvedSource = agencyCatalog.some((agency) => agency.logoSrc === source)
    if (!approvedSource) return null
    const response = await fetch(source, {
      redirect: 'error',
      signal: AbortSignal.timeout(3_000),
    }).catch(() => null)
    if (!response?.ok) return null
    bytes = new Uint8Array(await response.arrayBuffer())
  }

  const sharp = (await import('sharp')).default
  const logo = await sharp(bytes)
    .resize(64, 64, {
      fit: 'contain',
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer()
    .catch(() => null)
  return logo ? `data:image/png;base64,${logo.toString('base64')}` : null
}

function certificationPills(
  certifications: Array<{
    name: string
    certifiedAt: string | null
    featuredOnCard: boolean
  }>,
) {
  const visible = [...certifications]
    .filter((certification) => certification.featuredOnCard)
    .sort((left, right) =>
      (right.certifiedAt ?? '').localeCompare(left.certifiedAt ?? ''),
    )
    .slice(0, 8)
  const columns = visible.length < 4 ? 1 : 2
  const pills = visible.map((certification, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const label = certification.name.trim()
    const fontSize = skillFontSize(label)
    return `
      <g transform="translate(${450 + column * 335} ${225 + row * 55})">
        <rect width="315" height="42" rx="21" fill="#ffffff" fill-opacity="0.1" stroke="#82d9dc" stroke-opacity="0.4" />
        <circle cx="23" cy="21" r="5" fill="#56d6d4" />
        <text x="42" y="27" class="skill" font-size="${fontSize}" clip-path="url(#skillLabel)">${xml(label)}</text>
      </g>`
  })

  return pills.join('')
}

async function agencyMembershipBadges(
  memberships: Array<{
    memberNumber: string
    agency: { name: string; logoSrc: string | null; darkLogo: boolean }
  }>,
) {
  const visible = memberships.slice(0, 4)
  const logos = await Promise.all(
    visible.map((membership) => agencyLogoData(membership.agency.logoSrc)),
  )
  return visible
    .map((membership, index) => {
      const logo = logos[index]
      const column = index % 2
      const row = Math.floor(index / 2)
      const agencyName = compact(membership.agency.name, 11)
      const logoContent = logo
        ? `<image href="${logo}" x="5" y="5" width="34" height="34" preserveAspectRatio="xMidYMid meet" clip-path="url(#agencyLogo)" />`
        : `<text x="22" y="26" text-anchor="middle" class="membershipFallback">${xml(agencyInitials(membership.agency.name))}</text>`
      return `
        <g transform="translate(${80 + column * 155} ${468 + row * 54})">
          <rect width="145" height="44" rx="12" fill="#ffffff" fill-opacity="0.95" />
          <rect x="5" y="5" width="34" height="34" rx="8" fill="${membership.agency.darkLogo ? '#132833' : '#ffffff'}" stroke="#d3e1e2" />
          ${logoContent}
          <text x="47" y="18" class="membershipAgency">${xml(agencyName)}</text>
          <text x="47" y="34" class="membershipNumber">${xml(compact(membership.memberNumber, 12))}</text>
        </g>`
    })
    .join('')
}

export async function renderProfileCard() {
  const profile = await loadProfile()
  const { diver, logbook, certifications, agencyMemberships } = profile
  const name = diver ? formatPersonName(diver) : 'Divetracx Diver'
  const imageData = await profileImageData(
    profile.profileImage?.thumbnailStoragePath ?? profile.profileImage?.storagePath,
  )
  const since = logbook.firstDiveDate
    ? new Date(`${logbook.firstDiveDate}T00:00:00Z`).getUTCFullYear().toString()
    : '—'
  const depth = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 1,
  }).format(logbook.maximumDepthMeters)
  const photo = imageData
    ? `<image href="${imageData}" x="80" y="110" width="300" height="300" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)" />`
    : `<image href="${diverFallbackImage}" x="80" y="110" width="300" height="300" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)" />`
  const skills = certificationPills(certifications)
  const memberships = await agencyMembershipBadges(agencyMemberships)
  const skillHeading = certifications.length
    ? `${certifications.length} certification${certifications.length === 1 ? '' : 's'}`
    : 'No certifications added yet'
  const insuranceDetails = diver
    ? [
        diver.insurance,
        diver.insuranceTariff,
        diver.insuranceNumber ? `Policy ${diver.insuranceNumber}` : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const insurance = insuranceDetails
    ? `Insurance: ${compact(insuranceDetails, 74)}`
    : null
  const emergencyDetails = diver
    ? [diver.emergencyContact, diver.emergencyPhone, diver.emergencyEmail]
        .filter(Boolean)
        .join(' · ')
    : ''
  const emergencyContact = emergencyDetails
    ? `Emergency: ${compact(emergencyDetails, 74)}`
    : null

  const svg = `
    <svg width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="ocean" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#092d39" />
          <stop offset="0.52" stop-color="#07576a" />
          <stop offset="1" stop-color="#087f8c" />
        </linearGradient>
        <linearGradient id="avatarGradient" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="#38bfc2" />
          <stop offset="1" stop-color="#0a4557" />
        </linearGradient>
        <clipPath id="avatar"><circle cx="230" cy="260" r="150" /></clipPath>
        <clipPath id="agencyLogo" clipPathUnits="userSpaceOnUse"><rect x="5" y="5" width="34" height="34" rx="8" /></clipPath>
        <clipPath id="skillLabel" clipPathUnits="userSpaceOnUse"><rect x="42" y="0" width="255" height="42" /></clipPath>
        <style>
          text { font-family: "DejaVu Sans", sans-serif; fill: #f3ffff; }
          .brand { font-size: 22px; font-weight: 700; letter-spacing: 5px; }
          .name { font-size: 52px; font-weight: 700; letter-spacing: -1px; }
          .eyebrow { font-size: 16px; font-weight: 700; letter-spacing: 3px; fill: #8ce7e6; }
          .skill { font-weight: 600; }
          .statValue { font-size: 31px; font-weight: 700; }
          .statLabel { font-size: 13px; font-weight: 700; letter-spacing: 2px; fill: #9edbdc; }
          .footer { font-size: 16px; fill: #c6eeee; }
          .membershipAgency { font-size: 11px; font-weight: 700; fill: #093743; }
          .membershipNumber { font-size: 10px; font-weight: 600; fill: #456269; }
          .membershipFallback { font-size: 10px; font-weight: 700; fill: #087f8c; }
        </style>
      </defs>
      <rect width="1200" height="630" rx="38" fill="url(#ocean)" />
      <circle cx="1130" cy="-20" r="250" fill="#6ce3df" fill-opacity="0.07" />
      <circle cx="1080" cy="590" r="170" fill="#ffffff" fill-opacity="0.04" />
      <path d="M0 535 C250 475 330 620 610 550 C820 498 980 505 1200 555 L1200 630 L0 630 Z" fill="#021c27" fill-opacity="0.34" />

      <g transform="translate(920 55)">
        <path d="M18 16H26L25 27L22 37L18 40L20 28Z M22 2L17 -5L11 1L-3 -2L2 11L13 23L19 20L22 15L25 20L31 23L42 11L47 -2L33 1L27 -5Z" fill="#8ce7e6" transform="translate(4 5) scale(.72)" />
        <text x="57" y="27" class="brand">DIVETRACX</text>
      </g>

      <circle cx="230" cy="260" r="158" fill="none" stroke="#9ff3ef" stroke-width="3" stroke-opacity="0.7" />
      ${photo}
      ${memberships}

      <text x="450" y="102" class="eyebrow">DIVER SKILLSET</text>
      <text x="450" y="164" class="name">${xml(compact(name, 25))}</text>
      <text x="450" y="202" class="footer">${xml(skillHeading)}</text>
      ${skills}

      <g transform="translate(450 500)">
        <g><text class="statValue">${logbook.totalDives.toLocaleString('en-US')}</text><text y="28" class="statLabel">DIVES</text></g>
        <g transform="translate(205 0)"><text class="statValue">${formatHours(logbook.totalSeconds)} h</text><text y="28" class="statLabel">BOTTOM TIME</text></g>
        <g transform="translate(440 0)"><text class="statValue">${depth} m</text><text y="28" class="statLabel">MAX DEPTH</text></g>
      </g>
      <text x="80" y="596" class="footer">Diving since ${since}</text>
      ${emergencyContact ? `<text x="450" y="576" class="footer">${xml(emergencyContact)}</text>` : ''}
      ${insurance ? `<text x="450" y="602" class="footer">${xml(insurance)}</text>` : ''}
    </svg>`

  const sharp = (await import('sharp')).default
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
}
