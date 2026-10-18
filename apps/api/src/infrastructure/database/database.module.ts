import { Global, Module } from '@nestjs/common';

import { WorkerOwner } from '../managed/worker-owner.service.js';

import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService, WorkerOwner],
  exports: [PrismaService, WorkerOwner],
})
export class DatabaseModule {}
