import { Link } from '@tanstack/react-router'
import { formatDiveDate } from '@/modules/dives/format'

export interface TimelineCertification {
  id: string
  name: string
  organization: string | null
  certifiedAt: string | null
}

const HEIGHT = 248
const AXIS_Y = 124
const PAD_X = 56
// Label lanes alternate above and below the axis at two distances so
// neighbouring certifications do not overlap.
const LANES = [-72, 72, -36, 36] as const
const DAY_MS = 86_400_000

function dayNumber(date: string) {
  return Date.parse(`${date}T00:00:00Z`) / DAY_MS
}

function truncate(value: string, maxLength: number) {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value
}

// A left-to-right timeline of when each certification was gained.
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

  const width = Math.max(720, dated.length * 96)
  const plotWidth = width - PAD_X * 2
  const x = (date: string) =>
    PAD_X + ((dayNumber(date) - firstDay) / (lastDay - firstDay)) * plotWidth

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
      <div className="overflow-x-auto pb-1">
        <svg
          width={width}
          height={HEIGHT}
          role="img"
          aria-label="Timeline of gained certifications"
        >
          <line
            x1={PAD_X - 16}
            x2={width - PAD_X + 16}
            y1={AXIS_Y}
            y2={AXIS_Y}
            strokeWidth="2"
            className="stroke-border"
          />
          {yearTicks.map((tick) => (
            <g key={tick.year}>
              <line
                x1={tick.x}
                x2={tick.x}
                y1={AXIS_Y - 5}
                y2={AXIS_Y + 5}
                strokeWidth="1"
                className="stroke-muted-foreground/50"
              />
              <text
                x={tick.x}
                y={AXIS_Y + 18}
                textAnchor="middle"
                fontSize="9"
                className="fill-muted-foreground/80"
              >
                {tick.year}
              </text>
            </g>
          ))}
          {dated.map((certification, index) => {
            const lane = LANES[index % LANES.length] ?? -72
            const above = lane < 0
            const nameY = AXIS_Y + lane
            const metaY = nameY + 12
            const leaderStart = above ? metaY + 8 : nameY - 12
            const leaderEnd = above ? AXIS_Y - 7 : AXIS_Y + 7
            const centerX = x(certification.certifiedAt)
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
                <circle cx={centerX} cy={AXIS_Y} r="4.5" className="fill-primary" />
                <text
                  x={centerX}
                  y={nameY}
                  textAnchor="middle"
                  fontSize="11"
                  fontWeight="600"
                  className="fill-foreground"
                >
                  {truncate(certification.name, 20)}
                </text>
                <text
                  x={centerX}
                  y={metaY}
                  textAnchor="middle"
                  fontSize="9.5"
                  className="fill-muted-foreground"
                >
                  {certification.organization
                    ? `${certification.organization} · ${certification.certifiedAt.slice(0, 4)}`
                    : certification.certifiedAt.slice(0, 4)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>
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
