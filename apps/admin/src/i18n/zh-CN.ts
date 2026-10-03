export const zhCN = {
  app: 'Slogan',
  console: '管理后台',
  groups: { business: '业务管理', safety: '安全中心', governance: '权限与审计' },
  pages: {
    rooms: { title: '房间管理', subtitle: '查看当前房间状态与成员容量' },
    cases: { title: '安全案件', subtitle: '集中处理举报、违规线索与跟进记录' },
    appeals: { title: '限制申诉', subtitle: '安全员人工复核待处理申诉' },
    incidents: { title: '安全降级事件', subtitle: '查看语音安全能力的降级与恢复事件' },
    roles: { title: '后台角色', subtitle: '管理后台多角色授权与变更原因' },
    audit: { title: '操作审计', subtitle: '按时间、动作与目标查询审计记录' },
  },
  common: {
    allStatuses: '全部状态',
    search: '搜索',
    retry: '重试',
    loading: '正在加载…',
    empty: '暂无记录',
    denied: '当前账号无权查看此内容',
    error: '加载失败，请重试',
    previous: '上一页',
    next: '下一页',
    view: '查看',
    cancel: '取消',
    confirm: '确认',
    signOut: '退出登录',
    signIn: '登录',
    username: '用户名',
    password: '密码',
    noAccess: '此账号尚未获授后台角色',
    refresh: '刷新',
    reset: '重置筛选',
    show: '显示',
    items: '条',
    details: '详情',
    reason: '原因',
    close: '关闭',
  },
} as const;

const statuses: Record<string, string> = {
  OPEN: '进行中',
  SCHEDULED: '预约中',
  ENDING: '即将结束',
  ENDED: '已结束',
  CANCELLED: '已取消',
  UNDER_REVIEW: '处理中',
  RESOLVED: '已结案',
  DISMISSED: '已驳回',
  PENDING: '待处理',
  UPHELD: '已维持',
  LIFTED: '已解除',
  RECOVERED: '已恢复',
  SUCCEEDED: '成功',
  REJECTED: '拒绝',
};
export function statusLabel(value: string) {
  return statuses[value] ?? value;
}

const categories: Record<string, string> = {
  HARASSMENT_ABUSE: '骚扰辱骂',
  HATE_DISCRIMINATION: '仇恨歧视',
  SEXUAL_CONTENT: '色情内容',
  SPAM_ADVERTISING: '垃圾广告',
  OTHER: '其他',
};
export function categoryLabel(value: string) {
  return categories[value] ?? value;
}

const severities: Record<string, string> = {
  GENERAL: '一般',
  SERIOUS: '严重',
  HIGH_RISK: '高风险',
};
export function severityLabel(value: string) {
  return severities[value] ?? value;
}

const components: Record<string, string> = {
  MEDIA_SUBSCRIPTION: '音频订阅',
  STREAMING_STT: '实时转写',
  RISK_RULES: '风险规则',
  COORDINATION: '安全协调',
  HOST_ALERT_DELIVERY: '房主提醒',
  KEYWORD_CANDIDATE_EXTRACTION: '关键词提取',
  KEYWORD_CANDIDATE_STORE: '关键词存储',
};
export function componentLabel(value: string) {
  return components[value] ?? value;
}

const auditActions: Record<string, string> = {
  BACKOFFICE_BOOTSTRAPPED: '后台初始化',
  ROLE_GRANTED: '授予角色',
  ROLE_REVOKED: '撤销角色',
  SAFETY_CASE_CREATED: '创建安全案件',
  SAFETY_CASE_RESOLVED: '安全案件结案',
  SAFETY_CASE_DISMISSED: '驳回安全案件',
  SAFETY_APPEAL_DECIDED: '处理限制申诉',
  SAFETY_RESTRICTION_LIFTED: '解除安全限制',
};
export function auditActionLabel(value: string) {
  return auditActions[value] ?? value;
}

const backofficeRoles: Record<string, string> = {
  PLATFORM_ADMIN: '平台管理员',
  SAFETY_OFFICER: '安全员',
  OPERATIONS_ANALYST: '运营分析员',
  AUDITOR: '审计员',
};
export function backofficeRoleLabel(value: string) {
  return backofficeRoles[value] ?? value;
}

const auditTargets: Record<string, string> = {
  BACKOFFICE_ROLE_ASSIGNMENT: '后台角色授权',
  SAFETY_CASE: '安全案件',
  SAFETY_APPEAL: '限制申诉',
  ROOM: '房间',
  USER: '用户',
};
export function auditTargetLabel(value: string) {
  return auditTargets[value] ?? value;
}
