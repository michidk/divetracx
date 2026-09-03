import { Link } from '@tanstack/react-router'
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area'
import { formatDiveDate } from '@/modules/dives/format'

export interface TimelineCertification {
  id: string
  name: string
  organization: string | null
  certifiedAt: string | null
}

const PAD_X = 72
const NAME_MAX_LENGTH = 20
// Label lanes alternate above and below the axis, moving further out when the
// nearer lanes are still occupied by a neighbouring label.
const LANE_OFFSETS = [-48, 48, -84, 84, -120, 120] as const
const LABEL_GAP = 12
const DAY_MS = 86_400_000

function dayNumber(date: string) {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

function metaText(certification: { organization: string | null; certifiedAt: string }) {
  const year = certification.certifiedAt.slice(0, 4)
  return certification.organization ? `${certification.organization} · ${year}` : year
}

// A left-to-right timeline of when each certification was gained. Labels are
// assigned to the innermost lane whose previous label leaves enough room, so
// clustered certifications never overlap.
export function CertificationTimeline({
  certifications,
}: {
  certifications: TimelineCertification[]
}) {
  const dated = certifications
    .filter(
      (certification): certification is TimelineCertification & { certifiedAt: string } =>
        certification.certifiedAt !== null,
    )
    .sort((a, b) => a.certifiedAt.localeCompare(b.certifiedAt))
  if (dated.length === 0) return null

  const firstCert = dated[0]
  const lastCert = dated[dated.length - 1]
  if (!firstCert || !lastCert) return null
  const firstDay = dayNumber(firstCert.certifiedAt)
  const lastDay = Math.max(dayNumber(lastCert.certifiedAt), firstDay + 1)

  const width = Math.max(720, dated.length * 116)
  const plotWidth = width - PAD_X * 2
  const x = (date: string) =>
    PAD_X + ((dayNumber(date) - firstDay) / (lastDay - firstDay)) * plotWidth

  const lanes = LANE_OFFSETS.map((offset) => ({
    offset,
    lastRight: Number.NEGATIVE_INFINITY,
  }))
  const placed = dated.map((certification) => {
    const centerX = x(certification.certifiedAt)
    const halfWidth =
      Math.max(
        truncate(certification.name, NAME_MAX_LENGTH).length * 7,
        metaText(certification).length * 5.4,
      ) /
        2 +
      6
    const lane =
      lanes.find((candidate) => centerX - halfWidth >= candidate.lastRight + LABEL_GAP) ??
      lanes.reduce((best, candidate) =>
        candidate.lastRight < best.lastRight ? candidate : best,
      )
    lane.lastRight = centerX + halfWidth
    return { certification, centerX, offset: lane.offset }
  })

  const maxOffset = Math.max(...placed.map((entry) => Math.abs(entry.offset)))
  const axisY = maxOffset + 40
  const height = axisY * 2

  const firstYear = Number(firstCert.certifiedAt.slice(0, 4))
  const lastYear = Number(lastCert.certifiedAt.slice(0, 4))
  const yearTicks: { x: number; year: number }[] = []
  for (let year = firstYear + 1; year <= lastYear; year += 1) {
    yearTicks.push({ x: x(`${year}-01-01`), year })
  }

  return (
    <article className="rounded-2xl border border-border bg-card p-5">
      <p className="mb-2 text-sm font-semibold">
        {dated.length.toLocaleString()} certifications since{' '}
        {formatDiveDate(firstCert.certifiedAt, 'medium')}
      </p>
      <ScrollArea className="pb-1">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Timeline of gained certifications"
        >
          <line
            x1={PAD_X - 16}
            x2={width - PAD_X + 16}
            y1={axisY}
            y2={axisY}
            strokeWidth="2"
            className="stroke-border"
          />
          {yearTicks.map((tick) => (
            <g key={tick.year}>
              <line
                x1={tick.x}
                x2={tick.x}
                y1={axisY - 5}
                y2={axisY + 5}
                strokeWidth="1"
                className="stroke-muted-foreground/50"
              />
              <text
                x={tick.x}
                y={axisY + 20}
                textAnchor="middle"
                fontSize="9"
                className="fill-muted-foreground/80"
              >
                {tick.year}
              </text>
            </g>
          ))}
          {placed.map(({ certification, centerX, offset }) => {
            const above = offset < 0
            const nameY = axisY + offset
            const metaY = nameY + 12
            const leaderStart = above ? metaY + 8 : nameY - 12
            const leaderEnd = above ? axisY - 7 : axisY + 7
            return (
              <g key={certification.id}>
                <title>
                  {`${certification.name}${certification.organization ? ` · ${certification.organization}` : ''} · ${formatDiveDate(certification.certifiedAt, 'medium')}`}
                </title>
                <line
                  x1={centerX}
                  x2={centerX}
                  y1={leaderStart}
                  y2={leaderEnd}
                  strokeWidth="1"
                  strokeDasharray="2 3"
                  className="stroke-muted-foreground/50"
                />
                <circle cx={centerX} cy={axisY} r="4.5" className="fill-primary" />
                <text
                  x={centerX}
                  y={nameY}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  className="fill-foreground"
                >
                  {truncate(certification.name, NAME_MAX_LENGTH)}
                </text>
                <text
                  x={centerX}
                  y={metaY}
                  textAnchor="middle"
                  fontSize="9.5"
                  className="fill-muted-foreground"
                >
                  {metaText(certification)}
                </text>
              </g>
            )
          })}
        </svg>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
      <p className="mt-2 text-xs text-muted-foreground">
        Manage certifications on the{' '}
        <Link to="/profile" className="font-medium text-primary hover:underline">
          profile page
        </Link>
        .
      </p>
    </article>
  )
}
