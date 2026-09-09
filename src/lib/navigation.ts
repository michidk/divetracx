import {
  Backpack,
  ChartColumn,
  CircleUserRound,
  LayoutDashboard,
  type LucideIcon,
  Map as MapIcon,
  MapPinned,
  Settings,
  UsersRound,
  Waves,
} from 'lucide-react'
import { DEMO_MODE } from '@/lib/build-mode'

export type NavigationItem = {
  to:
    | '/overview'
    | '/dives'
    | '/sites'
    | '/map'
    | '/buddies'
    | '/gear'
    | '/stats'
    | '/profile'
    | '/settings'
  label: string
  description: string
  icon: LucideIcon
}

/** Destinations shown in the desktop header, in order. */
export const primaryNavigation: NavigationItem[] = [
  { to: '/dives', label: 'Dives', description: 'Your logbook', icon: Waves },
  { to: '/sites', label: 'Sites', description: 'Places you have dived', icon: MapPinned },
  {
    to: '/buddies',
    label: 'Buddies',
    description: 'People you dive with',
    icon: UsersRound,
  },
  { to: '/gear', label: 'Gear', description: 'Equipment and sets', icon: Backpack },
  {
    to: '/stats',
    label: 'Stats',
    description: 'Totals, trends, and records',
    icon: ChartColumn,
  },
  {
    to: '/profile',
    label: 'Profile',
    description: 'Certifications and diver card',
    icon: CircleUserRound,
  },
]

export const settingsNavigation: NavigationItem = {
  to: '/settings',
  label: 'Settings',
  description: 'Imports, exports, MCP, and taxonomies',
  icon: Settings,
}

/** The first tabs of the mobile bar; everything else lives behind "More". */
export const mobileTabNavigation = primaryNavigation.slice(0, 4)

export const mobileMoreNavigation: NavigationItem[] = [
  {
    to: '/overview',
    label: 'Overview',
    description: 'Recent dives at a glance',
    icon: LayoutDashboard,
  },
  { to: '/map', label: 'Map', description: 'Dive spots on a world map', icon: MapIcon },
  ...primaryNavigation.slice(4),
  ...(DEMO_MODE ? [] : [settingsNavigation]),
]

export function isNavigationItemActive(item: NavigationItem, pathname: string) {
  return pathname === item.to || pathname.startsWith(`${item.to}/`)
}
