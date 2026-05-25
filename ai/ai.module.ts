import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiConfigService } from './ai-config.service';
import { ContextBuilderService } from './context-builder.service';

/**
 * 기획 docs/features/20260525-ai-integration.md §4.1.
 * 다른 모듈(chat, weekly-reports)에서 AiConfigService·ContextBuilderService를 inject할 수 있도록 @Global.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [AiConfigService, ContextBuilderService],
  exports: [AiConfigService, ContextBuilderService],
})
export class AiModule {}
