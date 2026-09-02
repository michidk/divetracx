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
  {
    code: 'bsac',
    shortName: 'BSAC',
    name: 'British Sub-Aqua Club',
    logoSrc: 'https://www.bsac.com/themes/bsac/gfx/logos/bsac-logo.png',
  },
  {
    code: 'fipsas',
    shortName: 'FIPSAS',
    name: 'Federazione Italiana Pesca Sportiva e Attività Subacquee',
    logoSrc: 'https://fipsas.it/wp-content/uploads/2025/10/Logo-FIPSAS.png',
  },
  {
    code: 'sdi',
    shortName: 'SDI',
    name: 'Scuba Diving International',
    logoSrc: 'https://www.scuba.com/blog/wp-content/uploads/2018/11/SDI.jpg',
  },
  {
    code: 'tdi',
    shortName: 'TDI',
    name: 'Technical Diving International',
    logoSrc:
      'https://www.nicepng.com/png/full/38-387319_tdi-technical-diving-international-logo-technical-diving-international.png',
  },
  {
    code: 'iantd',
    shortName: 'IANTD',
    name: 'International Association of Nitrox and Technical Divers',
    logoSrc:
      'https://iantd.com/wp-content/uploads/2026/08/cropped-logo_trans-300x237.png',
    darkLogo: true,
  },
] as const

export type AgencyCode = (typeof agencyCatalog)[number]['code']

export function findAgency(code: string | null | undefined) {
  return agencyCatalog.find((agency) => agency.code === code) ?? null
}

function normalizedAgencyName(value: string) {
  return value
    .normalize('NFKD')
    .replaceAll(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '')
}

export function findAgencyByName(name: string | null | undefined) {
  if (!name) return null
  const normalizedName = normalizedAgencyName(name)
  return (
    agencyCatalog.find(
      (agency) =>
        normalizedAgencyName(agency.shortName) === normalizedName ||
        normalizedAgencyName(agency.name) === normalizedName,
    ) ?? null
  )
}

export function agencySelectionForName(name: string | null | undefined) {
  const trimmedName = name?.trim() || null
  const agency = findAgencyByName(trimmedName)
  return {
    agencyCode: agency?.code ?? (trimmedName ? 'custom' : null),
    customAgencyName: agency ? null : trimmedName,
  }
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
