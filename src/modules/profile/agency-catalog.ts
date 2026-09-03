export const agencyCatalog = [
  {
    code: 'padi',
    shortName: 'PADI',
    name: 'Professional Association of Diving Instructors',
    logoSrc: 'https://depthlog.net/assets/agencies/padi_128x128.jpeg',
    websiteUrl: 'https://www.padi.com/',
    loginUrl: 'https://account.padi.com/',
  },
  {
    code: 'ssi',
    shortName: 'SSI',
    name: 'Scuba Schools International',
    logoSrc: 'https://depthlog.net/assets/agencies/ssi_128x128.jpeg',
    websiteUrl: 'https://www.divessi.com/',
    loginUrl: 'https://my.divessi.com/login',
  },
  {
    code: 'naui',
    shortName: 'NAUI',
    name: 'National Association of Underwater Instructors',
    logoSrc: 'https://depthlog.net/assets/agencies/naui_128x128.jpeg',
    websiteUrl: 'https://www.naui.org/',
    loginUrl: 'https://core.naui.org/signin/',
  },
  {
    code: 'cmas',
    shortName: 'CMAS',
    name: 'Confédération Mondiale des Activités Subaquatiques',
    logoSrc: 'https://depthlog.net/assets/agencies/cmas_128x128.jpeg',
    websiteUrl: 'https://www.cmas.org/',
    loginUrl: 'https://portal.cmas.org/',
  },
  {
    code: 'bsac',
    shortName: 'BSAC',
    name: 'British Sub-Aqua Club',
    logoSrc: '/agency-logos/bsac.svg',
    websiteUrl: 'https://www.bsac.com/',
    loginUrl: 'https://www.bsac.com/my-bsac/',
  },
  {
    code: 'fipsas',
    shortName: 'FIPSAS',
    name: 'Federazione Italiana Pesca Sportiva e Attività Subacquee',
    logoSrc: 'https://fipsas.it/wp-content/uploads/2025/10/Logo-FIPSAS.png',
    websiteUrl: 'https://fipsas.it/',
    loginUrl: 'https://fipsas.it/tesseramento-e-affiliazioni/tesseramento/',
  },
  {
    code: 'sdi',
    shortName: 'SDI',
    name: 'Scuba Diving International',
    logoSrc: '/agency-logos/sdi.svg',
    websiteUrl: 'https://www.tdisdi.com/sdi/',
    loginUrl: 'https://members.tdisdi.com/',
  },
  {
    code: 'tdi',
    shortName: 'TDI',
    name: 'Technical Diving International',
    logoSrc: '/agency-logos/tdi.svg',
    websiteUrl: 'https://www.tdisdi.com/tdi/',
    loginUrl: 'https://members.tdisdi.com/',
  },
  {
    code: 'iantd',
    shortName: 'IANTD',
    name: 'International Association of Nitrox and Technical Divers',
    logoSrc:
      'https://iantd.com/wp-content/uploads/2026/08/cropped-logo_trans-300x237.png',
    websiteUrl: 'https://iantd.com/',
    loginUrl: 'https://www.iantd-members.com/en',
    darkLogo: true,
  },
] as const

export type AgencyCode = (typeof agencyCatalog)[number]['code']

export function findAgency(code: string | null | undefined) {
  return agencyCatalog.find((agency) => agency.code === code) ?? null
}

export function normalizedAgencyName(value: string) {
  return value.trim().toLowerCase()
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

export interface AgencyDisplayRecord {
  code?: string | null
  name: string
  fullName: string | null
  logoSrc: string | null
  websiteUrl?: string | null
  loginUrl?: string | null
  darkLogo: boolean
  builtIn: boolean
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
