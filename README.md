# yougabell-api

육아밸의 백엔드. 사용자가 입력한 아이 정보(연령, 발달 단계, 알레르기 등)를 들고 있다가, 챗봇이 답할 때 그 맥락을 끌어다 쓰는 게 핵심이다. 도메인 데이터의 진실의 소스이자, 클라이언트 셋(web/admin/mobile)이 바라보는 단 하나의 API.

NestJS로 짜여 있고, Prisma로 Supabase Postgres를 다룬다. LLM은 Vercel AI SDK를 통해 Google Gemini를 호출한다.

## 왜 NestJS인가

처음부터 모듈이 꽤 많아질 걸 알고 있었다. 사용자, 아이, 미션, 마일스톤, 마음 배터리, 챗봇, 주간 리포트… 각각이 컨트롤러 + 서비스 + DTO 묶음으로 떨어지는데, 이걸 손으로 묶기 시작하면 금방 폴더 구조가 제멋대로 된다.

NestJS의 모듈 시스템과 데코레이터 기반 DI가 이 지점에서 값을 한다. 도메인 하나가 모듈 하나로 떨어지고, 가드·파이프·인터셉터가 횡단 관심사(인증, 검증, 직렬화)를 컨트롤러 밖으로 빼준다. 덕분에 컨트롤러는 "어떤 요청을 받아 어떤 DTO로 응답한다" 정도만 남는다.

부수 효과로 따라오는 게 OpenAPI 스펙이다. `@nestjs/swagger` 데코레이터를 붙여두면 `/docs` Swagger UI와 `openapi.json`이 공짜로 나온다. 이 스펙이 web/admin의 타입 생성 입력이 되기 때문에, API 계약이 깨지면 클라이언트 빌드 단계에서 타입 에러로 잡힌다. 문서화를 "나중에 하는 일"이 아니라 빌드 산출물로 만든 셈이다.

## 모듈 구성

| 모듈             | 하는 일                                                                           |
| ---------------- | --------------------------------------------------------------------------------- |
| `auth`           | Supabase JWT 검증, 역할 가드(`JwtAuthGuard` → `AdminRoleGuard`), 온보딩 완료 가드 |
| `users`          | 부모 프로필, 알림 설정, 계정 삭제(소프트 삭제 + 유예 기간)                        |
| `children`       | 아이 정보(이름·생일·성별·메모·표시 순서) 관리                                     |
| `missions`       | 미션 카탈로그, 실행 추적, 피드백 수집(아이 반응 / 부모 에너지)                    |
| `milestones`     | CDC Act Early 기준 발달 마일스톤(사회·언어·인지·신체)                             |
| `growth-stages`  | 개월 수 구간(애착기·감각탐색기 등) — 차트 내비게이션                              |
| `mental-care`    | 마음 배터리 체크(1–5 일일 기록)와 이력                                            |
| `chat`           | SSE 스트리밍 챗봇, 메시지 저장, 카드/출처 링크 생성                               |
| `ai`             | LLM 프로바이더 설정, 컨텍스트 합성, 지식 검색(임베딩)                             |
| `home`           | 홈 대시보드 집계(아이별 뷰 + 오늘의 기분 체크)                                    |
| `weekly-reports` | 주간 리포트 배치 — 미션·배터리·키워드를 LLM으로 합성                              |
| `notifications`  | 알림 인박스, 푸시 토큰 관리, 디스패치                                             |
| `onboarding`     | 부모 정보 + 아이 + 알림 설정을 한 트랜잭션으로 받는 단일 엔드포인트               |
| `admin`          | 운영자용 사용자 조회, 주간 리포트 수동 트리거                                     |

## 챗봇을 짠 방식

챗봇은 단순히 "사용자 메시지를 LLM에 넘기고 답을 돌려주는" 구조가 아니다. 답이 개인화되려면 그 사람의 맥락이 프롬프트에 들어가야 한다. `ContextBuilderService`가 이 합성을 맡는다.

- 부모 프로필 + 등록된 아이(개월 수 환산까지)
- 최근 미션 실행 기록
- 최근 마음 배터리 추이
- 직전 주간 리포트 요약
- 직전 대화 몇 턴

이걸 다 욱여넣으면 토큰이 터지므로, 각 항목에 상한을 둬서 "충분히 풍부하되 예산 안에 드는" 선을 잡았다. 응답은 `streamText()`로 SSE 스트리밍한다. 표준 `EventSource`는 GET만 되기 때문에 web 쪽은 `fetch` + `ReadableStream`으로 직접 파싱한다. Render 앞단 프록시가 버퍼링하지 않도록 `X-Accel-Buffering: no` 헤더를 박아둔 것도 이 스트리밍이 실제로 흐르게 하는 디테일이다.

육아 정보 검색에는 pgvector 임베딩을 쓴다. 질문을 임베딩해서 지식 청크와 코사인 유사도로 top-k를 뽑는데, 유사도 임계값을 둬서 어설프게 걸리는 청크는 버린다. 건강·발달 관련 답에 엉뚱한 출처가 붙는 게 제일 위험해서, 관련 없는 매칭을 통과시키느니 출처 없이 답하는 쪽을 택했다.

## Prisma 7과 두 개의 연결 URL

DB 스키마는 이 레포의 `prisma/schema.prisma`가 단독으로 들고 있다. 다른 레포에 복제하지 않는다.

Prisma 7부터 연결 URL을 `prisma.config.ts`로 관리하는데, 여기서 두 URL을 분리한다. 런타임 쿼리는 pgBouncer 풀링(6543)을 타고, 스키마 작업은 풀링을 우회한 직결(5432)로 간다. 풀러를 거치면 DDL이 제대로 안 도는 경우가 있어서다. 런타임 쪽은 `@prisma/adapter-pg` 드라이버 어댑터를 끼워 `pg`가 풀링을 맡는다.

스키마 변경은 `prisma db push`로 반영한다. `migrate dev`는 로컬에서 DB를 리셋해 데이터를 날릴 수 있어 이 프로젝트에선 피한다.

## 라이브러리 메모

- **`ai` (Vercel AI SDK) + `@ai-sdk/google`** — 프로바이더를 갈아끼워도 `streamText`/`generateText` 인터페이스가 그대로다. 지금은 Gemini지만 나중에 바꿀 여지를 남긴다.
- **`@prisma/adapter-pg`** — Prisma 7의 드라이버 어댑터. 연결 풀링을 `pg`에 위임해서 서버리스/풀러 환경에서 다루기 편하다.
- **`jose`** — Supabase JWT 검증. 가볍고 표준 JWK를 그대로 먹는다.
- **`class-validator` + `class-transformer`** — DTO에 데코레이터만 붙이면 화이트리스트 검증과 변환이 자동으로 걸린다. 컨트롤러에서 수동 검증 코드가 사라진다.
- **`zod`** — LLM이 뱉은 구조화 응답(카드 등)을 런타임에 한 번 더 검증할 때.
- **`csv-parse`** — 운영자 시트에서 받은 미션·마일스톤 시드를 일괄 적재. 시트마다 컬럼 순서가 달라서 시트별 파서를 따로 둔다.

## 시작하기

```bash
nvm use
pnpm install              # postinstall이 prisma generate를 돌린다
cp .env.example .env
# DATABASE_URL / DIRECT_URL / SUPABASE_* / LLM 키 채우기
pnpm prisma db push       # 스키마를 DB에 반영
pnpm start:dev            # :3000
```

클라이언트가 쓸 OpenAPI 스펙을 다시 뽑으려면:

```bash
pnpm openapi:export       # openapi.json 갱신
```

## 스택

NestJS 11 · Prisma 7 · Supabase Postgres · Vercel AI SDK(Gemini) · TypeScript(strict) · pnpm · Node 24 LTS.
Render Web Service에 배포하며, `main` push 시 자동 빌드·롤아웃된다. Free 플랜이라 idle 시 잠들고 첫 호출에 30초 안팎 cold start가 붙는데, 이걸 깨우는 게 `yougabell-cron`의 일이다.

## 관련 문서

이 레포는 구현(코드)의 anchor다. 기획·스키마 의미는 umbrella 레포에서 관리한다.

- 레포 전략: [`yougabell/docs/design/00-repo-strategy.md`](https://github.com/four-lovely-fairies/yougabell/blob/main/docs/design/00-repo-strategy.md)
- 도메인 스키마: [`yougabell/docs/schema/`](https://github.com/four-lovely-fairies/yougabell/tree/main/docs/schema)
