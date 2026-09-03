import { type DiveBuddyRole, diveBuddyRoleLabel } from '@/modules/dives/buddy-role'

export interface DiveTeamMember {
  name: string
  role: Exclude<DiveBuddyRole, 'buddy'>
}

const ROLE_BY_LABEL = {
  divemaster: 'divemaster',
  instructor: 'instructor',
  guide: 'guide',
} as const satisfies Record<string, DiveTeamMember['role']>

export function parseDiveMateDiveTeam(value: string | null): DiveTeamMember[] {
  if (!value?.trim()) return []
  return value
    .split(/;|\r?\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const tagged = /^(divemaster|instructor|guide)\s*:\s*(.+)$/i.exec(part)
      if (!tagged) return { name: part, role: 'divemaster' as const }
      return {
        name: tagged[2]?.trim() ?? '',
        role: ROLE_BY_LABEL[tagged[1]?.toLocaleLowerCase() as keyof typeof ROLE_BY_LABEL],
      }
    })
    .filter((member) => member.name.length > 0)
}

export function formatDiveMateDiveTeam(members: DiveTeamMember[]) {
  const unique = new Map<string, DiveTeamMember>()
  for (const member of members) {
    const name = member.name.trim()
    if (!name) continue
    unique.set(`${member.role}:${name.toLocaleLowerCase()}`, { ...member, name })
  }
  const encoded = [...unique.values()]
    .map((member) => `${diveBuddyRoleLabel(member.role)}: ${member.name}`)
    .join('; ')
  return encoded || null
}
