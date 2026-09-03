interface PersonName {
  firstName: string | null
  lastName: string | null
}

export function cleanDiveMateInstructorName(value: string | null | undefined) {
  const cleaned = value?.trim().replace(/\s+/g, ' ')
  return cleaned || null
}

export function normalizeDiveMateInstructorName(value: string | null | undefined) {
  return cleanDiveMateInstructorName(value)?.toLowerCase() ?? null
}

export function formatDiveMateInstructor(person: PersonName | null | undefined) {
  if (!person) return null
  return cleanDiveMateInstructorName(
    [person.firstName, person.lastName].filter(Boolean).join(' '),
  )
}
