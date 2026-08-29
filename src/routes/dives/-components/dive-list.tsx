import type { getDives } from '@/modules/dives/server/queries'

type DiveListData = Awaited<ReturnType<typeof getDives>>

export function DiveList({ dives }: { dives: DiveListData }) {
  return (
    <div className="space-y-7">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">
          Logbook
        </p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight">Dives</h1>
        <p className="mt-3 text-muted-foreground">
          Your latest {dives.length} recorded dives.
        </p>
      </header>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-border bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-5 py-4">Dive</th>
              <th className="px-5 py-4">Site</th>
              <th className="px-5 py-4">Date</th>
              <th className="px-5 py-4 text-right">Time</th>
              <th className="px-5 py-4 text-right">Depth</th>
              <th className="px-5 py-4 text-right">Water</th>
            </tr>
          </thead>
          <tbody>
            {dives.map((dive) => (
              <tr key={dive.id} className="border-b border-border last:border-0">
                <td className="px-5 py-4 font-mono text-muted-foreground">
                  #{dive.number ?? '—'}
                </td>
                <td className="px-5 py-4">
                  <p className="font-semibold">{dive.siteName ?? 'Unknown site'}</p>
                  <p className="text-xs text-muted-foreground">{dive.country ?? '—'}</p>
                </td>
                <td className="px-5 py-4">{dive.diveDate}</td>
                <td className="px-5 py-4 text-right font-mono">
                  {Math.round(dive.durationSeconds / 60)} min
                </td>
                <td className="px-5 py-4 text-right font-mono">
                  {Number(dive.maximumDepthMeters ?? 0).toFixed(1)} m
                </td>
                <td className="px-5 py-4 text-right font-mono">
                  {dive.waterTemperatureCelsius
                    ? `${Number(dive.waterTemperatureCelsius).toFixed(0)} °C`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dives.length === 0 ? (
          <p className="p-10 text-center text-sm text-muted-foreground">
            No dives imported yet.
          </p>
        ) : null}
      </div>
    </div>
  )
}
