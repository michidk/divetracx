export const DIVE_BUDDY_ROLE_VALUES = [
  'buddy',
  'divemaster',
  'instructor',
  'guide',
] as const

export type DiveBuddyRole = (typeof DIVE_BUDDY_ROLE_VALUES)[number]

export const DIVE_BUDDY_ROLE_OPTIONS: ReadonlyArray<{
  value: DiveBuddyRole
  label: string
}> = [
  { value: 'buddy', label: 'Buddy' },
  { value: 'divemaster', label: 'Divemaster' },
  { value: 'instructor', label: 'Instructor' },
  { value: 'guide', label: 'Guide' },
]

export function diveBuddyRoleLabel(role: DiveBuddyRole) {
  return DIVE_BUDDY_ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role
}
