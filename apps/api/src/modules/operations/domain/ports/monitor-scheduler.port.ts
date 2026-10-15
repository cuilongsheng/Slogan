export const MONITOR_SCHEDULER = Symbol('MONITOR_SCHEDULER');
export interface MonitorScheduler {
  schedule(environment: string, intervalSeconds: number, window: number): Promise<void>;
}
