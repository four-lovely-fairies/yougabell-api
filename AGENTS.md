# yougabell-api

> 도메인 API · 챗봇 · LLM 게이트웨이. **구현(코드)의 anchor**.
> 워크스페이스 전체 컨벤션은 umbrella 레포 [`yougabell`](https://github.com/four-lovely-fairies/yougabell/blob/main/AGENTS.md) 참조.
> 도메인 스키마·기능 기획·레포 전략 등 **문서는 umbrella에서 관리** — 구현 시 다음 문서를 먼저 확인:
>
> - 도메인 스키마: [`yougabell/docs/schema/`](https://github.com/four-lovely-fairies/yougabell/tree/main/docs/schema)
> - 기능 기획: [`yougabell/docs/features/`](https://github.com/four-lovely-fairies/yougabell/tree/main/docs/features)
> - 레포 전략·결정: [`yougabell/docs/design/00-repo-strategy.md`](https://github.com/four-lovely-fairies/yougabell/blob/main/docs/design/00-repo-strategy.md)

## 빌드 · 실행 · 검증 명령

```bash
pnpm install                # 의존성 설치 (postinstall이 prisma generate 자동 실행)
pnpm start:dev              # NestJS 개발 서버 (watch)
pnpm build                  # 프로덕션 빌드 (dist/)
pnpm start:prod             # 빌드된 앱 실행 (node dist/main)
pnpm lint                   # eslint --fix
pnpm format                 # prettier --write

pnpm prisma:validate        # schema.prisma 유효성 검사
pnpm prisma:generate        # @prisma/client 생성
pnpm prisma:format          # schema.prisma 포맷팅
pnpm prisma:migrate:dev     # 개발 마이그레이션 (대화형, dev 환경)
pnpm prisma:migrate:deploy  # 운영 마이그레이션 (CI에서)
pnpm prisma:studio          # Prisma Studio (DB 시각화)
```

> **DB 환경 변수 필수** — `pnpm prisma:migrate:*` 실행 전 `.env`에 `DATABASE_URL`(6543), `DIRECT_URL`(5432) 채울 것.
> Supabase 콘솔에서 SQL 직접 실행 금지 — 모든 DDL은 `prisma migrate`를 거친다.

## 스택

- NestJS 11 + **Prisma 7** + `@prisma/adapter-pg`
- Supabase Postgres (`DATABASE_URL` 6543 pooled / `DIRECT_URL` 5432 direct for migrations)
- TypeScript strict
- pnpm, Node 24 LTS

### Prisma 7 — 핵심 차이점 (5/6에서 옮겼다면 주의)

- `schema.prisma`의 `datasource`는 **`provider`만 가짐** — `url`, `directUrl` 모두 제거됨
- 연결 URL은 **`prisma.config.ts`** 에 위치:
  - `datasource.url` ← `DIRECT_URL` (마이그레이션용 직접 연결)
  - 런타임 쿼리는 schema의 datasource를 안 봄
- 런타임은 **driver adapter 필수**:
  - `PrismaService`가 `new PrismaPg({ connectionString: process.env.DATABASE_URL })` 어댑터를 PrismaClient에 주입
  - 풀링은 `pg` 라이브러리가 처리

## 핵심 원칙

- **DB 단독 소유**: Prisma 스키마는 이 레포에만 둔다. 다른 레포는 OpenAPI 코드젠으로 타입을 받는다.
- **마이그레이션 마스터**: 모든 DDL은 `prisma migrate`로. Supabase 콘솔 직접 SQL 금지.
- **Auth Guard**: Supabase JWT를 `JWT_SECRET`으로 검증. `User` 도메인 행은 첫 호출 시 lazy-create.
- **OpenAPI**: `@nestjs/swagger`로 스펙 자동 export. 빌드 산출물 또는 `/openapi.json` 노출.
- **챗봇**: SSE 스트리밍 사용. 카드 단위 chunking.

## 디렉토리 (예정, src 없는 형식)

```
.
├── main.ts
├── app.module.ts
├── common/          # guards, filters, interceptors
├── auth/            # Supabase JWT 검증
├── users/
├── children/
├── missions/
├── mental-battery/
├── mental-care/
├── chat/            # LLM 호출 + 스트리밍
├── reports/         # 주간 리포트 배치
├── content/         # ImprovementTip, InspirationQuote
└── prisma/
    └── schema.prisma
```

> 테스트는 **unit 테스트만** — 각 모듈 옆 `*.spec.ts`. e2e 테스트 도입 시점에 별도 디렉토리/설정 추가.

## 환경 변수

`.env.example` 참조. 운영 환경(dev/staging/prod)별 Supabase 프로젝트 분리.

## 호스팅

**Render Web Service** — https://yougabell-api.onrender.com

- 플랜: Free / Starter Web Service
- 배포: GitHub `main` push 시 자동 빌드·롤아웃 (Render → GitHub App 연동)
- 환경 변수: Render 대시보드에서 관리 (`DATABASE_URL`/`DIRECT_URL`/`SUPABASE_URL`/`SUPABASE_JWKS_URL` 등 — `.env.example` 참조)
- 빌드 명령: `pnpm install && pnpm prisma:generate && pnpm build`
- 시작 명령: `pnpm start:prod` (= `node dist/main`)

> 마이그레이션은 자동 실행되지 않음 — `prisma migrate deploy`는 별도 수동 (혹은 향후 CI step에서) 처리.
> Free 플랜은 idle 시 sleep — 첫 호출 cold start 30초 안팎. dev 검증 용도로 충분, 운영 부하 늘면 유료 플랜 검토.
