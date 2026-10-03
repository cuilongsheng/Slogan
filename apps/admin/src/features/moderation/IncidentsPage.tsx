import { useState } from 'react';
import type { SloganApiPaths } from '@slogan/api-client';
import { adminApi, apiError } from '../../api/client';
import { formatTime, shortId } from '../../utils/format';
import { DataTable, Notice, PageHeading, StatusPill } from '../../components/PageParts';
import { DetailDrawer } from '../../components/DetailDrawer';
import { useCursorPage } from '../../hooks/useCursorPage';
import { componentLabel, statusLabel, zhCN } from '../../i18n/zh-CN';

type IncidentPage =
  SloganApiPaths['/v1/backoffice/safety-capability-incidents']['get']['responses'][200]['content']['application/json'];
type Incident = IncidentPage['items'][number];

export function IncidentsPage() {
  const [status, setStatus] = useState<Incident['status'] | ''>('');
  const [component, setComponent] = useState<Incident['component'] | ''>('');
  const [range, setRange] = useState<'' | '7d' | '30d'>('');
  const [selected, setSelected] = useState<Incident | null>(null);
  const page = useCursorPage(['admin', 'safety-incidents', status, component, range], async (cursor) => {
    const result = await adminApi.GET('/v1/backoffice/safety-capability-incidents', {
      params: {
        query: {
          limit: 20,
          ...(status ? { status } : {}),
          ...(component ? { component } : {}),
          ...(range ? { from: new Date(Date.now() - (range === '7d' ? 7 : 30) * 86400000).toISOString() } : {}),
          ...(cursor ? { cursor } : {}),
        },
      },
    });
    if (!result.response.ok || !result.data) throw apiError(result.response, result.error);
    return result.data;
  });
  return (
    <>
      <PageHeading {...zhCN.pages.incidents} />
      <Notice>
        <strong>只读运行记录</strong>按房间、组件、状态与时间查询降级与恢复事件
      </Notice>
      <DataTable<Incident>
        title="降级事件"
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
            aria-label="事件状态"
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as Incident['status'] | '');
              page.reset();
            }}
          >
            <option value="">全部状态</option>
            <option value="OPEN">降级中</option>
            <option value="RECOVERED">已恢复</option>
          </select>
          <select aria-label="能力组件" value={component} onChange={(event) => { setComponent(event.target.value as typeof component); page.reset(); }}>
            <option value="">全部组件</option>
            {(['MEDIA_SUBSCRIPTION', 'STREAMING_STT', 'RISK_RULES', 'COORDINATION', 'HOST_ALERT_DELIVERY', 'KEYWORD_CANDIDATE_EXTRACTION', 'KEYWORD_CANDIDATE_STORE'] as const).map((value) => <option key={value} value={value}>{componentLabel(value)}</option>)}
          </select>
          <select aria-label="事件时间" value={range} onChange={(event) => { setRange(event.target.value as typeof range); page.reset(); }}>
            <option value="">全部时间</option>
            <option value="7d">最近 7 天</option>
            <option value="30d">最近 30 天</option>
          </select>
        </>}
        columns={[
          { key: 'id', label: '事件编号', render: (row) => shortId(row.id) },
          { key: 'room', label: '关联房间', render: (row) => shortId(row.roomId) },
          { key: 'component', label: '组件', render: (row) => componentLabel(row.component) },
          {
            key: 'status',
            label: '状态',
            render: (row) => (
              <StatusPill value={row.status === 'OPEN' ? '降级中' : statusLabel(row.status)} />
            ),
          },
          { key: 'started', label: '开始时间', render: (row) => formatTime(row.startedAt) },
          { key: 'recovered', label: '恢复时间', render: (row) => formatTime(row.recoveredAt) },
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
        <DetailDrawer title="安全降级事件" onClose={() => setSelected(null)}>
          <dl>
            <div>
              <dt>事件编号</dt>
              <dd>{selected.id}</dd>
            </div>
            <div>
              <dt>关联房间</dt>
              <dd>{selected.roomId ?? '全局'}</dd>
            </div>
            <div>
              <dt>组件</dt>
              <dd>{componentLabel(selected.component)}</dd>
            </div>
            <div>
              <dt>状态</dt>
              <dd>{statusLabel(selected.status)}</dd>
            </div>
            <div>
              <dt>错误类别</dt>
              <dd>{selected.errorCategory}</dd>
            </div>
            <div>
              <dt>服务商类别</dt>
              <dd>{selected.providerCategory ?? '—'}</dd>
            </div>
            <div>
              <dt>影响窗口</dt>
              <dd>{selected.affectedWindows}</dd>
            </div>
            <div>
              <dt>开始时间</dt>
              <dd>{formatTime(selected.startedAt)}</dd>
            </div>
            <div>
              <dt>最近观测</dt>
              <dd>{formatTime(selected.lastObservedAt)}</dd>
            </div>
            <div>
              <dt>恢复时间</dt>
              <dd>{formatTime(selected.recoveredAt)}</dd>
            </div>
          </dl>
        </DetailDrawer>
      )}
    </>
  );
}
