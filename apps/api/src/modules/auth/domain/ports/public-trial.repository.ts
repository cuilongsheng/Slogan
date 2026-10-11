export const PUBLIC_TRIAL_REPOSITORY = Symbol('PUBLIC_TRIAL_REPOSITORY');
export const PUBLIC_TRIAL_USERNAMES = ['demo_s1', 'demo_s2', 'demo_m1'] as const;
export interface PublicTrialState {
  userId: string;
  username: string;
  disabled: boolean;
  roles: string[];
}
export interface PublicTrialRepository {
  inspect(environmentId: string): Promise<PublicTrialState[]>;
  provision(
    environmentId: string,
    passwordHash: string | null,
    now: Date,
  ): Promise<{ created: boolean; accounts: PublicTrialState[] }>;
  disable(environmentId: string, now: Date): Promise<number>;
}
