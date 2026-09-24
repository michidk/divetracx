import {
  type EntityContract,
  requiredTextSchema,
  requiredUuidSchema,
} from '@/modules/data/field-contract'

// Neither buddy certifications nor buddy agency memberships have an MCP tool
// today; MCP only reads a buddy's credentials (see modules/mcp/catalog.ts).

export type BuddyCertificationInput = {
  agencyId: string
  name: string
}

export const buddyCertificationContract: EntityContract<BuddyCertificationInput> = {
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
  name: {
    presentation: {
      label: 'Certification name',
      kind: 'text',
      section: 'Certification',
      required: true,
    },
    mcpExposed: false,
    schema: requiredTextSchema('Certification name'),
  },
}

export type BuddyAgencyMembershipInput = {
  agencyId: string
  memberNumber: string
}

export const buddyAgencyMembershipContract: EntityContract<BuddyAgencyMembershipInput> = {
  agencyId: {
    presentation: {
      label: 'Agency',
      kind: 'select',
      section: 'Agency membership',
      required: true,
      help: 'Add more agencies in Settings.',
    },
    mcpExposed: false,
    schema: requiredUuidSchema('Agency'),
  },
  memberNumber: {
    presentation: {
      label: 'Member or instructor number',
      kind: 'text',
      section: 'Agency membership',
      required: true,
    },
    mcpExposed: false,
    schema: requiredTextSchema('Member or instructor number'),
  },
}
