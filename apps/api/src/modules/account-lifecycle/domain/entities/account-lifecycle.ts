export interface AccountDeletionResult {
  userId: string;
  status: 'DELETED';
  deletedAt: Date;
}

export interface RestrictedAccountRecord {
  userId: string;
  status: 'DELETED';
  createdAt: Date;
  deletedAt: Date;
  loginMethods: Array<'PHONE' | 'GOOGLE' | 'WECHAT'>;
  profile: {
    displayName: string;
    avatarUrl: string;
    nationalityCode: string | null;
    cefrLevel: string;
  } | null;
  safetyCaseIds: string[];
  restrictionIds: string[];
  appealIds: string[];
}
