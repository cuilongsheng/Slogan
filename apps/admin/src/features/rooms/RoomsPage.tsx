import { useState } from 'react';
import type { SloganApiPaths } from '@slogan/api-client';
import { adminApi, apiError } from '../../api/client';
import { formatTime } from '../../utils/format';
import { PageHeading, StatusPill } from '../../components/PageParts';
import { useCursorPage } from '../../hooks/useCursorPage';
import { statusLabel, zhCN } from '../../i18n/zh-CN';

type RoomPage =
  SloganApiPaths['/v1/backoffice/operations/rooms']['get']['responses'][200]['content']['application/json'];
type RoomQuery = NonNullable<
  SloganApiPaths['/v1/backoffice/operations/rooms']['get']['parameters']['query']
>;
type Room = RoomPage['items'][number];

function roomTime(room: Room) {
  const at = new Date(room.status === 'SCHEDULED' ? room.startedAt! : room.endsAt);
  if (!Number.isFinite(at.getTime())) return '—';
  if (room.status === 'OPEN') {
    const minutes = Math.max(0, Math.ceil((at.getTime() - Date.now()) / 60_000));
    if (!minutes) return '即将结束';
    return minutes < 60
      ? `剩余 ${minutes} 分钟`
      : `剩余 ${Math.floor(minutes / 60)} 小时${minutes % 60 ? ` ${minutes % 60} 分钟` : ''}`;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const afterTomorrow = new Date(tomorrow);
  afterTomorrow.setDate(afterTomorrow.getDate() + 1);
  const clock = new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(at);
  if (at >= tomorrow && at < afterTomorrow) return `明日 ${clock}`;
  if (at >= today && at < tomorrow) return `今日 ${clock}`;
  return formatTime(room.startedAt);
}
function roomCreatedAt(value: string) {
  const at = new Date(value);
  if (!Number.isFinite(at.getTime())) return '—';
  const two = (value: number) => String(value).padStart(2, '0');
  return `${at.getFullYear()}-${two(at.getMonth() + 1)}-${two(at.getDate())} ${two(at.getHours())}:${two(at.getMinutes())}`;
}

function RoomCard({ room }: { room: Room }) {
  return (
    <article className="room-card">
      <div className="room-card-top">
        <h2>{room.topic}</h2>
        <StatusPill
          value={
            room.status === 'OPEN' && room._count.memberships >= room.capacity
              ? '已满'
              : statusLabel(room.status)
          }
        />
      </div>
      <p className="room-meta">
        {room.kind === 'APPOINTMENT' ? '预约房间' : '即时房间'} ·{' '}
        {room.cefrLevelMin && room.cefrLevelMax && room.cefrLevelMin !== room.cefrLevelMax
          ? `${room.cefrLevelMin}–${room.cefrLevelMax}`
          : room.cefrLevel.replaceAll('_', '–')}{' '}
        · {room.visibility === 'PUBLIC' ? '公开' : '链接可见'}
      </p>
      <div className="room-card-bottom">
        <strong>
          {room._count.memberships} / {room.capacity} 人
        </strong>
        <span title={formatTime(room.status === 'SCHEDULED' ? room.startedAt : room.endsAt)}>
          {roomTime(room)}
        </span>
      </div>
      <dl className="room-details">
        <div>
          <dt>预约数</dt>
          <dd>{room._count.reservations}</dd>
        </div>
        <div>
          <dt>举报数</dt>
          <dd>{room._count.reports}</dd>
        </div>
        <div>
          <dt>创建时间</dt>
          <dd>{roomCreatedAt(room.createdAt)}</dd>
        </div>
      </dl>
    </article>
  );
}

export function RoomsPage() {
  const [draftQ, setDraftQ] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | NonNullable<RoomQuery['status']>>('');
  const [visibility, setVisibility] = useState<'' | NonNullable<RoomQuery['visibility']>>('');
  const [range, setRange] = useState<'' | '7d' | '30d'>('');
  const [from, setFrom] = useState('');
  const page = useCursorPage(
    ['admin', 'rooms', q, status, visibility, from],
    async (cursor): Promise<RoomPage> => {
      const { data, error, response } = await adminApi.GET('/v1/backoffice/operations/rooms', {
        params: {
          query: {
            limit: 20,
            scope: 'CURRENT',
            ...(cursor ? { cursor } : {}),
            ...(q ? { q } : {}),
            ...(status ? { status } : {}),
            ...(visibility ? { visibility } : {}),
            ...(from ? { from } : {}),
          },
        },
      });
      if (!response.ok || !data) throw apiError(response, error);
      return data;
    },
    { refetchInterval: 15_000 },
  );
  return (
    <>
      <PageHeading {...zhCN.pages.rooms} />
      <div className="room-filters">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setQ(draftQ.trim());
            page.reset();
          }}
        >
          <input
            aria-label="搜索房间 ID 或主题"
            placeholder="搜索房间 ID / 主题"
            maxLength={100}
            value={draftQ}
            onChange={(event) => setDraftQ(event.target.value)}
          />
        </form>
        <select
          aria-label="房间状态"
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as typeof status);
            page.reset();
          }}
        >
          <option value="">全部当前房间</option>
          {(['OPEN', 'SCHEDULED'] as const).map((value) => (
            <option key={value} value={value}>
              {statusLabel(value)}
            </option>
          ))}
        </select>
        <select
          aria-label="房间可见性"
          value={visibility}
          onChange={(event) => {
            setVisibility(event.target.value as typeof visibility);
            page.reset();
          }}
        >
          <option value="">可见性 ⌄</option>
          <option value="PUBLIC">公开</option>
          <option value="LINK_ONLY">链接可见</option>
        </select>
        <select
          aria-label="创建时间范围"
          value={range}
          onChange={(event) => {
            const value = event.target.value as typeof range;
            setRange(value);
            setFrom(
              value
                ? new Date(Date.now() - (value === '7d' ? 7 : 30) * 86400000).toISOString()
                : '',
            );
            page.reset();
          }}
        >
          <option value="">时间范围 ⌄</option>
          <option value="7d">近 7 天</option>
          <option value="30d">近 30 天</option>
        </select>
        <span>本页 {page.rows.length} 个房间</span>
      </div>
      {page.isPending ? (
        <div className="page-state">{zhCN.common.loading}</div>
      ) : page.error ? (
        <div className="page-state" role="alert">
          {page.error.message === 'BACKOFFICE_ACCESS_DENIED'
            ? zhCN.common.denied
            : zhCN.common.error}{' '}
          <button onClick={() => void page.refetch()}>{zhCN.common.retry}</button>
        </div>
      ) : page.rows.length === 0 ? (
        <div className="page-state">{zhCN.common.empty}</div>
      ) : (
        <div className="room-grid">
          {page.rows.map((room) => (
            <RoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
      {(page.page > 1 || page.canNext) && (
        <div className="room-pagination">
          <button disabled={page.page === 1} onClick={page.previous}>
            {zhCN.common.previous}
          </button>
          <span>{page.page}</span>
          <button disabled={!page.canNext} onClick={page.next}>
            {zhCN.common.next}
          </button>
        </div>
      )}
    </>
  );
}
