import { Compass } from 'lucide-react';
import { Brand } from '../components/layout/Brand';
import { LinkButton } from '../components/ui/Button';
import { usePageTitle } from '../components/ui/Bits';

export function NotFoundPage() {
  usePageTitle('Page not found');
  return (
    <div className="auth-page">
      <div className="auth-card card" style={{ textAlign: 'center', alignItems: 'center' }}>
        <Brand to="/" />
        <div className="empty__icon" style={{ width: '3.5rem', height: '3.5rem' }}>
          <Compass aria-hidden="true" />
        </div>
        <div>
          <p className="eyebrow">Error 404</p>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>This page does not exist</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            The link may be mistyped or the page may have moved.
          </p>
        </div>
        <div className="row" style={{ justifyContent: 'center' }}>
          <LinkButton to="/dashboard" variant="primary">
            Open your workspace
          </LinkButton>
          <LinkButton to="/">Back to home</LinkButton>
        </div>
      </div>
    </div>
  );
}
