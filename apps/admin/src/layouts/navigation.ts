import type { AuthState } from '../features/auth/auth-context';
import { zhCN } from '../i18n/zh-CN';

export type Role = NonNullable<AuthState['me']>['roles'][number];
export type NavItem = { path: string; label: string; symbol: string; roles: Role[] };
const admin: Role[] = ['PLATFORM_ADMIN'];
const safety: Role[] = ['PLATFORM_ADMIN', 'SAFETY_OFFICER'];
const safetyRead: Role[] = ['PLATFORM_ADMIN', 'SAFETY_OFFICER', 'AUDITOR'];
export const nav: Array<{ group: string; items: NavItem[] }> = [
  {
    group: zhCN.groups.business,
    items: [{ path: '/rooms', label: zhCN.pages.rooms.title, symbol: '◫', roles: admin }],
  },
  {
    group: zhCN.groups.safety,
    items: [
      { path: '/safety/cases', label: zhCN.pages.cases.title, symbol: '◇', roles: safety },
      { path: '/safety/appeals', label: zhCN.pages.appeals.title, symbol: '▤', roles: safety },
      {
        path: '/safety/incidents',
        label: zhCN.pages.incidents.title,
        symbol: '⚡',
        roles: safetyRead,
      },
    ],
  },
  {
    group: zhCN.groups.governance,
    items: [
      { path: '/roles', label: zhCN.pages.roles.title, symbol: '♧', roles: admin },
      {
        path: '/audit',
        label: zhCN.pages.audit.title,
        symbol: '▣',
        roles: ['PLATFORM_ADMIN', 'AUDITOR'],
      },
    ],
  },
];
export function firstPermittedRoute(roles: readonly Role[]) {
  return (
    nav
      .flatMap((group) => group.items)
      .find((item) => item.roles.some((role) => roles.includes(role)))?.path ?? '/no-pages'
  );
}
