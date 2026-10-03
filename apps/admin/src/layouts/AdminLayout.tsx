import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../features/auth/auth-context';
import { zhCN } from '../i18n/zh-CN';
import logo from '../../../../assets/brand/slogan-logo.png';
import { nav } from './navigation';

export function AdminLayout() {
  const { me, logout } = useAuth();
  const { pathname } = useLocation();
  const label =
    nav.flatMap((group) => group.items).find((item) => item.path === pathname)?.label ??
    zhCN.console;
  if (!me) return null;
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand">
          <img src={logo} alt="" />
          <strong>{zhCN.app}</strong>
        </div>
        <nav aria-label="后台导航">
          {nav.map((group) => {
            const items = group.items.filter((item) =>
              item.roles.some((role) => me.roles.includes(role)),
            );
            if (!items.length) return null;
            return (
              <div className="nav-group" key={group.group}>
                <p>{group.group}</p>
                {items.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
                  >
                    <span aria-hidden="true">{item.symbol}</span>
                    {item.label}
                  </NavLink>
                ))}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-foot">Slogan Admin · V1</div>
      </aside>
      <div className="admin-main">
        <header className="admin-topbar">
          <span>
            {zhCN.console} / {label}
          </span>
          <button
            className="avatar"
            aria-label={zhCN.common.signOut}
            title={zhCN.common.signOut}
            onClick={() => void logout()}
          >
            A
          </button>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
