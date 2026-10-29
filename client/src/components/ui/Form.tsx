import { AlertCircle } from 'lucide-react';
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

type Shared = { label: string; error?: string; hint?: string; required?: boolean; wrapperClassName?: string };

function Wrapper({ id, label, error, hint, required, className, children }: Shared & { id: string; className?: string; children: ReactNode }) {
  return (
    <div className={`field ${className ?? ''}`}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required && (
          <span className="req" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {hint && !error && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-err`} role="alert">
          <AlertCircle size={14} aria-hidden="true" style={{ flex: 'none', marginTop: 3 }} />
          {error}
        </span>
      )}
    </div>
  );
}

const describedBy = (id: string, error?: string, hint?: string) => (error ? `${id}-err` : hint ? `${id}-hint` : undefined);

export const TextField = forwardRef<HTMLInputElement, Shared & InputHTMLAttributes<HTMLInputElement>>(function TextField(
  { label, error, hint, required, wrapperClassName, ...rest },
  ref,
) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <input ref={ref} id={id} className="input" aria-invalid={Boolean(error) || undefined} aria-required={required || undefined} aria-describedby={describedBy(id, error, hint)} {...rest} />
    </Wrapper>
  );
});

export const SelectField = forwardRef<HTMLSelectElement, Shared & SelectHTMLAttributes<HTMLSelectElement>>(function SelectField(
  { label, error, hint, required, wrapperClassName, children, ...rest },
  ref,
) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <select ref={ref} id={id} className="select" aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy(id, error, hint)} {...rest}>
        {children}
      </select>
    </Wrapper>
  );
});

export const TextareaField = forwardRef<HTMLTextAreaElement, Shared & TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextareaField(
  { label, error, hint, required, wrapperClassName, ...rest },
  ref,
) {
  const id = useId();
  return (
    <Wrapper id={id} label={label} error={error} hint={hint} required={required} className={wrapperClassName}>
      <textarea ref={ref} id={id} className="textarea" aria-invalid={Boolean(error) || undefined} aria-describedby={describedBy(id, error, hint)} {...rest} />
    </Wrapper>
  );
});
