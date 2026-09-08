import type { IntegrationEntity } from '@/modules/integrations/types'

/**
 * What a DiveMate backup can bring across, in the order it is applied. A dive
 * only references sites, people, gear, operators, and dive types, so those can
 * be switched off independently and the dive keeps whatever it already linked.
 * Profiles and tanks are rows of a dive and go with it; gear sets are made of
 * gear.
 */
export const DIVEMATE_ENTITIES: readonly IntegrationEntity[] = [
  {
    key: 'divers',
    label: 'Diver profile',
    description: 'Your name, contact, medical, and insurance details.',
    recordTypes: ['diver'],
  },
  {
    key: 'dive_sites',
    label: 'Dive sites',
    description: 'Sites with coordinates, water type, depth, and rating.',
    recordTypes: ['dive_site'],
  },
  {
    key: 'buddies',
    label: 'Buddies',
    description:
      'Address-book people, plus the buddies, guides, and instructors named on dives and certifications.',
    recordTypes: ['buddy'],
  },
  {
    key: 'equipment',
    label: 'Gear',
    description: 'Equipment items with purchase, service, and weight details.',
    recordTypes: ['equipment'],
  },
  {
    key: 'equipment_sets',
    label: 'Gear sets',
    description: 'Named configurations of gear items.',
    dependsOn: ['equipment'],
    recordTypes: ['equipment_set'],
  },
  {
    key: 'shops',
    label: 'Dive operators',
    description: 'Dive centres and operators.',
    recordTypes: ['shop'],
  },
  {
    key: 'dive_types',
    label: 'Dive types',
    description: 'The DiveMate dive-type list, matched to yours by name.',
    recordTypes: ['dive_type'],
  },
  {
    key: 'certifications',
    label: 'Certifications',
    description: 'Certification cards with agency, number, instructor, and scans.',
    recordTypes: ['certification'],
  },
  {
    key: 'dives',
    label: 'Dives',
    description:
      'Log entries with conditions, boat, and the site, operator, people, and gear on each dive.',
    recordTypes: ['dive'],
  },
  {
    key: 'profile_samples',
    label: 'Dive profiles',
    description: 'Depth, temperature, and pressure samples recorded by the computer.',
    dependsOn: ['dives'],
  },
  {
    key: 'tanks',
    label: 'Tanks',
    description: 'Cylinders with volume, gas mix, and pressures.',
    dependsOn: ['dives'],
    recordTypes: ['tank'],
  },
  {
    key: 'pictures',
    label: 'Pictures',
    description:
      'Photos attached to dives, sites, buddies, gear, and your profile. A picture is skipped when its owner is switched off.',
    recordTypes: ['picture'],
  },
]
