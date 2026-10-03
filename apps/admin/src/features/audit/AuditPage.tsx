import { useState } from 'react';
import type { SloganApiPaths } from '@slogan/api-client';
import { adminApi, apiError } from '../../api/client';
import { formatTime, shortId } from '../../utils/format';
import { DataTable, Notice, PageHeading, StatusPill } from '../../components/PageParts';
import { DetailDrawer } from '../../components/DetailDrawer';
import { useCursorPage } from '../../hooks/useCursorPage';
import { auditActionLabel, auditTargetLabel, backofficeRoleLabel, statusLabel, zhCN } from '../../i18n/zh-CN';

type AuditPageData =
  SloganApiPaths['/v1/backoffice/audit-events']['get']['responses'][200]['content']['application/json'];
type AuditEvent = AuditPageData['items'][number];
type AuditResult = AuditEvent['result'];

export function AuditPage() {
  const [result, setResult] = useState<AuditResult | ''>('');
  const [range, setRange] = useState<'' | '7d' | '30d'>('');
  const [selected, setSelected] = useState<AuditEvent | null>(null);
  const page = useCursorPage(['admin', 'audit', result, range], async (cursor) => {
    const value = await adminApi.GET('/v1/backoffice/audit-events', {
      params: {
        query: {
          limit: 20,
          ...(result ? { result } : {}),
          ...(range ? { from: new Date(Date.now() - (range === '7d' ? 7 : 30) * 86400000).toISOString() } : {}),
          ...(cursor ? { cursor } : {}),
        },
      },
    });
    if (!value.response.ok || !value.data) throw apiError(value.response, value.error);
    return value.data;
  });
  return (
    <>
      <PageHeading {...zhCN.pages.audit} />
      <Notice>
        <strong>审计记录只读</strong>记录敏感查看与角色变更；不提供编辑或删除
      </Notice>
      <DataTable<AuditEvent>
        title="审计事件"
        rows={page.rows}
        loading={page.isPending}
        error={page.error}
        onRetry={() => void page.refetch()}
        page={page.page}
        canNext={page.canNext}
        onPrevious={page.previous}
        onNext={page.next}
        filters={<>
          <select
            aria-label="审计结果"
            value={result}
            onChange={(event) => {
              setResult(event.target.value as AuditResult | '');
              page.reset();
            }}
          >
            <option value="">全部结果</option>
            <option value="SUCCEEDED">成功</option>
            <option value="REJECTED">拒绝</option>
          </select>
          <select aria-label="审计时间" value={range} onChange={(event) => { setRange(event.target.value as typeof range); page.reset(); }}>
            <option value="">全部时间</option>
            <option value="7d">最近 7 天</option>
            <option value="30d">最近 30 天</option>
          </select>
        </>}
        columns={[
          { key: 'at', label: '发生时间', render: (row) => formatTime(row.occurredAt) },
          { key: 'action', label: '动作', render: (row) => auditActionLabel(row.action) },
          {
            key: 'actor',
            label: '操作者',
            render: (row) =>
              row.actorType === 'USER' ? shortId(row.actorUserId as string | null) : row.actorType,
          },
          { key: 'roles', label: '角色快照', render: (row) => row.actorRoles.map(backofficeRoleLabel).join('、') || '—' },
          {
            key: 'target',
            label: '目标',
            render: (row) => (
              <>
                {auditTargetLabel(row.targetType)} · {shortId(row.targetId as string | null)}
              </>
            ),
          },
          {
            key: 'result',
            label: '结果',
            render: (row) => <StatusPill value={statusLabel(row.result)} />,
          },
          {
            key: 'view',
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
        <DetailDrawer title="审计记录" onClose={() => setSelected(null)}>
          <dl>
            <div>
              <dt>事件标识</dt>
              <dd>{selected.id}</dd>
            </div>
            <div>
              <dt>发生时间</dt>
              <dd>{formatTime(selected.occurredAt)}</dd>
            </div>
            <div>
              <dt>动作</dt>
              <dd>{auditActionLabel(selected.action)}</dd>
            </div>
            <div>
              <dt>操作者类型</dt>
              <dd>{selected.actorType}</dd>
            </div>
            <div>
              <dt>操作者</dt>
              <dd>{String(selected.actorUserId ?? '—')}</dd>
            </div>
            <div>
              <dt>当时角色</dt>
              <dd>{selected.actorRoles.map(backofficeRoleLabel).join('、') || '—'}</dd>
            </div>
            <div>
              <dt>目标</dt>
              <dd>
                {auditTargetLabel(selected.targetType)} / {String(selected.targetId ?? '—')}
              </dd>
            </div>
            <div>
              <dt>结果</dt>
              <dd>{statusLabel(selected.result)}</dd>
            </div>
            <div>
              <dt>原因</dt>
              <dd>{String(selected.reason ?? '—')}</dd>
            </div>
            <div>
              <dt>请求标识</dt>
              <dd>{String(selected.requestId ?? '—')}</dd>
            </div>
          </dl>
        </DetailDrawer>
      )}
    </>
  );
}
