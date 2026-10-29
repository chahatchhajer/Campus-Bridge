import { BarChart3, Briefcase, CalendarDays, FileText, LayoutDashboard, LogOut, Menu, Plus, Settings, ShieldCheck, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { Dialog } from '../ui/Dialog';
import { Button } from '../ui/Button';
import { Brand } from './Brand';

type NavItem = { to: string; label: string; icon: LucideIcon };

const WORKSPACE: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/applications', label: 'Applications', icon: Briefcase },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/resumes', label: 'Resumes', icon: FileText },
];
const INSIGHTS: NavItem[] = [{ to: '/analytics', label: 'GDG Edge analytics', icon: BarChart3 }];
const ACCOUNT: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/privacy', label: 'Privacy', icon: ShieldCheck },
];
const BOTTOM: NavItem[] = [
  { to: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { to: '/applications', label: 'Applications', icon: Briefcase },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
];

function NavGroup({ title, items, onNavigate }: { title: string; items: NavItem[]; onNavigate?: () => void }) {
  return (
    <div className="nav-group">
      <p className="nav-group__title">{title}</p>
      <ul>
        {items.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink to={to} className="nav-link" onClick={onNavigate}>
              <Icon aria-hidden="true" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AccountChip() {
  const auth = useAuth();
  const navigate = useNavigate();
  return (
    <div className="account-chip">
      <div className="account-chip__avatar" aria-hidden="true">
        {(auth.email ?? '?')[0].toUpperCase()}
      </div>
      <div className="account-chip__text">
        <span className="truncate">{auth.isDemo ? 'Demo account' : auth.email}</span>
        {auth.isDemo && <span className="muted">Shared, not secure</span>}
      </div>
      {!auth.isDemo && (
        <Button
          variant="ghost"
          size="sm"
          icon
          aria-label="Sign out"
          onClick={async () => {
            await auth.signOut();
            navigate('/');
          }}
        >
          <LogOut aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

export function AppShell() {
  const auth = useAuth();
  const location = useLocation();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    setDrawer(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Primary">
        <Brand to="/" />
        <nav className="sidebar__nav" aria-label="Workspace">
          <NavGroup title="Workspace" items={WORKSPACE} />
          <NavGroup title="Insights" items={INSIGHTS} />
          <NavGroup title="Account" items={ACCOUNT} />
        </nav>
        <AccountChip />
      </aside>

      <div className="shell__main">
        <header className="topbar">
          <Brand to="/" compact />
          <div className="topbar__actions">
            <Link to="/applications/new" className="btn btn--primary btn--sm">
              <Plus aria-hidden="true" /> New
            </Link>
          </div>
        </header>

        {auth.isDemo && (
          <div className="demo-bar" role="note">
            <TriangleAlert size={16} aria-hidden="true" />
            <span>
              <strong>Demo mode.</strong> Authentication is off and everyone shares one demo account. For local review only, not secure. All data is fictional.
            </span>
          </div>
        )}

        <main id="main" className="content" tabIndex={-1}>
          <Outlet />
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Quick navigation">
        {BOTTOM.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="bottom-nav__link">
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
        <button type="button" className="bottom-nav__link" onClick={() => setDrawer(true)} aria-haspopup="dialog" aria-expanded={drawer}>
          <Menu aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      <Dialog open={drawer} onClose={() => setDrawer(false)} title="Menu" variant="drawer">
        <nav className="drawer-nav" aria-label="All sections">
          <NavGroup title="Workspace" items={WORKSPACE} onNavigate={() => setDrawer(false)} />
          <NavGroup title="Insights" items={INSIGHTS} onNavigate={() => setDrawer(false)} />
          <NavGroup title="Account" items={ACCOUNT} onNavigate={() => setDrawer(false)} />
        </nav>
        <hr style={{ margin: 'var(--s-4) 0' }} />
        <AccountChip />
      </Dialog>
    </div>
  );
}
