export const agencyCatalog = [
  {
    code: 'padi',
    shortName: 'PADI',
    name: 'Professional Association of Diving Instructors',
    logoSrc: 'https://depthlog.net/assets/agencies/padi_128x128.jpeg',
  },
  {
    code: 'ssi',
    shortName: 'SSI',
    name: 'Scuba Schools International',
    logoSrc: 'https://depthlog.net/assets/agencies/ssi_128x128.jpeg',
  },
  {
    code: 'naui',
    shortName: 'NAUI',
    name: 'National Association of Underwater Instructors',
    logoSrc: 'https://depthlog.net/assets/agencies/naui_128x128.jpeg',
  },
  {
    code: 'cmas',
    shortName: 'CMAS',
    name: 'Confédération Mondiale des Activités Subaquatiques',
    logoSrc: 'https://depthlog.net/assets/agencies/cmas_128x128.jpeg',
  },
] as const

export type AgencyCode = (typeof agencyCatalog)[number]['code']

export function findAgency(code: string | null | undefined) {
  return agencyCatalog.find((agency) => agency.code === code) ?? null
}

export function agencyDisplayName({
  agencyCode,
  customAgencyName,
}: {
  agencyCode: string
  customAgencyName: string | null
}) {
  return findAgency(agencyCode)?.shortName ?? customAgencyName ?? 'Custom agency'
}

export function agencyInitials(name: string) {
  return (
    name
      .split(/[^\p{L}\p{N}]+/u)
      .filter(Boolean)
      .slice(0, 3)
      .map((part) => part[0]?.toLocaleUpperCase())
      .join('') || 'A'
  )
}
