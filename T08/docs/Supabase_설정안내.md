# T08 · Supabase 연결 안내

> **개발 당시 Supabase 전환 절차(보존 자료):** 이 파일은 초기 설치 ZIP을 적용하던 때의 작업 지침입니다. 현재 Supabase 연결과 API 사용은 실제 확인됐고, 테이블은 QR 승인용 `t08_phone_logins`까지 포함한 **7개**입니다. 아래 ‘미검증’, ‘배포 후 실행’은 당시 시점의 설명이며 최신 미완료를 의미하지 않습니다. [최종 README](../README.md) · [검사 결과](검사결과_2026-10-21.md) 참고.

## 무엇이 바뀌었나
- 기존 Neon 드라이버를 **node-postgres (`pg`)**로 교체하고 Supabase PostgreSQL을 사용합니다.
- Vercel 서버리스 함수에서는 Supabase의 **Transaction pooler (6543)** 접속 URI를 사용합니다. `pg.Pool`의 `max: 1`로 연결 수를 제한하고, SQL 보간은 `$1` 등 바인딩 파라미터로 전달합니다.
- `scripts/schema.sql`은 `t08_` 테이블 일곱 개(현재 상태)에 RLS를 활성화하고 `anon`, `authenticated`의 테이블 권한을 회수합니다.
- Supabase Auth, Supabase anon key, service-role key는 이 과제에 필요하지 않습니다. WebAuthn 패스키와 서버 세션이 인증을 담당합니다.
- 기존 T01 소개 및 T08 v7.1 디자인 파일, 패스키 API는 건드리지 않습니다.

## 1. 기존 작업 폴더에 이 ZIP 적용
강의실 PC에서 프로젝트 루트는 `C:\Users\User\Desktop\T08`, 패키지 폴더는 `C:\Users\User\Desktop\T08\T08`입니다. ZIP을 **저장소 루트에** 압축 해제하세요.

```powershell
cd C:\Users\User\Desktop\T08
Expand-Archive -LiteralPath "$env:USERPROFILE\Downloads\ALEPH_T08_Supabase_전환패치.zip" -DestinationPath . -Force
cd .\T08
npm.cmd install
npm.cmd run build
npm.cmd test
```

`npm install`은 새로운 `pg` 의존성을 내려받아 **`T08/package-lock.json`을 자동 갱신**합니다. npm 설치 전에는 잠금 파일이 예전 Neon 버전을 가리키는 것이 정상이며, 반드시 새 잠금 파일을 포함해 커밋하세요.

## 2. Supabase 프로젝트 만들기
[Supabase Dashboard](https://supabase.com/dashboard)에서 T08용 PostgreSQL 프로젝트를 만듭니다. 프로젝트를 연 다음 **Connect → Transaction pooler**의 연결 문자열을 **그대로** 복사합니다. 포트는 일반적으로 **6543**이며 계정은 `postgres.<project-ref>` 형태입니다. 호스트는 직접 유추하지 마세요.

복사한 연결 URI에서 `[YOUR-PASSWORD]`를 데이터베이스 비밀번호로 대체합니다. 비밀번호에 `@`, `#`, `?`, `&` 등의 특수 문자가 있다면 URI 형식에 맞게 percent-encoding 하세요. 연결 문자열은 **절대 채팅, GitHub, 캡처, 문서에 공개하지 마세요.**

## 3. 로컬 PowerShell 세션에서 DB 초기화
고정된 Vercel **Production 도메인**을 확인해 다음 값을 해당 PowerShell 창에서만 설정하세요.

```powershell
$env:DATABASE_URL = 'SUPABASE에서_복사한_실제_Transaction_pooler_URI'
$env:RP_ORIGIN = 'https://실제-배포-도메인.vercel.app'
$env:RP_ID = '실제-배포-도메인.vercel.app'
npm.cmd run db:init
```

정상이라면 `스키마 및 가상 계정 2개 초기화 완료`가 출력됩니다. 재실행 시 기존 계정과 메모를 함부로 삭제하지 않도록 구현되어 있습니다. 실제 DB 연결, 네트워크 또는 비밀번호 오류가 있으면 이 단계에서 확인해야 합니다.

Supabase → **Table Editor**에서 `t08_accounts`, `t08_notes`, `t08_passkeys`, `t08_invites`, `t08_challenges`, `t08_sessions`, `t08_phone_logins`를 확인하고, RLS가 켜져 있는지 점검하세요. 이 앱은 Supabase 브라우저 API를 사용하지 않으므로 `anon`/`authenticated`에는 공개 접근 정책을 만들지 않습니다.

## 4. Vercel 환경변수
기존 T08 프로젝트 → Settings → Environment Variables에서 아래 **서버 전용** 환경변수 세 개만 설정하고 Redeploy 하세요.

- `DATABASE_URL`: 위 Supabase Transaction pooler URI (비밀값)
- `RP_ORIGIN`: 정확한 Production HTTPS Origin (마지막 슬래시 없음)
- `RP_ID`: Origin의 호스트 이름만 (https://, 슬래시, 포트 없음)

Supabase project URL, anon key, service-role key를 브라우저 JavaScript에 추가할 필요는 없습니다.

## 5. 실제 패스키 검증은 별도
`npm test`는 소스 구조 검사이지 실제 DB·기기 검증이 아닙니다. 실제 배포 후 `npm.cmd run check:public`, 최초 초대 등록(`npm.cmd run invite:owner`, `npm.cmd run invite:reviewer`), 두 패스키 등록, 1개 삭제, 재사용 거절, 계정 격리, 로그아웃 거절 등 과제의 실제 요청/응답 증거를 수집해야 합니다. 초대 URL과 세션 쿠키는 제출하지 마세요.

## 6. GitHub 반영
저장소 루트에서 `git status` → `git add T08` → `git status`로 스테이징을 확인합니다. 변경사항에 `T08/package-lock.json`이 포함되고, `.env` 및 프로젝트 루트에 남은 불필요한 `package-lock.json`은 포함되지 않았는지 확인한 뒤 한글 커밋 메시지로 푸시하세요.

## 초기 전환 시점의 제한 (현재 해결됨)
이 문단은 패치를 제작하던 당시에는 로컬 npm 설치와 실제 DB 연결을 직접 재현하지 못했다는 뜻입니다. **2026-10-21 최종 시점에는 GitHub Actions 빌드와 테스트 31/31, 실제 Supabase SQL 조회, Vercel API HTTP 200을 확인했습니다.** DB에 남은 owner/reviewer 메모는 각 3건입니다.
