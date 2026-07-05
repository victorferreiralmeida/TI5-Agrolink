import { Outlet, useLocation } from 'react-router-dom';
import { AppHeader } from '../components/AppHeader';
import { useAuth } from '../auth/AuthContext';

export function RootLayout() {
  const { token } = useAuth();
  const { pathname } = useLocation();
  const landingHome = pathname === '/';
  const showPublicHeader = !token && !landingHome;

  return (
    <div className="page-with-header">
      {showPublicHeader ? <AppHeader /> : null}
      <div className="page-outlet">
        <Outlet />
      </div>
    </div>
  );
}
