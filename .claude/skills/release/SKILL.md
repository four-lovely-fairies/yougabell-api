---
name: release
description: 변경사항 커밋 → 문서 동기화 → 원격 푸시까지 릴리즈 전체 과정을 수행합니다. 레포별 후속 배포 절차는 AGENTS.md 참조.
allowed-tools: Bash, Read, Write, Edit, Glob, Grep, Skill
---

# 릴리즈

## 중요: 모든 변경사항 커밋 필수

- `git status`에 남은 변경사항이 없어야 다음 단계로 진행
- staged/unstaged/untracked 모든 파일을 빠짐없이 커밋 (package.json, lock 파일 포함)
- 변경사항을 임의로 제외하지 않음

## 1단계: /finish 실행

변경사항 분석 → 문서 업데이트 → 포매팅 → 한글 Conventional Commits 커밋:

```
/finish
```

- 커밋 후 `git status`로 남은 변경사항 없음을 반드시 확인
- 확인 완료 후 다음 단계 진행

## 2단계: /sync-docs 실행

```
/sync-docs today
```

- 오늘 커밋 중 문서 미반영 항목 점검
- 누락 시 문서 갱신 + 추가 커밋

## 3단계: 원격 푸시

```bash
git push origin <현재 브랜치>
```

- 보호 브랜치(`main` / `develop`)는 PR 흐름 권장 — 직접 푸시 전 사용자에게 확인
- 푸시 실패 시 사용자에게 보고하고 중단

## 4단계: PR 생성 및 Markdown 본문 검증

PR이 필요한 브랜치는 실제 개행을 보존하는 here-document로 본문을 만든다.
JSON 이스케이프 문자열(`\n`)을 `--body`에 전달하면 GitHub에 문자 그대로 저장되므로 사용하지 않는다.

```bash
gh pr create --base main --head <현재 브랜치> --title "<제목>" --body "$(cat <<'EOF'
## 변경 사항

- 변경 내용

## 검증

- 실행한 검증 명령과 결과

## 의존성 또는 배포 순서

- 필요한 선행 작업
EOF
)"
```

생성 직후에는 반드시 PR 원문을 읽어 제목·빈 줄·목록이 실제 Markdown 개행으로 출력되는지 확인한다.

```bash
PR_CHECK_NUMBER="$(gh pr view --json number --jq .number)"
gh pr view "$PR_CHECK_NUMBER" --json body --jq .body
```

- 출력에 리터럴 `\n`이 있거나 섹션/목록이 한 줄로 붙어 있으면 즉시 `gh pr edit --body`로 수정한다.
- PR 본문 수정에도 동일한 here-document 방식을 사용하고, 수정 후 위 검증을 다시 실행한다.

## 5단계: 레포별 후속 배포

각 레포 `AGENTS.md`에 명시된 배포 절차를 따름.

| 레포                   | 배포 방식                                          |
| ---------------------- | -------------------------------------------------- |
| `yougabell` (umbrella) | docs-only — 별도 배포 없음                         |
| `yougabell-api`        | TBD (Fly.io 검토 중) — 호스팅 결정 후 본 섹션 갱신 |
| `yougabell-web`        | Vercel 자동 배포 (`main` push에 트리거)            |
| `yougabell-admin`      | Vercel 자동 배포 (`main` push에 트리거)            |
| `yougabell-mobile`     | EAS Build (`eas build --platform <ios\|android>`)  |

## 6단계: 결과 보고

- 푸시된 커밋 목록 (`git log origin/<base>..HEAD --oneline` 또는 `git log --oneline -n <N>`)
- 트리거된 배포 (Vercel URL, EAS Build ID 등)
- 후속 수동 작업 (스토어 제출, 마이그레이션 적용 등)
