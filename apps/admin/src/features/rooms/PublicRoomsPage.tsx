import type { SloganApiPaths } from '@slogan/api-client';
import { adminApi, apiError } from '../../api/client';
import { PageHeading, StatusPill } from '../../components/PageParts';
import { useCursorPage } from '../../hooks/useCursorPage';
import { statusLabel, zhCN } from '../../i18n/zh-CN';
import { formatTime } from '../../utils/format';
type Page =
  SloganApiPaths['/v1/backoffice/public-rooms']['get']['responses'][200]['content']['application/json'];
export function PublicRoomsPage() {
  const page = useCursorPage(
    ['admin', 'public-rooms'],
    async (cursor): Promise<Page> => {
      const { data, response, error } = await adminApi.GET('/v1/backoffice/public-rooms', {
        params: { query: { limit: 20, ...(cursor ? { cursor } : {}) } },
      });
      if (!response.ok || !data) throw apiError(response, error);
      return data;
    },
    { refetchInterval: 30_000 },
  );
  return (
    <>
      <PageHeading {...zhCN.pages.rooms} />
      <p className="room-meta">
        只读体验：仅展示公开的进行中和预约房间，不提供成员身份、举报、审核记录或管理操作。
      </p>
      {page.data && (
        <div className="room-filters">
          <span>
            进行中 {page.data.openCount} · 预约 {page.data.scheduledCount}
          </span>
        </div>
      )}
      {page.isPending ? (
        <div className="page-state">{zhCN.common.loading}</div>
      ) : page.error ? (
        <div className="page-state" role="alert">
          {zhCN.common.error}{' '}
          <button onClick={() => void page.refetch()}>{zhCN.common.retry}</button>
        </div>
      ) : page.rows.length === 0 ? (
        <div className="page-state">{zhCN.common.empty}</div>
      ) : (
        <div className="room-grid">
          {page.rows.map((room) => (
            <article className="room-card" key={room.id}>
              <div className="room-card-top">
                <h2>{room.topic}</h2>
                <StatusPill value={statusLabel(room.status)} />
              </div>
              <p className="room-meta">
                {room.kind === 'APPOINTMENT' ? '预约房间' : '即时房间'} ·{' '}
                {room.cefrLevelMin && room.cefrLevelMax
                  ? `${room.cefrLevelMin}–${room.cefrLevelMax}`
                  : room.cefrLevel.replaceAll('_', '–')}
              </p>
              <div className="room-card-bottom">
                <strong>
                  {room.memberCount} / {room.capacity} 人
                </strong>
                <span>
                  {formatTime(room.status === 'SCHEDULED' ? room.startedAt : room.endsAt)}
                </span>
              </div>
              <dl className="room-details">
                <div>
                  <dt>创建时间</dt>
                  <dd>{formatTime(room.createdAt)}</dd>
                </div>
              </dl>
            </article>
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
