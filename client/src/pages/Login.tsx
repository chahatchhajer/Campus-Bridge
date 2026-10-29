import { zodResolver } from '@hookform/resolvers/zod';
import { Info } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Brand } from '../components/layout/Brand';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Form';
import { Notice } from '../components/ui/Feedback';
import { usePageTitle } from '../components/ui/Bits';
import { useAuth } from '../lib/auth';

const schema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email address'),
  password: z.string().min(8, 'Use at least 8 characters'),
});
type Values = z.infer<typeof schema>;

export function LoginPage() {
  usePageTitle('Sign in');
  const auth = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [formError, setFormError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Values>({ resolver: zodResolver(schema) });

  const dest = (location.state as { from?: string } | null)?.from ?? '/dashboard';
  if (auth.status === 'signed-in') return <Navigate to={dest} replace />;

  const onSubmit = handleSubmit(async ({ email, password }) => {
    setFormError(null);
    setInfo(null);
    try {
      if (mode === 'signin') {
        await auth.signIn(email, password);
        navigate(dest, { replace: true });
      } else {
        const { needsConfirmation } = await auth.signUp(email, password);
        if (needsConfirmation) setInfo('Check your inbox to confirm your email, then sign in.');
        else navigate(dest, { replace: true });
      }
    } catch (err) {
      setFormError((err as Error).message);
    }
  });

  return (
    <div className="auth-page">
      <div className="auth-card card">
        <Brand to="/" />
        <div>
          <h1 style={{ fontSize: 'var(--fs-xl)' }}>{mode === 'signin' ? 'Sign in to your workspace' : 'Create your account'}</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Your applications and resumes are private to your account.
          </p>
        </div>

        {!auth.configured ? (
          <Notice tone="warn" icon={Info}>
            <strong>Sign-in is not configured.</strong> Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in <code>client/.env</code> (see the README), or run the client with <code>VITE_DEMO_MODE=true</code> for local visual review.
          </Notice>
        ) : (
          <form onSubmit={onSubmit} noValidate className="stack" style={{ gap: 'var(--s-4)' }}>
            <TextField label="Email" type="email" autoComplete="email" inputMode="email" required error={errors.email?.message} {...register('email')} />
            <TextField
              label="Password"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              required
              hint={mode === 'signup' ? 'At least 8 characters.' : undefined}
              error={errors.password?.message}
              {...register('password')}
            />
            {formError && (
              <div className="notice notice--danger" role="alert">
                {formError}
              </div>
            )}
            {info && (
              <div className="notice notice--info" role="status">
                {info}
              </div>
            )}
            <Button type="submit" variant="primary" size="lg" block loading={isSubmitting}>
              {mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
            <p className="muted" style={{ textAlign: 'center', fontSize: 'var(--fs-sm)' }}>
              {mode === 'signin' ? 'New here?' : 'Already have an account?'}{' '}
              <button
                type="button"
                className="link-btn"
                onClick={() => {
                  setMode(mode === 'signin' ? 'signup' : 'signin');
                  setFormError(null);
                  setInfo(null);
                }}
              >
                {mode === 'signin' ? 'Create an account' : 'Sign in'}
              </button>
            </p>
          </form>
        )}
        <p className="muted" style={{ fontSize: 'var(--fs-xs)', textAlign: 'center' }}>
          <Link to="/">Back to home</Link> · <Link to="/privacy">Privacy</Link>
        </p>
      </div>
    </div>
  );
}
