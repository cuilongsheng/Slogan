import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SloganApiPaths } from '@slogan/api-client';
import { adminApi, apiError } from '../../api/client';
import { formatTime, shortId } from '../../utils/format';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DetailDrawer } from '../../components/DetailDrawer';
import { DataTable, Notice, PageHeading, StatusPill } from '../../components/PageParts';
import { useCursorPage } from '../../hooks/useCursorPage';
import { zhCN } from '../../i18n/zh-CN';

type RolePage =
  SloganApiPaths['/v1/backoffice/role-assignments']['get']['responses'][200]['content']['application/json'];
type Assignment = RolePage['items'][number];
type Role = Assignment['role'];
const roleNames: Record<Role, string> = {
  PLATFORM_ADMIN: '平台管理员',
  SAFETY_OFFICER: '安全员',
  OPERATIONS_ANALYST: '运营分析员',
  AUDITOR: '审计员',
};
const roles = Object.keys(roleNames) as Role[];

export function RolesPage() {
  const queryClient = useQueryClient();
  const [roleFilter, setRoleFilter] = useState<Role | ''>('');
  const [mutation, setMutation] = useState<'grant' | 'revoke' | null>(null);
  const [grantReview, setGrantReview] = useState(false);
  const [mutationRequestId, setMutationRequestId] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [targetRole, setTargetRole] = useState<Role>('SAFETY_OFFICER');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const page = useCursorPage(['admin', 'roles', roleFilter], async (cursor) => {
    const result = await adminApi.GET('/v1/backoffice/role-assignments', {
      params: {
        query: {
          limit: 20,
          ...(roleFilter ? { role: roleFilter } : {}),
          ...(cursor ? { cursor } : {}),
        },
      },
    });
    if (!result.response.ok || !result.data) throw apiError(result.response, result.error);
    return result.data;
  });
  function startGrant() {
    setMutationRequestId(crypto.randomUUID());
    setTargetUserId('');
    setTargetRole('SAFETY_OFFICER');
    setReason('');
    setError('');
    setGrantReview(false);
    setMutation('grant');
  }
  function startRevoke(row: Assignment) {
    setMutationRequestId(crypto.randomUUID());
    setTargetUserId(row.userId);
    setTargetRole(row.role);
    setReason('');
    setError('');
    setMutation('revoke');
  }
  async function submit() {
    if (!mutation) return;
    setBusy(true);
    setError('');
    try {
      const params = { path: { userId: targetUserId.trim(), role: targetRole } };
      const body = { clientRequestId: mutationRequestId, reason: reason.trim() };
      const result =
        mutation === 'grant'
          ? await adminApi.POST('/v1/backoffice/users/{userId}/roles/{role}/grant', {
              params,
              body,
            })
          : await adminApi.POST('/v1/backoffice/users/{userId}/roles/{role}/revoke', {
              params,
              body,
            });
      if (!result.response.ok) throw apiError(result.response, result.error);
      setMutation(null);
      await queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '角色变更失败');
      await queryClient.invalidateQueries({ queryKey: ['admin', 'roles'] });
    } finally {
      setBusy(false);
    }
  }
  function reviewGrant() {
    if (!/^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(targetUserId.trim())) {
      setError('请输入有效的用户 UUID');
      return;
    }
    if (!reason.trim()) {
      setError('请填写变更原因');
      return;
    }
    setError('');
    setGrantReview(true);
  }
  return (
    <>
      <PageHeading {...zhCN.pages.roles} />
      <Notice>
        <div>
          <strong>授权需记录原因</strong>仅平台管理员可修改；系统始终保留至少一名有效平台管理员
        </div>
        <button className="primary-button" onClick={startGrant}>
          ＋ 授予角色
        </button>
      </Notice>
      <DataTable<Assignment>
        title="角色列表"
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
            aria-label="角色筛选"
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value as Role | '');
              page.reset();
            }}
          >
            <option value="">全部角色</option>
            {roles.map((role) => (
              <option value={role} key={role}>
                {roleNames[role]}
              </option>
            ))}
          </select>
        }
        columns={[
          { key: 'user', label: '用户标识', render: (row) => shortId(row.userId) },
          { key: 'role', label: '当前角色', render: (row) => roleNames[row.role] },
          {
            key: 'status',
            label: '账号状态',
            render: (row) => <StatusPill value={row.active ? '有效授权' : '已撤销'} />,
          },
          { key: 'granted', label: '授权时间', render: (row) => formatTime(row.grantedAt) },
          {
            key: 'revoked',
            label: '撤销时间',
            render: (row) => formatTime(row.revokedAt as string | null),
          },
          {
            key: 'action',
            label: '操作',
            render: (row) =>
              row.active ? (
                <button className="text-link" onClick={() => startRevoke(row)}>
                  撤销
                </button>
              ) : (
                '—'
              ),
          },
        ]}
      />
      {mutation === 'grant' && !grantReview && (
        <DetailDrawer title="授予后台角色" onClose={() => setMutation(null)}>
          <p className="drawer-intro">仅平台管理员可操作。授予会写入审计记录。</p>
          <form onSubmit={(event) => { event.preventDefault(); reviewGrant(); }}>
            <label className="drawer-field">
              目标用户 ID
              <input required value={targetUserId} placeholder="输入已存在的用户标识" onChange={(event) => setTargetUserId(event.target.value)} />
            </label>
            <label className="drawer-field">
              选择角色
              <select value={targetRole} onChange={(event) => setTargetRole(event.target.value as Role)}>
                {roles.map((role) => <option key={role} value={role}>{roleNames[role]}</option>)}
              </select>
            </label>
            <label className="drawer-field">
              变更原因
              <textarea required maxLength={500} value={reason} placeholder="说明授予原因" onChange={(event) => setReason(event.target.value)} />
            </label>
            <p className="drawer-warning">系统会拒绝移除最后一名有效平台管理员。</p>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button className="primary-button drawer-primary">下一步：确认</button>
          </form>
        </DetailDrawer>
      )}
      {(mutation === 'revoke' || (mutation === 'grant' && grantReview)) && (
        <ConfirmDialog
          title="确认敏感操作"
          busy={busy}
          error={error}
          sensitive={mutation === 'grant'}
          onCancel={() => mutation === 'grant' ? setGrantReview(false) : setMutation(null)}
          onConfirm={() => void submit()}
        >
          {mutation === 'grant' ? (
            <p>此操作会变更后台授权或安全处理结果。请核对目标与原因后再确认。<br />{shortId(targetUserId)} · {roleNames[targetRole]}</p>
          ) : <>
          <label>
            用户标识
            <input
              required
              pattern="[a-fA-F0-9-]{36}"
              readOnly={mutation === 'revoke'}
              value={targetUserId}
              onChange={(event) => setTargetUserId(event.target.value)}
            />
          </label>
          <label>
            角色
            <select
              value={targetRole}
              disabled={mutation === 'revoke'}
              onChange={(event) => setTargetRole(event.target.value as Role)}
            >
              {roles.map((role) => (
                <option key={role} value={role}>
                  {roleNames[role]}
                </option>
              ))}
            </select>
          </label>
          <label>
            变更原因
            <textarea
              required
              maxLength={500}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          </>}
        </ConfirmDialog>
      )}
    </>
  );
}
