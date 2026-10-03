import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SloganApiPaths } from '@slogan/api-client';
import { adminApi, apiError } from '../../api/client';
import { formatTime, shortId } from '../../utils/format';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DetailDrawer } from '../../components/DetailDrawer';
import { DataTable, PageHeading, StatusPill } from '../../components/PageParts';
import { useCursorPage } from '../../hooks/useCursorPage';
import { useAuth } from '../auth/auth-context';
import { statusLabel, zhCN } from '../../i18n/zh-CN';

type AppealPage =
  SloganApiPaths['/v1/backoffice/safety/appeals']['get']['responses'][200]['content']['application/json'];
type Appeal = AppealPage['items'][number];

export function AppealsPage() {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Appeal['status'] | ''>('');
  const [selected, setSelected] = useState<Appeal | null>(null);
  const [decision, setDecision] = useState<'UPHELD' | 'LIFTED' | null>(null);
  const [reviewDecision, setReviewDecision] = useState(false);
  const [decisionRequestId, setDecisionRequestId] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const page = useCursorPage(['admin', 'appeals', status], async (cursor) => {
    const result = await adminApi.GET('/v1/backoffice/safety/appeals', {
      params: {
        query: { limit: 20, ...(status ? { status } : {}), ...(cursor ? { cursor } : {}) },
      },
    });
    if (!result.response.ok || !result.data) throw apiError(result.response, result.error);
    return result.data;
  });
  const summary = useQuery({
    queryKey: ['admin', 'appeals', 'summary'],
    queryFn: async () => {
      const { data, error, response } = await adminApi.GET('/v1/backoffice/safety/appeals/summary');
      if (!response.ok || !data) throw apiError(response, error);
      return data;
    },
  });
  async function decide() {
    if (!selected || !decision) return;
    setBusy(true);
    setError('');
    try {
      const result = await adminApi.POST('/v1/backoffice/safety/appeals/{appealId}/decide', {
        params: { path: { appealId: selected.id } },
        body: { clientRequestId: decisionRequestId, decision, reason: reason.trim() },
      });
      if (!result.response.ok) throw apiError(result.response, result.error);
      setDecision(null);
      setReviewDecision(false);
      setSelected(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'appeals'] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '申诉处理失败');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'appeals'] });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading {...zhCN.pages.appeals} />
      <div className="metric-row" aria-label="申诉统计">
        {[
          ['待处理申诉', summary.data?.pending],
          ['维持限制', summary.data?.upheld],
          ['解除限制', summary.data?.lifted],
        ].map(([label, value]) => (
          <div className="metric-card" key={label}>
            <p>{label}</p>
            <strong>{summary.isPending || summary.error ? '—' : value}</strong>
          </div>
        ))}
      </div>
      {summary.error && <p role="alert">申诉统计加载失败，请刷新页面重试。</p>}
      <DataTable<Appeal>
        title="申诉列表"
        rows={page.rows}
        loading={page.isPending}
        error={page.error}
        onRetry={() => void page.refetch()}
        page={page.page}
        canNext={page.canNext}
        onPrevious={page.previous}
        onNext={page.next}
        filters={
          <select
            aria-label="申诉状态"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as Appeal['status'] | '');
              page.reset();
            }}
          >
            <option value="">全部状态</option>
            {(['PENDING', 'UPHELD', 'LIFTED'] as const).map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
        }
        columns={[
          { key: 'id', label: '申诉编号', render: (row) => shortId(row.id) },
          { key: 'restriction', label: '限制编号', render: (row) => shortId(row.restrictionId) },
          { key: 'user', label: '用户', render: (row) => shortId(row.userId) },
          { key: 'submitted', label: '提交时间', render: (row) => formatTime(row.submittedAt) },
          {
            key: 'status',
            label: '状态',
            render: (row) => <StatusPill value={statusLabel(row.status)} />,
          },
          {
            key: 'action',
            label: '操作',
            render: (row) => (
              <button className="text-link" onClick={() => setSelected(row)}>
                {zhCN.common.view} ›
              </button>
            ),
          },
        ]}
      />
      {selected && (
        <DetailDrawer title={`申诉详情 · ${shortId(selected.id)}`} onClose={() => { setSelected(null); setReviewDecision(false); }}>
          <dl className="drawer-summary">
            <div>
              <dt>申诉编号</dt>
              <dd>{shortId(selected.id)}</dd>
            </div>
            <div>
              <dt>限制编号</dt>
              <dd>{shortId(selected.restrictionId)}</dd>
            </div>
            <div>
              <dt>用户</dt>
              <dd>{shortId(selected.userId)}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>{statusLabel(selected.status)}</dd>
            </div>
            {selected.decisionReason && <div><dt>决定原因</dt><dd>{selected.decisionReason}</dd></div>}
          </dl>
          <h3 className="drawer-section-title">用户陈述</h3>
          <div className="drawer-evidence"><p>{selected.reason}</p></div>
          {me?.roles.includes('SAFETY_OFFICER') && selected.status === 'PENDING' && (
            <form onSubmit={(event) => { event.preventDefault(); if (decision && reason.trim()) { setError(''); setReviewDecision(true); } else setError('请选择决定并填写理由'); }}>
              <h3 className="drawer-section-title">人工复核决定</h3>
              <div className="drawer-radio-row">
                {([['UPHELD', '维持限制'], ['LIFTED', '解除限制']] as const).map(([value, label]) => (
                  <label key={value}>
                    <input type="radio" name="appeal-decision" checked={decision === value} onChange={() => { setDecision(value); setDecisionRequestId(crypto.randomUUID()); }} />{label}
                  </label>
                ))}
              </div>
              <label className="drawer-field">
                <span className="sr-only">复核理由</span>
                <textarea required maxLength={500} value={reason} placeholder="填写复核理由" onChange={(event) => setReason(event.target.value)} />
              </label>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button className="primary-button drawer-primary">提交复核决定</button>
            </form>
          )}
        </DetailDrawer>
      )}
      {decision && reviewDecision && (
        <ConfirmDialog
          title="确认敏感操作"
          busy={busy}
          error={error}
          sensitive
          onCancel={() => setReviewDecision(false)}
          onConfirm={() => void decide()}
        >
          <p>此操作会变更安全处理结果。请核对目标与原因后再确认。<br />{decision === 'LIFTED' ? '解除限制' : '维持限制'} · {shortId(selected?.id ?? '')}</p>
        </ConfirmDialog>
      )}
    </>
  );
}
