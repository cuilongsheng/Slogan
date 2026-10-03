import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../features/auth/auth-context';
import { AdminLayout } from '../../layouts/AdminLayout';
import { firstPermittedRoute } from '../../layouts/navigation';
import { SignInView } from '../../views/SignInView';
import { RoomsPage } from '../../features/rooms/RoomsPage';
import { CasesPage } from '../../features/moderation/CasesPage';
import { AppealsPage } from '../../features/moderation/AppealsPage';
import { IncidentsPage } from '../../features/moderation/IncidentsPage';
import { RolesPage } from '../../features/users/RolesPage';
import { AuditPage } from '../../features/audit/AuditPage';
import { zhCN } from '../../i18n/zh-CN';

type Role = NonNullable<ReturnType<typeof useAuth>['me']>['roles'][number];
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === 'checking') return <div className="auth-stage">{zhCN.common.loading}</div>;
  if (status !== 'ready') return <Navigate to="/sign-in" replace />;
  return children;
}
function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { me } = useAuth();
  return me?.roles.some((role) => roles.includes(role)) ? (
    children
  ) : (
    <div className="page-state" role="alert">
      {zhCN.common.denied}
    </div>
  );
}
function StartPage() {
  const { me } = useAuth();
  return <Navigate to={me ? firstPermittedRoute(me.roles) : '/sign-in'} replace />;
}
export function AppRouter() {
  return (
    <Routes>
      <Route path="/sign-in" element={<SignInView />} />
      <Route
        element={
          <RequireAuth>
            <AdminLayout />
          </RequireAuth>
        }
      >
        <Route index element={<StartPage />} />
        <Route
          path="/rooms"
          element={
            <RequireRole roles={['PLATFORM_ADMIN']}>
              <RoomsPage />
            </RequireRole>
          }
        />
        <Route
          path="/safety/cases"
          element={
            <RequireRole roles={['PLATFORM_ADMIN', 'SAFETY_OFFICER']}>
              <CasesPage />
            </RequireRole>
          }
        />
        <Route
          path="/safety/appeals"
          element={
            <RequireRole roles={['PLATFORM_ADMIN', 'SAFETY_OFFICER']}>
              <AppealsPage />
            </RequireRole>
          }
        />
        <Route
          path="/safety/incidents"
          element={
            <RequireRole roles={['PLATFORM_ADMIN', 'SAFETY_OFFICER', 'AUDITOR']}>
              <IncidentsPage />
            </RequireRole>
          }
        />
        <Route
          path="/roles"
          element={
            <RequireRole roles={['PLATFORM_ADMIN']}>
              <RolesPage />
            </RequireRole>
          }
        />
        <Route
          path="/audit"
          element={
            <RequireRole roles={['PLATFORM_ADMIN', 'AUDITOR']}>
              <AuditPage />
            </RequireRole>
          }
        />
        <Route
          path="/no-pages"
          element={<div className="page-state">当前角色没有已设计的后台页面</div>}
        />
        <Route path="*" element={<StartPage />} />
      </Route>
    </Routes>
  );
}
