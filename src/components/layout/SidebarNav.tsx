import { NavLink } from 'react-router';
import type { NavItem } from '@/app/navigation';
import { cn } from '@/lib/utils/cn';

interface SidebarNavProps {
  items: readonly NavItem[];
  basePath: string;
  onNavigate?: () => void;
}

/** Vertical navigation used by the desktop sidebar and the mobile drawer. */
export function SidebarNav({ items, basePath, onNavigate }: SidebarNavProps) {
  return (
    <ul className="space-y-0.5">
      {items.map((item) => {
        const Icon = item.icon;
        if (item.disabled) {
          return (
            <li key={item.path}>
              <span
                aria-disabled="true"
                className="flex cursor-not-allowed items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm text-navy-300"
              >
                <Icon aria-hidden="true" className="size-4.5 shrink-0" />
                <span className="flex-1">{item.title}</span>
                <span className="rounded-full border border-navy-700 px-1.5 py-px text-[10px] font-semibold tracking-wide uppercase">
                  Later
                </span>
              </span>
            </li>
          );
        }
        return (
          <li key={item.path}>
            <NavLink
              to={`${basePath}/${item.path}`}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-white/10 text-white shadow-[inset_3px_0_0_0_var(--color-emerald-500)]'
                    : 'text-navy-200 hover:bg-white/5 hover:text-white',
                )
              }
            >
              <Icon aria-hidden="true" className="size-4.5 shrink-0" />
              {item.title}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}
