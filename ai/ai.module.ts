import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AiConfigService } from './ai-config.service';
import { ContextBuilderService } from './context-builder.service';
import { EmbeddingService } from './embedding.service';
import { KnowledgeRetrievalService } from './knowledge-retrieval.service';

/**
 * 기획 docs/features/20260525-ai-integration.md §4.1, Phase 4.
 * 다른 모듈에서 inject할 수 있도록 @Global.
 */
@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    AiConfigService,
    ContextBuilderService,
    EmbeddingService,
    KnowledgeRetrievalService,
  ],
  exports: [
    AiConfigService,
    ContextBuilderService,
    EmbeddingService,
    KnowledgeRetrievalService,
  ],
})
export class AiModule {}
