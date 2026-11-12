import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { Link } from 'react-router';

export interface ShellUser {
  name: string;
  email: string;
  roleLabel: string;
}

interface UserMenuProps {
  user: ShellUser;
  profilePath?: string;
  /** Wired to Supabase sign-out in Module 3. */
  onSignOut?: () => void;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
}

export function UserMenu({ user, profilePath, onSignOut }: UserMenuProps) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        className="flex items-center gap-2 rounded-[var(--radius-control)] py-1 pr-1.5 pl-1 text-sm hover:bg-navy-50"
        aria-label={`Account menu for ${user.name}`}
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-navy-900 text-xs font-semibold text-white">
          {initials(user.name)}
        </span>
        <span className="hidden text-left leading-tight sm:block">
          <span className="block font-medium">{user.name}</span>
          <span className="block text-xs text-muted">{user.roleLabel}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-4 text-muted" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-56 rounded-[var(--radius-card)] border border-line bg-surface p-1 shadow-[var(--shadow-overlay)]"
        >
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-line" />
          {profilePath && (
            <DropdownMenu.Item asChild>
              <Link
                to={profilePath}
                className="flex items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[highlighted]:bg-navy-50"
              >
                <User aria-hidden="true" className="size-4 text-muted" />
                Profile
              </Link>
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            disabled={!onSignOut}
            onSelect={onSignOut}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-sm outline-none data-[disabled]:cursor-not-allowed data-[disabled]:text-muted data-[highlighted]:bg-navy-50"
          >
            <LogOut aria-hidden="true" className="size-4 text-muted" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
