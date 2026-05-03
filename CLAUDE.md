# working-mom-dad-api

> 도메인 API · 챗봇 · LLM 게이트웨이.
> 워크스페이스 전체 컨벤션은 [`../CLAUDE.md`](../CLAUDE.md), 글로벌은 `~/.claude/CLAUDE.md` 참조.

## 스택

- NestJS + Prisma
- Supabase Postgres (Pooled 6543 / Direct 5432)
- TypeScript strict
- pnpm, Node 24 LTS

## 핵심 원칙

- **DB 단독 소유**: Prisma 스키마는 이 레포에만 둔다. 다른 레포는 OpenAPI 코드젠으로 타입을 받는다.
- **마이그레이션 마스터**: 모든 DDL은 `prisma migrate`로. Supabase 콘솔 직접 SQL 금지.
- **Auth Guard**: Supabase JWT를 `JWT_SECRET`으로 검증. `User` 도메인 행은 첫 호출 시 lazy-create.
- **OpenAPI**: `@nestjs/swagger`로 스펙 자동 export. 빌드 산출물 또는 `/openapi.json` 노출.
- **챗봇**: SSE 스트리밍 사용. 카드 단위 chunking.

## 디렉토리 (예정)

```
src/
├── app.module.ts
├── main.ts
├── common/          # guards, filters, interceptors
├── auth/            # Supabase JWT 검증
├── users/
├── children/
├── missions/
├── mental-battery/
├── mental-care/
├── chat/            # LLM 호출 + 스트리밍
├── reports/         # 주간 리포트 배치
└── content/         # ImprovementTip, InspirationQuote
prisma/
└── schema.prisma
```

## 환경 변수

`.env.example` 참조. 운영 환경(dev/staging/prod)별 Supabase 프로젝트 분리.

## 호스팅

TBD — Fly.io 도쿄 리전 후보.
