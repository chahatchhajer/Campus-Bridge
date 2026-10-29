import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
  variant?: 'modal' | 'drawer';
  /** When false, Escape and backdrop clicks are ignored (e.g. while a request is running). */
  dismissible?: boolean;
};

/** Thin wrapper over the native <dialog>: focus trapping, Escape handling and inertness come from the platform. */
export function Dialog({ open, onClose, title, description, children, footer, wide, variant = 'modal', dismissible = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog ${wide ? 'dialog--wide' : ''} ${variant === 'drawer' ? 'dialog--drawer' : ''}`}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onMouseDown={(e) => {
        if (dismissible && e.target === ref.current) onClose();
      }}
    >
      {open && (
        <>
          <div className="dialog__head">
            <div>
              <h2 className="dialog__title" id={titleId}>
                {title}
              </h2>
              {description && (
                <p className="dialog__desc" id={descId}>
                  {description}
                </p>
              )}
            </div>
            <Button variant="ghost" size="sm" icon aria-label="Close dialog" onClick={onClose} disabled={!dismissible}>
              <X aria-hidden="true" />
            </Button>
          </div>
          <div className="dialog__body">{children}</div>
          {footer && <div className="dialog__foot">{footer}</div>}
        </>
      )}
    </dialog>
  );
}

type ConfirmProps = {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({ open, title, description, confirmLabel, busy, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={title}
      dismissible={!busy}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="muted" style={{ fontSize: 'var(--fs-base)' }}>
        {description}
      </div>
    </Dialog>
  );
}
