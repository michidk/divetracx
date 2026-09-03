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
  duplicateGroups: Array<{
    number: number
    dives: Array<{
      id: string
      diveDate: string
      entryTime: string | null
      siteName: string | null
    }>
  }>
  unnumberedDives: number
  wouldChange: number
}

export async function loadNumberingStatus(): Promise<NumberingStatus> {
  const db = getDb()
  return db.transaction(
    async (transaction) => {
      const rows = await transaction.execute<{
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
      const duplicateRows = await transaction.execute<{
        id: string
        number: number
        dive_date: string
        entry_time: string | null
        site_name: string | null
      }>(sql`
        select
          dives.id,
          dives.number,
          dives.dive_date,
          dives.entry_time,
          dive_sites.name as site_name
        from dives
        left join dive_sites on dive_sites.id = dives.site_id
        where dives.number in (
          select number
          from dives
          where number is not null
          group by number
          having count(*) > 1
        )
        order by dives.number, dives.dive_date, dives.entry_time nulls last, dives.created_at
      `)
      const duplicateGroups: NumberingStatus['duplicateGroups'] = []
      for (const duplicate of duplicateRows) {
        let group = duplicateGroups.at(-1)
        if (!group || group.number !== duplicate.number) {
          group = { number: duplicate.number, dives: [] }
          duplicateGroups.push(group)
        }
        group.dives.push({
          id: duplicate.id,
          diveDate: duplicate.dive_date,
          entryTime: duplicate.entry_time,
          siteName: duplicate.site_name,
        })
      }

      const row = rows[0]
      return {
        totalDives: row?.total_dives ?? 0,
        duplicateNumbers: row?.duplicate_numbers ?? 0,
        duplicateGroups,
        unnumberedDives: row?.unnumbered_dives ?? 0,
        wouldChange: row?.would_change ?? 0,
      }
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' },
  )
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
