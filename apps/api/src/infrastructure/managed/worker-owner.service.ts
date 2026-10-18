import { AsyncLocalStorage } from 'node:async_hooks';
import { Injectable } from '@nestjs/common';
import { QueueClient, type SendOptions } from '@vercel/queue';
import { PrismaService } from '../database/prisma.service.js';

export interface WorkerFence {
  deploymentId: string;
  generation: number;
}
export interface FencedJob {
  owner?: WorkerFence;
}
export const FALLBACK_SECONDS = 900;
export const IDLE_FALLBACK_SECONDS = 3600;
export function localDelivery(job: FencedJob): boolean {
  return (
    process.env.VERCEL !== '1' ||
    !!(job?.owner && job.owner.deploymentId === process.env.VERCEL_DEPLOYMENT_ID)
  );
}

/** Activation is a release operation, never an election by a cold/obsolete instance. */
@Injectable()
export class WorkerOwner {
  private readonly execution = new AsyncLocalStorage<WorkerFence>();
  constructor(private readonly prisma: PrismaService) {}
  async current(): Promise<WorkerFence | null> {
    return this.prisma.managedWorkerOwner.findUnique({
      where: { key: 'background' },
      select: { deploymentId: true, generation: true },
    });
  }
  async run<T>(job: FencedJob, work: () => Promise<T>): Promise<T | undefined> {
    if (process.env.VERCEL !== '1') return work();
    if (!localDelivery(job)) return;
    const owner = await this.current();
    if (!owner || !same(owner, job.owner!)) return;
    return this.execution.run(owner, work);
  }
  /** Business wakeups route to the owner; work already executing must retain its fence. */
  async send(
    topic: string,
    job: object,
    options: SendOptions = {},
    ownerOnly = false,
  ): Promise<boolean> {
    const owner = await this.current();
    if (!owner) return false;
    const executing = this.execution.getStore();
    if (executing && !same(executing, owner)) return false;
    if (ownerOnly && owner.deploymentId !== process.env.VERCEL_DEPLOYMENT_ID) return false;
    await new QueueClient({ deploymentId: owner.deploymentId }).send(
      topic,
      { ...job, owner },
      {
        ...options,
        ...(options.idempotencyKey
          ? { idempotencyKey: `g${owner.generation}-${options.idempotencyKey}` }
          : {}),
      },
    );
    return true;
  }
}
function same(a: WorkerFence, b: WorkerFence) {
  return a.deploymentId === b.deploymentId && a.generation === b.generation;
}
