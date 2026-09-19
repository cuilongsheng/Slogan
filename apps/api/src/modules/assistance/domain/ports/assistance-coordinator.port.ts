export const ASSISTANCE_COORDINATOR = Symbol('ASSISTANCE_COORDINATOR');

export interface AssistancePermit {
  release(): Promise<void>;
}

export interface AssistanceCoordinator {
  acquire(userId: string): Promise<AssistancePermit>;
}
