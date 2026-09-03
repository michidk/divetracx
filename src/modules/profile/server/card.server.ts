import '@tanstack/react-start/server-only'

import { getStorage } from '@/lib/storage'
import { formatPersonName } from '@/modules/dives/format'
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

function initials(firstName?: string | null, lastName?: string | null) {
  return (
    `${firstName?.trim().charAt(0) ?? ''}${lastName?.trim().charAt(0) ?? ''}`.toUpperCase() ||
    'DX'
  )
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

function certificationPills(
  certifications: Array<{ name: string; certifiedAt: string | null }>,
) {
  const visible = [...certifications]
    .sort((left, right) =>
      (right.certifiedAt ?? '').localeCompare(left.certifiedAt ?? ''),
    )
    .slice(0, 4)
  const pills = visible.map((certification, index) => {
    const label = compact(certification.name, 29)
    return `
      <g transform="translate(450 ${245 + index * 55})">
        <rect width="660" height="42" rx="21" fill="#ffffff" fill-opacity="0.1" stroke="#82d9dc" stroke-opacity="0.4" />
        <circle cx="23" cy="21" r="5" fill="#56d6d4" />
        <text x="42" y="27" class="skill">${xml(label)}</text>
      </g>`
  })

  if (certifications.length > visible.length) {
    pills.push(`
      <text x="1090" y="${245 + (visible.length - 1) * 55 + 27}" text-anchor="end" class="more">+${certifications.length - visible.length} more</text>`)
  }
  return pills.join('')
}

export async function renderProfileCard() {
  const profile = await loadProfile()
  const { diver, logbook, certifications } = profile
  const name = diver ? formatPersonName(diver) : 'Divetracx Diver'
  const imageData = await profileImageData(
    profile.profileImage?.thumbnailStoragePath ?? profile.profileImage?.storagePath,
  )
  const since = logbook.firstDiveDate
    ? new Date(`${logbook.firstDiveDate}T00:00:00Z`).getUTCFullYear().toString()
    : '—'
  const depth = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(
    logbook.maximumDepthMeters,
  )
  const photo = imageData
    ? `<image href="${imageData}" x="80" y="145" width="300" height="300" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar)" />`
    : `<circle cx="230" cy="295" r="150" fill="url(#avatarGradient)" />
       <text x="230" y="325" text-anchor="middle" class="initials">${xml(initials(diver?.firstName, diver?.lastName))}</text>`
  const skills = certificationPills(certifications)
  const skillHeading = certifications.length
    ? `${certifications.length} certification${certifications.length === 1 ? '' : 's'}`
    : 'No certifications added yet'

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
        <clipPath id="avatar"><circle cx="230" cy="295" r="150" /></clipPath>
        <style>
          text { font-family: Manrope, Arial, sans-serif; fill: #f3ffff; }
          .brand { font-size: 22px; font-weight: 700; letter-spacing: 5px; }
          .name { font-size: 52px; font-weight: 700; letter-spacing: -1px; }
          .eyebrow { font-size: 16px; font-weight: 700; letter-spacing: 3px; fill: #8ce7e6; }
          .skill { font-size: 18px; font-weight: 600; }
          .more { font-size: 15px; font-weight: 600; fill: #bfe9e8; }
          .statValue { font-size: 31px; font-weight: 700; }
          .statLabel { font-size: 13px; font-weight: 700; letter-spacing: 2px; fill: #9edbdc; }
          .footer { font-size: 16px; fill: #c6eeee; }
          .initials { font-size: 88px; font-weight: 700; }
        </style>
      </defs>
      <rect width="1200" height="630" rx="38" fill="url(#ocean)" />
      <circle cx="1130" cy="-20" r="250" fill="#6ce3df" fill-opacity="0.07" />
      <circle cx="1080" cy="590" r="170" fill="#ffffff" fill-opacity="0.04" />
      <path d="M0 535 C250 475 330 620 610 550 C820 498 980 505 1200 555 L1200 630 L0 630 Z" fill="#021c27" fill-opacity="0.34" />

      <g transform="translate(80 55)">
        <path d="M18 16H26L25 27L22 37L18 40L20 28Z M22 2L17 -5L11 1L-3 -2L2 11L13 23L19 20L22 15L25 20L31 23L42 11L47 -2L33 1L27 -5Z" fill="#8ce7e6" transform="translate(4 5) scale(.72)" />
        <text x="57" y="27" class="brand">DIVETRACX</text>
      </g>

      <circle cx="230" cy="295" r="158" fill="none" stroke="#9ff3ef" stroke-width="3" stroke-opacity="0.7" />
      ${photo}

      <text x="450" y="102" class="eyebrow">DIVER SKILLSET</text>
      <text x="450" y="164" class="name">${xml(compact(name, 25))}</text>
      <text x="450" y="202" class="footer">${xml(skillHeading)}</text>
      ${skills}

      <g transform="translate(450 493)">
        <g><text class="statValue">${logbook.totalDives.toLocaleString('en-US')}</text><text y="28" class="statLabel">DIVES</text></g>
        <g transform="translate(205 0)"><text class="statValue">${formatHours(logbook.totalSeconds)} h</text><text y="28" class="statLabel">BOTTOM TIME</text></g>
        <g transform="translate(440 0)"><text class="statValue">${depth} m</text><text y="28" class="statLabel">MAX DEPTH</text></g>
      </g>
      <text x="80" y="570" class="footer">Diving since ${since}  ·  ${logbook.visitedSites.toLocaleString('en-US')} site${logbook.visitedSites === 1 ? '' : 's'} explored</text>
      <text x="1120" y="570" text-anchor="end" class="footer">MY DIVING STORY</text>
    </svg>`

  const sharp = (await import('sharp')).default
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer()
}
