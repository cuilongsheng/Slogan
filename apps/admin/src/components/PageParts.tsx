import type { ReactNode } from 'react';
import { zhCN } from '../i18n/zh-CN';

export function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  );
}

export function Notice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="notice">
      <div>{children}</div>
      {action}
    </div>
  );
}

export function StatusPill({ value }: { value: string }) {
  const tone = /待处理|降级中|已驳回|拒绝|已满/.test(value)
    ? 'amber'
    : /进行中|已结案|已恢复|已解除|成功|有效/.test(value)
      ? 'green'
      : 'purple';
  return <span className={`status-pill ${tone}`}>{value}</span>;
}

export function DataTable<T>({
  title,
  rows,
  columns,
  loading,
  error,
  onRetry,
  filters,
  page,
  canNext,
  onPrevious,
  onNext,
}: {
  title: string;
  rows: T[];
  columns: Array<{ key: string; label: string; render: (row: T) => ReactNode }>;
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  filters?: ReactNode;
  page: number;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <section className="data-panel">
      <div className="data-panel-heading">
        <h2>{title}</h2>
        {!loading && !error && (
          <span>
            {zhCN.common.show} {rows.length} {zhCN.common.items}
          </span>
        )}
      </div>
      {filters && <div className="filter-row">{filters}</div>}
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>{column.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!loading &&
              !error &&
              rows.map((row, index) => (
                <tr key={index}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.render(row)}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <div className="table-footer">
        <span role="status">
          {loading
            ? zhCN.common.loading
            : error
              ? error.message === 'BACKOFFICE_ACCESS_DENIED'
                ? zhCN.common.denied
                : zhCN.common.error
              : rows.length === 0
                ? zhCN.common.empty
                : `${zhCN.common.show} ${rows.length} ${zhCN.common.items}`}
        </span>
        <div className="pager">
          {error && <button onClick={onRetry}>{zhCN.common.retry}</button>}
          <button disabled={page <= 1 || loading} onClick={onPrevious}>
            {zhCN.common.previous}
          </button>
          <span>{page}</span>
          <button disabled={!canNext || loading} onClick={onNext}>
            {zhCN.common.next}
          </button>
        </div>
      </div>
    </section>
  );
}
