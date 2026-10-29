import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';

type Common = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-quiet';
  size?: 'sm' | 'md' | 'lg';
  icon?: boolean;
  block?: boolean;
  loading?: boolean;
};

const cls = ({ variant = 'secondary', size = 'md', icon, block }: Common, extra?: string) =>
  ['btn', `btn--${variant}`, size !== 'md' && `btn--${size}`, icon && 'btn--icon', block && 'btn--block', extra].filter(Boolean).join(' ');

export const Button = forwardRef<HTMLButtonElement, Common & ButtonHTMLAttributes<HTMLButtonElement>>(function Button(
  { variant, size, icon, block, loading, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={cls({ variant, size, icon, block }, className)} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  );
});

export function LinkButton({ variant, size, icon, block, className, children, ...rest }: Common & LinkProps & { children: ReactNode }) {
  return (
    <Link className={cls({ variant, size, icon, block }, className)} {...rest}>
      {children}
    </Link>
  );
}
