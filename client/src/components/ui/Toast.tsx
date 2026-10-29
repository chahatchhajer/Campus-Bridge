import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';

type Kind = 'success' | 'error' | 'warning' | 'info';
type ToastItem = { id: number; kind: Kind; title: string; message?: string };
type Api = Record<Kind, (title: string, message?: string) => void>;

const Ctx = createContext<Api | null>(null);
const ICONS = { success: CheckCircle2, error: XCircle, warning: AlertTriangle, info: Info };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const next = useRef(1);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback(
    (kind: Kind, title: string, message?: string) => {
      const id = next.current++;
      setItems((l) => [...l.slice(-3), { id, kind, title, message }]);
      window.setTimeout(() => dismiss(id), kind === 'error' ? 8000 : 4500);
    },
    [dismiss],
  );

  const api = useMemo<Api>(
    () => ({
      success: (t, m) => push('success', t, m),
      error: (t, m) => push('error', t, m),
      warning: (t, m) => push('warning', t, m),
      info: (t, m) => push('info', t, m),
    }),
    [push],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toasts" role="region" aria-label="Notifications">
        {items.map((t) => {
          const Icon = ICONS[t.kind];
          return (
            <div key={t.id} className={`toast toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
              <Icon aria-hidden="true" />
              <div className="toast__msg">
                <div className="toast__title">{t.title}</div>
                {t.message && <div>{t.message}</div>}
              </div>
              <button type="button" className="toast__close" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
