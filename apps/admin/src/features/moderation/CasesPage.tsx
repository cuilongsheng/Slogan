import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SloganApiPaths } from '@slogan/api-client';
import { adminApi, apiError } from '../../api/client';
import { formatTime, shortId } from '../../utils/format';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, PageHeading, StatusPill } from '../../components/PageParts';
import { DetailDrawer } from '../../components/DetailDrawer';
import { useAuth } from '../auth/auth-context';
import { useCursorPage } from '../../hooks/useCursorPage';
import { categoryLabel, severityLabel, statusLabel, zhCN } from '../../i18n/zh-CN';

type CasePage =
  SloganApiPaths['/v1/backoffice/safety/cases']['get']['responses'][200]['content']['application/json'];
type SafetyCase = CasePage['items'][number];
type CaseStatus = SafetyCase['status'];
type Command = 'claim' | 'start' | 'dismiss' | 'resolve';

export function CasesPage() {
  const { me } = useAuth();
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<CaseStatus | ''>('');
  const [range, setRange] = useState<'' | '7d' | '30d'>('');
  const [selected, setSelected] = useState<string | null>(null);
  const [command, setCommand] = useState<Command | null>(null);
  const [commandRequestId, setCommandRequestId] = useState('');
  const [reason, setReason] = useState('');
  const [resolution, setResolution] = useState<
    'NO_ACTION' | 'TEMPORARY_RESTRICTION' | 'PERMANENT_DISABLE'
  >('NO_ACTION');
  const [severity, setSeverity] = useState<'GENERAL' | 'SERIOUS' | 'HIGH_RISK'>('GENERAL');
  const [factsConfirmed, setFactsConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [commandError, setCommandError] = useState('');
  const page = useCursorPage(['admin', 'cases', status, range], async (cursor) => {
    const { data, error, response } = await adminApi.GET('/v1/backoffice/safety/cases', {
      params: {
        query: {
          limit: 20,
          ...(status ? { status } : {}),
          ...(range ? { from: new Date(Date.now() - (range === '7d' ? 7 : 30) * 86400000).toISOString() } : {}),
          ...(cursor ? { cursor } : {}),
        },
      },
    });
    if (!response.ok || !data) throw apiError(response, error);
    return data;
  });
  const summary = useQuery({
    queryKey: ['admin', 'cases', 'summary'],
    queryFn: async () => {
      const { data, error, response } = await adminApi.GET('/v1/backoffice/safety/cases/summary');
      if (!response.ok || !data) throw apiError(response, error);
      return data;
    },
  });
  const detail = useQuery({
    queryKey: ['admin', 'case', selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error, response } = await adminApi.GET('/v1/backoffice/safety/cases/{caseId}', {
        params: { path: { caseId: selected! } },
      });
      if (!response.ok || !data) throw apiError(response, error);
      return data;
    },
  });
  const evidence = useQuery({
    queryKey: ['admin', 'case-evidence', selected],
    enabled: !!selected,
    queryFn: async () => {
      const { data, error, response } = await adminApi.GET(
        '/v1/backoffice/safety/cases/{caseId}/evidence',
        { params: { path: { caseId: selected! } } },
      );
      if (!response.ok || !data) throw apiError(response, error);
      return data;
    },
  });
  const canWork = me?.roles.includes('SAFETY_OFFICER') ?? false;
  const isAssignee = detail.data?.assigneeUserId === me?.userId;
  function openCommand(value: Command) {
    setCommandRequestId(crypto.randomUUID());
    setReason('');
    setFactsConfirmed(false);
    setCommandError('');
    setCommand(value);
  }
  async function submitCommand() {
    if (!selected || !command) return;
    setBusy(true);
    setCommandError('');
    try {
      const path = { caseId: selected };
      const clientRequestId = commandRequestId;
      const result =
        command === 'claim'
          ? await adminApi.POST('/v1/backoffice/safety/cases/{caseId}/claim', {
              params: { path },
              body: { clientRequestId },
            })
          : command === 'start'
            ? await adminApi.POST('/v1/backoffice/safety/cases/{caseId}/start', {
                params: { path },
                body: { clientRequestId },
              })
            : command === 'dismiss'
              ? await adminApi.POST('/v1/backoffice/safety/cases/{caseId}/dismiss', {
                  params: { path },
                  body: { clientRequestId, reason: reason.trim() },
                })
              : await adminApi.POST('/v1/backoffice/safety/cases/{caseId}/resolve', {
                  params: { path },
                  body: {
                    clientRequestId,
                    reason: reason.trim(),
                    resolution,
                    ...(resolution !== 'NO_ACTION' ? { severity } : {}),
                    factsConfirmed,
                  },
                });
      if (!result.response.ok) throw apiError(result.response, result.error);
      setCommand(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'cases'] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'case', selected] });
      await queryClient.invalidateQueries({ queryKey: ['admin', 'case-evidence', selected] });
    } catch (error) {
      setCommandError(error instanceof Error ? error.message : '操作失败');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'case', selected] });
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHeading {...zhCN.pages.cases} />
      <div className="metric-row" aria-label="案件统计">
        {[
          ['待处理案件', summary.data?.open],
          ['高风险已判定', summary.data?.highRisk],
          ['已结案', summary.data?.closed],
        ].map(([label, value]) => (
          <div className="metric-card" key={label}>
            <p>{label}</p>
            <strong>{summary.isPending || summary.error ? '—' : value}</strong>
          </div>
        ))}
      </div>
      {summary.error && <p role="alert">案件统计加载失败，请刷新页面重试。</p>}
      <DataTable<SafetyCase>
        title="案件列表"
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
            aria-label="案件状态"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as CaseStatus | '');
              page.reset();
            }}
          >
            <option value="">全部状态</option>
            {(['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'DISMISSED'] as const).map((value) => (
              <option key={value} value={value}>
                {statusLabel(value)}
              </option>
            ))}
          </select>
          <select
            aria-label="发生时间"
            value={range}
            onChange={(event) => {
              setRange(event.target.value as typeof range);
              page.reset();
            }}
          >
            <option value="">全部时间</option>
            <option value="7d">最近 7 天</option>
            <option value="30d">最近 30 天</option>
          </select>
        </>}
        columns={[
          { key: 'id', label: '案件编号', render: (row) => shortId(row.id) },
          { key: 'category', label: '事件类型', render: (row) => categoryLabel(row.category) },
          {
            key: 'target',
            label: '关联房间 / 用户',
            render: (row) => (
              <>
                {shortId(row.roomId)} · {shortId(row.targetUserId)}
              </>
            ),
          },
          { key: 'created', label: '发生时间', render: (row) => formatTime(row.createdAt) },
          { key: 'priority', label: '优先级', render: (row) => row.assessedSeverity ? severityLabel(row.assessedSeverity) : '—' },
          {
            key: 'status',
            label: '状态',
            render: (row) => <StatusPill value={statusLabel(row.status)} />,
          },
          {
            key: 'action',
            label: '操作',
            render: (row) => (
              <button className="text-link" onClick={() => setSelected(row.id)}>
                {zhCN.common.view} ›
              </button>
            ),
          },
        ]}
      />
      {selected && (
        <DetailDrawer title={`案件详情 · ${shortId(selected)}`} onClose={() => setSelected(null)}>
          {detail.isPending ? (
            <p>{zhCN.common.loading}</p>
          ) : detail.error ? (
            <p role="alert">{detail.error.message}</p>
          ) : (
            detail.data && (
              <>
                <dl className="drawer-summary">
                  <div>
                    <dt>案件编号</dt>
                    <dd>{shortId(detail.data.id)}</dd>
                  </div>
                  <div>
                    <dt>状态</dt>
                    <dd>{statusLabel(detail.data.status)}{detail.data.assigneeUserId ? ` · ${shortId(detail.data.assigneeUserId)}` : ''}</dd>
                  </div>
                  <div>
                    <dt>被举报用户</dt>
                    <dd>{shortId(detail.data.targetUserId)}</dd>
                  </div>
                  <div>
                    <dt>关联房间</dt>
                    <dd>{shortId(detail.data.roomId)} · {categoryLabel(detail.data.category)}</dd>
                  </div>
                  {detail.data.decisionType && <div><dt>决定</dt><dd>{detail.data.decisionType}</dd></div>}
                  {detail.data.decisionReason && <div><dt>理由</dt><dd>{detail.data.decisionReason}</dd></div>}
                </dl>
              </>
            )
          )}
          <h3 className="drawer-section-title">可用证据</h3>
          {evidence.isPending ? (
            <p>{zhCN.common.loading}</p>
          ) : evidence.error ? (
            <p role="alert">{evidence.error.message}</p>
          ) : evidence.data ? (
            <div className="drawer-evidence">
              <strong>举报内容摘要</strong>
              <p>{evidence.data.report.description || '举报者未填写说明。'}</p>
              <hr />
              <strong>关联房间与系统事件</strong>
              <p>{evidence.data.activities.length} 条处理活动；只展示服务端实际记录。</p>
            </div>
          ) : null}
          <p className="drawer-warning">案件结论必须由安全员人工提交，并填写理由。</p>
          {canWork && detail.data?.status === 'OPEN' && !detail.data.assigneeUserId && (
            <button className="primary-button drawer-primary" onClick={() => openCommand('claim')}>进入人工处置 · 领取案件</button>
          )}
          {canWork && detail.data?.status === 'OPEN' && isAssignee && (
            <button className="primary-button drawer-primary" onClick={() => openCommand('start')}>进入人工处置 · 开始处理</button>
          )}
          {canWork && detail.data?.status === 'UNDER_REVIEW' && isAssignee && (
            <div className="drawer-actions">
              <button className="outline-button" onClick={() => openCommand('dismiss')}>驳回案件</button>
              <button className="primary-button" onClick={() => openCommand('resolve')}>提交结论</button>
            </div>
          )}
        </DetailDrawer>
      )}
      {command && (
        <ConfirmDialog
          title={
            {
              claim: '确认领取案件',
              start: '确认开始处理',
              dismiss: '确认驳回案件',
              resolve: '确认提交结论',
            }[command]
          }
          busy={busy}
          error={commandError}
          onCancel={() => setCommand(null)}
          onConfirm={() => void submitCommand()}
        >
          {command === 'dismiss' || command === 'resolve' ? (
            <label>
              处理原因
              <textarea
                required
                minLength={1}
                maxLength={500}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          ) : (
            <p>此操作会写入案件处理记录。</p>
          )}
          {command === 'resolve' && (
            <>
              <label>
                结论
                <select
                  value={resolution}
                  onChange={(event) => setResolution(event.target.value as typeof resolution)}
                >
                  <option value="NO_ACTION">不处罚</option>
                  <option value="TEMPORARY_RESTRICTION">临时限制</option>
                  <option value="PERMANENT_DISABLE">永久禁用</option>
                </select>
              </label>
              {resolution !== 'NO_ACTION' && (
                <label>
                  严重程度
                  <select
                    value={severity}
                    onChange={(event) => setSeverity(event.target.value as typeof severity)}
                  >
                    <option value="GENERAL">一般</option>
                    <option value="SERIOUS">严重</option>
                    <option value="HIGH_RISK">高风险</option>
                  </select>
                </label>
              )}
              <label>
                <input
                  type="checkbox"
                  required
                  checked={factsConfirmed}
                  onChange={(event) => setFactsConfirmed(event.target.checked)}
                />{' '}
                已核实案件事实
              </label>
            </>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}
