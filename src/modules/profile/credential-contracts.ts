import {
  type EntityContract,
  nullableDateSchema,
  nullableTextSchema,
  nullableUuidSchema,
  requiredTextSchema,
  requiredUuidSchema,
} from '@/modules/data/field-contract'

export type CertificationInput = {
  name: string
  agencyId: string
  certificationNumber: string | null
  certifiedAt: string | null
  instructorBuddyId: string | null
}

export const certificationContract: EntityContract<CertificationInput> = {
  name: {
    presentation: {
      label: 'Name',
      kind: 'text',
      section: 'Certification',
      required: true,
    },
    mcpExposed: false,
    schema: requiredTextSchema('Name'),
  },
  agencyId: {
    presentation: {
      label: 'Agency',
      kind: 'select',
      section: 'Certification',
      required: true,
      help: 'Add more agencies in Settings.',
    },
    mcpExposed: false,
    schema: requiredUuidSchema('Agency'),
  },
  certificationNumber: {
    presentation: {
      label: 'Certification number',
      kind: 'text',
      section: 'Certification',
    },
    mcpExposed: false,
    schema: nullableTextSchema('Certification number', 200),
  },
  certifiedAt: {
    presentation: { label: 'Certified on', kind: 'date', section: 'Certification' },
    mcpExposed: false,
    schema: nullableDateSchema('Certified on'),
  },
  instructorBuddyId: {
    presentation: {
      label: 'Instructor',
      kind: 'select',
      section: 'Instructor',
      help: 'Instructors are people in your buddy list.',
    },
    mcpExposed: false,
    schema: nullableUuidSchema('Instructor'),
  },
}

export type AgencyMembershipInput = {
  agencyId: string
  memberNumber: string
}

export const agencyMembershipContract: EntityContract<AgencyMembershipInput> = {
  agencyId: {
    presentation: {
      label: 'Agency',
      kind: 'select',
      section: 'Membership',
      required: true,
      help: 'Add more agencies in Settings.',
    },
    mcpExposed: false,
    schema: requiredUuidSchema('Agency'),
  },
  memberNumber: {
    presentation: {
      label: 'Membership number',
      kind: 'text',
      section: 'Membership',
      required: true,
    },
    mcpExposed: false,
    schema: requiredTextSchema('Membership number'),
  },
}
