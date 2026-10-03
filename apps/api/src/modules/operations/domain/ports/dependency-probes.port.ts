export const OPERATIONS_DEPENDENCY_PROBES = Symbol('OPERATIONS_DEPENDENCY_PROBES');

export interface DependencyProbeResult {
  component: 'POSTGRESQL' | 'REDIS' | 'LIVEKIT' | 'AI' | 'STT' | 'SMS';
  enabled: boolean;
  ready: boolean;
  reasonCode?: string;
}

export interface OperationsDependencyProbes {
  check(): Promise<DependencyProbeResult[]>;
}
