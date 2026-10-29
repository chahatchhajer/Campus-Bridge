import { Link, Outlet } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { LinkButton } from '../ui/Button';
import { AppShell } from './AppShell';
import { Brand } from './Brand';

/** Pages that must be readable without an account (privacy). Signed-in users get the normal app shell. */
export function SharedLayout() {
  const auth = useAuth();
  if (auth.status === 'signed-in') return <AppShell />;
  return (
    <div className="public-layout">
      <header className="mnav">
        <div className="mnav__inner">
          <Brand to="/" />
          <div className="mnav__cta">
            <Link to="/" className="btn btn--ghost btn--sm">
              Home
            </Link>
            <LinkButton to="/dashboard" variant="primary" size="sm">
              Open your workspace
            </LinkButton>
          </div>
        </div>
      </header>
      <main id="main" className="content">
        <Outlet />
      </main>
    </div>
  );
}
