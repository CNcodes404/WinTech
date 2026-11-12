import {
  Activity,
  Briefcase,
  CalendarRange,
  ChartLine,
  FileText,
  HandCoins,
  House,
  Landmark,
  LayoutDashboard,
  Percent,
  ScrollText,
  Settings,
  User,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  path: string;
  title: string;
  icon: LucideIcon;
  /** One-line page context shown under the title. */
  description: string;
  /** Module in which the real screen is delivered (for placeholders). */
  module: number;
  /** Disabled items render as non-links with a "Later" label (e.g. Settlements in V1). */
  disabled?: boolean;
}

/** Admin sidebar order per UI_UX_SPECIFICATION §2. */
export const ADMIN_NAV: readonly NavItem[] = [
  {
    path: 'overview',
    title: 'Overview',
    icon: LayoutDashboard,
    description: 'Current cycle status, key figures and next actions.',
    module: 11,
  },
  {
    path: 'clients',
    title: 'Clients',
    icon: Users,
    description: 'Manage client profiles and view their holdings.',
    module: 5,
  },
  {
    path: 'cycles',
    title: 'Investment Cycles',
    icon: CalendarRange,
    description: 'Create cycles, set base NAV and manage fee terms.',
    module: 6,
  },
  {
    path: 'contributions',
    title: 'Contributions',
    icon: HandCoins,
    description: 'Record manual contributions and verify them to issue units.',
    module: 7,
  },
  {
    path: 'portfolio',
    title: 'Portfolio',
    icon: Briefcase,
    description: 'Enter holdings, cash and liabilities as a manual valuation.',
    module: 8,
  },
  {
    path: 'nav',
    title: 'NAV & Performance',
    icon: ChartLine,
    description: 'Calculate and publish NAV snapshots from approved valuations.',
    module: 9,
  },
  {
    path: 'profit-sharing',
    title: 'Profit Sharing',
    icon: Percent,
    description: 'Performance-fee rates, high-water marks and fee accruals.',
    module: 10,
  },
  {
    path: 'settlements',
    title: 'Settlements',
    icon: Landmark,
    description: 'Settlement processing is not part of V1.',
    module: 0,
    disabled: true,
  },
  {
    path: 'reports',
    title: 'Reports',
    icon: FileText,
    description: 'Statements, registers and CSV exports.',
    module: 13,
  },
  {
    path: 'settings',
    title: 'Settings',
    icon: Settings,
    description: 'Display and demo settings.',
    module: 13,
  },
];

/** Client navigation per UI_UX_SPECIFICATION §2. */
export const CLIENT_NAV: readonly NavItem[] = [
  {
    path: 'overview',
    title: 'Overview',
    icon: House,
    description: 'Your investment at a glance.',
    module: 12,
  },
  {
    path: 'investment',
    title: 'My Investment',
    icon: Wallet,
    description: 'Contribution lots, units and performance breakdown.',
    module: 12,
  },
  {
    path: 'activity',
    title: 'Activity',
    icon: Activity,
    description: 'Contributions, verifications and NAV updates.',
    module: 12,
  },
  {
    path: 'statements',
    title: 'Statements',
    icon: ScrollText,
    description: 'Download your statements.',
    module: 12,
  },
  {
    path: 'profile',
    title: 'Profile',
    icon: User,
    description: 'Personal information and sign-in details.',
    module: 12,
  },
];
