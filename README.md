# working-mom-dad-api

> Working Mom Dad — domain API · chatbot · LLM gateway.
> NestJS + Prisma + Supabase Postgres.

## Stack

- NestJS
- Prisma (Supabase Postgres)
- TypeScript (strict)
- pnpm
- Node 24 LTS

## Quick start

```bash
nvm use
pnpm install
cp .env.example .env
# fill in DATABASE_URL / DIRECT_URL / SUPABASE_* / LLM keys
pnpm prisma:generate
pnpm prisma:migrate:dev
pnpm start:dev
```

## Role

- 도메인 로직 (User / Child / Mission / MentalBattery / Chat / Report)
- Supabase JWT 검증 (Auth Guard)
- 챗봇 오케스트레이션 (LLM 호출 + 컨텍스트 합성)
- 주간 리포트 배치
- OpenAPI 스펙 export → web/admin/mobile에서 코드젠 소비

## Hosting

TBD (후보: Fly.io 도쿄 리전 — Supabase와 동일 리전)

## 관련 문서

- 워크스페이스 큰 그림: [`../CLAUDE.md`](../CLAUDE.md)
- 레포 전략: [`../docs/design/00-repo-strategy.md`](../docs/design/00-repo-strategy.md)
- 도메인 스키마: [`../docs/schema/`](../docs/schema/)
