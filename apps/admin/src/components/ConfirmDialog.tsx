import { useEffect, useRef, type FormEvent, type ReactNode } from 'react';
import { zhCN } from '../i18n/zh-CN';

export function ConfirmDialog({
  title,
  children,
  busy,
  error,
  onCancel,
  onConfirm,
  sensitive = false,
}: {
  title: string;
  children: ReactNode;
  busy?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
  sensitive?: boolean;
}) {
  const focusRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    focusRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);
  function submit(event: FormEvent) {
    event.preventDefault();
    onConfirm();
  }
  return (
    <div
      className="confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        className="confirm-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onSubmit={submit}
      >
        <div className="confirm-header">
          <h2>{title}</h2>
          <button type="button" className="drawer-close" aria-label={zhCN.common.close} disabled={busy} onClick={onCancel}>×</button>
        </div>
        <div className={sensitive ? 'confirm-warning' : 'confirm-body'}>{children}</div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="confirm-actions">
          <button
            type="button"
            className="outline-button"
            ref={focusRef}
            disabled={busy}
            onClick={onCancel}
          >
            {zhCN.common.cancel}
          </button>
          <button className="primary-button" disabled={busy}>
            {busy ? zhCN.common.loading : sensitive ? '确认操作' : zhCN.common.confirm}
          </button>
        </div>
      </form>
    </div>
  );
}
