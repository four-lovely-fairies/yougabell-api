import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from '../app.module';

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  const config = new DocumentBuilder()
    .setTitle('Yougabell API')
    .setDescription('육아벨 domain API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  const outputPath = resolve(process.env.OPENAPI_EXPORT_PATH ?? 'openapi.json');

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
}

void exportOpenApi();
