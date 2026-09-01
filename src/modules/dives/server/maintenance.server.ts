import '@tanstack/react-start/server-only'

import { sql } from 'drizzle-orm'
import { getDb } from '@/db'

const chronologicalNumbers = sql`
  select id, number, row_number() over (
    order by dive_date, entry_time nulls last, created_at
  )::integer as chronological_number
  from dives
`

export interface NumberingStatus {
  totalDives: number
  duplicateNumbers: number
  unnumberedDives: number
  wouldChange: number
}

export async function loadNumberingStatus(): Promise<NumberingStatus> {
  const db = getDb()
  const rows = await db.execute<{
    total_dives: number
    duplicate_numbers: number
    unnumbered_dives: number
    would_change: number
  }>(sql`
    with ordered as (${chronologicalNumbers})
    select
      (select count(*) from dives)::integer as total_dives,
      (
        select count(*) from (
          select number from dives where number is not null
          group by number having count(*) > 1
        ) duplicates
      )::integer as duplicate_numbers,
      (select count(*) from dives where number is null)::integer as unnumbered_dives,
      count(*) filter (where number is distinct from chronological_number)::integer
        as would_change
    from ordered
  `)
  const row = rows[0]
  return {
    totalDives: row?.total_dives ?? 0,
    duplicateNumbers: row?.duplicate_numbers ?? 0,
    unnumberedDives: row?.unnumbered_dives ?? 0,
    wouldChange: row?.would_change ?? 0,
  }
}

export async function renumberDivesByDate() {
  const db = getDb()
  const rows = await db.execute<{ changed: number }>(sql`
    with ordered as (${chronologicalNumbers}),
    updated as (
      update dives
      set number = ordered.chronological_number, updated_at = now()
      from ordered
      where dives.id = ordered.id
        and dives.number is distinct from ordered.chronological_number
      returning dives.id
    )
    select count(*)::integer as changed from updated
  `)
  return { changed: rows[0]?.changed ?? 0 }
}
