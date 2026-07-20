import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from './notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
})
class TestAppModule {}

void describe('NotificationsModule', () => {
  void it('compiles push notification providers in the Nest container', async () => {
    const app = await NestFactory.createApplicationContext(TestAppModule);

    assert.ok(app.get(PrismaService, { strict: false }));
    await app.close();
  });
});
