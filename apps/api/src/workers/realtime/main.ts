import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../../app.module.js';

// A persistent worker owns recovery and BullMQ processing independently of HTTP requests.
const app = await NestFactory.createApplicationContext(AppModule);
app.enableShutdownHooks();
