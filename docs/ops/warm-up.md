# Render API 웜업 — Google Cloud Scheduler (무료)

> 다른 작업자 핸드오프용 운영 문서. 이 문서 링크를 공유해 설정을 위임할 수 있다.

## 목적

Render **무료 플랜** API(`https://yougabell-api.onrender.com`)는 **15분 무요청 시 sleep**되어, 첫 호출에 ~50초 콜드스타트가 걸린다. 이를 막기 위해 **10분마다 헬스 엔드포인트를 핑**한다.

기존 GitHub Actions(`.github/workflows/warm-api.yml`)의 `*/5` cron은 **실제로는 1~4시간 간격으로만 실행**되어(고빈도 schedule을 GitHub이 throttle) 웜업 목적을 달성하지 못했다. → **Google Cloud Scheduler로 교체**한다(약속한 간격에 정확히 실행).

## 핑 대상 엔드포인트

```
GET https://yougabell-api.onrender.com/health
→ 200 {"status":"ok","timestamp":"<ISO>"}
```

- 인증 불필요(공개), **DB 등 외부 의존 없는 경량 liveness** 응답이라 10분마다 호출해도 부담 없음.
- 구현: `app.controller.ts` / `app.service.ts`의 `getHealth()`.

## 비용

Cloud Scheduler 무료 한도 = **결제계정당 월 3개 작업 무료**. 본 작업 1개 → **$0**.
(Render 무료 인스턴스-시간 월 ~750h는 항상 깨어있으면 거의 한 달치 소진 — 서비스 1개면 무료 범위 내.)

## 사전 준비

1. GCP 콘솔에서 프로젝트 선택/생성 (결제계정 연결 필요 — 무료 한도 내라 청구 없음).
2. **Cloud Scheduler API 활성화**: 콘솔 검색 → "Cloud Scheduler" → 사용 설정.

## 설정 — 방법 A (콘솔)

1. **Cloud Scheduler → 작업 만들기**
2. 입력값:
   - **이름**: `warm-yougabell-api`
   - **리전**: `asia-northeast3` (서울)
   - **빈도(cron)**: `*/10 * * * *`
   - **시간대**: `Asia/Seoul`
   - **대상 유형**: **HTTP**
   - **URL**: `https://yougabell-api.onrender.com/health`
   - **HTTP 메서드**: `GET`
   - **인증 헤더**: 없음
   - **시도 제한시간**: `120s` (콜드스타트 ~50초 대비)
3. **만들기** → 10분마다 자동 실행.

## 설정 — 방법 B (gcloud CLI)

```bash
gcloud services enable cloudscheduler.googleapis.com

gcloud scheduler jobs create http warm-yougabell-api \
  --location=asia-northeast3 \
  --schedule="*/10 * * * *" \
  --time-zone="Asia/Seoul" \
  --uri="https://yougabell-api.onrender.com/health" \
  --http-method=GET \
  --attempt-deadline=120s
```

## 검증

- Cloud Scheduler 작업 목록 → **"지금 실행"** 으로 즉시 테스트 → 결과 코드 `200` 확인.
- Render 대시보드 로그에 10분 간격 `GET /health` 요청이 찍히는지 확인.

## 마무리 (중복 방지)

- 기존 GitHub Actions **`warm-api.yml`은 Cloud Scheduler 설정 후 비활성화**(GitHub → Actions → 워크플로우 → Disable)하거나 삭제한다. 둘 다 돌면 중복 핑.
- 백업으로 남길 경우에도 실제 웜업은 Cloud Scheduler가 담당한다.

## 참고 — 더 근본적인 대안

웜업은 무료 플랜 sleep을 우회하는 임시방편이다. 다음 중 하나로 가면 웜업 자체가 불필요하다.

- **Render Starter($7/mo)**: sleep 없음. 이전 작업 0, 관리형 유지.
- **Google Cloud Run 호스팅**: scale-to-zero + 콜드스타트 1~3초(Render의 ~50초와 다름) + 무료 한도 넉넉. 상태 없는 API라 이전 용이(Dockerfile 추가 필요).
