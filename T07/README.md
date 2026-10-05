# T07 Plan · Do · See Diary — 인증 적용 버전

T06에서 만든 Plan → Do → See 다이어리를 그대로 이어서, 가입·로그인·로그아웃과 사용자별 자료 보호를 붙이는 T07 프로젝트다.

> **현재 상태:** T06 최종본을 T07 시작점으로 복사한 단계다. 인증 기능은 구현하면서 이 문서를 계속 갱신한다. 구현 전 항목을 완료된 것처럼 적지 않는다.

<br>

## 0. T06에서 이어진 기준

- T07은 **최종 제출한 T06 소스**를 시작점으로 사용한다.
- T07 최종 Git 이력에는 **T06 제출 당시 고정 commit이 조상(ancestor)** 으로 남아 있어야 한다.
- 제출 전 아래 값을 실제 T06 제출 정보와 맞춰 적는다.

```text
최종 T06 결과물 URL: [제출 전 입력]
최종 T06 소스/commit: [제출 전 입력]
T07 시작 commit: [제출 전 입력]
```

<br>

## 1. 구성

- Next.js 16.3.8 App Router
- React 19.3
- Neon PostgreSQL + `@neondatabase/serverless`
- Vercel 배포 기준
- 서버 전용 `DATABASE_URL`
- 비밀번호 해시: `bcryptjs` 예정
  - 실제 제출 버전은 설치 후 `package-lock.json`에 고정된 버전으로 기록
- 인증 상태: **서버 측 세션** 예정
  - 브라우저에는 랜덤 세션 ID를 HttpOnly 쿠키로 전달
  - DB에는 세션 ID 원문 대신 SHA-256 해시를 저장
  - 세션에 만료 시각을 둠
  - 로그아웃 시 DB 세션과 쿠키를 함께 폐기

<br>

## 2. VS Code에서 실행

```powershell
npm install
npm install bcryptjs
```

Neon PostgreSQL의 pooled connection string을 준비한다.

`.env.example`을 복사해 `.env.local`을 만들고 실제 값을 넣는다.

```env
DATABASE_URL="postgresql://..."
```

`.env.local`은 Git에 올리지 않는다.

```powershell
npm run db:init
npm run dev
```

브라우저에서 `http://localhost:3000`을 연다.

<br>

## 3. T07 인증 설계

<br>

### 가입

예정 흐름:

```text
가입 화면
→ POST /api/auth/signup
→ 입력 검증
→ 같은 아이디/이메일 존재 여부 확인
→ bcrypt로 비밀번호 해시
→ users에 password_hash 저장
→ 비밀번호 원문은 저장/응답/로그에 남기지 않음
```

같은 아이디 또는 이메일의 중복 가입은 허용하지 않는다.

<br>

### 로그인

```text
로그인 화면
→ POST /api/auth/login
→ 사용자 조회
→ bcrypt로 비밀번호 비교
→ 성공 시 랜덤 세션 ID 생성
→ sessions에 session hash + user_id + expires_at 저장
→ HttpOnly cookie 발급
```

아이디가 존재하지 않을 때와 비밀번호가 틀렸을 때는 **같은 안내 문구**를 사용한다.

<br>

### 로그아웃

```text
POST /api/auth/logout
→ 현재 세션을 서버 DB에서 삭제
→ 브라우저 세션 쿠키 만료
→ 같은 보호 API를 다시 요청하면 401
```

브라우저에서 쿠키만 지우는 것으로 끝내지 않는다.

<br>

### 비밀번호 변경

T07-C114 확인을 위해 비밀번호 변경 기능을 붙일 경우:

```text
현재 비밀번호 확인
→ 새 비밀번호 bcrypt hash 저장
→ 해당 사용자의 기존 sessions 전부 삭제
→ 다시 로그인 필요
```

<br>

## 4. 사용자별 자료 분리

T06의 자료를 단순히 화면에서 숨기는 것이 아니라 **모든 보호 API가 서버에서 로그인 사용자와 자료 소유자를 확인**하도록 바꾼다.

소유권 기준 예정:

- `plans`: `user_id` 추가
- `plan_versions`: 연결된 `plans.user_id`로 확인
- `tasks`: 연결된 `plans.user_id`로 확인
- `task_completions`: `task → plan → user`로 확인
- `execution_logs`: `task → plan → user`로 확인
- `reflections`: `plan → user`로 확인
- `security_checks`: `user_id` 추가
- `/api/export`: 현재 로그인 사용자 자료만 반환

> URL, header, request body에 클라이언트가 다른 사용자의 ID를 넣더라도 소유자 판단에는 사용하지 않는다. 서버가 세션에서 얻은 `user_id`만 신뢰한다.

소유권이 다른 자료의 직접 읽기·수정·삭제는 404 또는 403으로 거절하고, 거절 전에 자료를 변경하지 않는다.

<br>

## 5. T06 기존 자료를 내 계정으로 옮기기

T07-C100 때문에 T06에 이미 들어 있던 자료를 없애면 안 된다.

예정 순서:

1. T07에서 내 계정을 만든다.
2. 기존 T06 자료의 최상위 소유자를 내 계정 `user_id`로 연결한다.
3. 연결 후 목록·상세·집계·내보내기에서 해당 계정으로 로그인했을 때만 기존 자료가 보이는지 확인한다.
4. 다른 테스트 계정에서는 기존 T06 자료가 0건인지 확인한다.
5. 마이그레이션 과정에서도 실제 비밀번호나 세션값은 문서에 적지 않는다.

<br>

## 6. 잠긴 앱으로 5일 사용

1일차에 아래 항목을 한 번 정하고 고정한다.

- 답하려는 질문 한 문장
- 관찰 지표 한 개
- 단위
- 계산 규칙
- 계획 규칙
- 결측값 처리 규칙
- 중복값 처리 규칙
- 이상치 처리 규칙
- 반올림 규칙
- 주 시작 요일

그 뒤 `Asia/Seoul` 기준 서로 다른 실제 날짜 **정확히 5일**의 기록을 내 계정에 저장한다.

```text
1일차 기록
→ 2일차 기록
→ 계획 규칙 하나 변경 + 변경 시각 + 이유 기록
→ 3일차 기록
→ 4일차 기록
→ 5일차 기록
```

변경 전후 비교에서는 지표·단위·계산 규칙을 바꾸지 않는다.
마지막에는 화면 합계·평균과 5일 값을 직접 더한 결과가 일치하는지 확인한다.

<br>

## 7. T07에서 남길 인증 증거

심사자는 실제 계정 비밀번호를 받아 로그인하지 않는다. 따라서 제출문에는 주장 대신 **요청과 응답**을 남긴다.

최소한 아래 결과를 캡처하거나 텍스트로 보관한다.

1. 로그인 상태 보호 API 성공 ↔ 로그아웃 후 **같은 URL·같은 method** 요청 거절
2. 계정 A 로그인 → 계정 B 자료 읽기·수정·삭제 각각 거절
3. 계정 B 로그인 → 계정 A 자료 읽기·수정·삭제 각각 거절
4. URL/헤더/본문에 다른 계정 값을 넣어도 내 자료만 반환
5. 비로그인 상태에서 보호 API 직접 요청 거절
6. 목록 응답에 다른 계정 자료가 0건
7. 거절 전후 상대 계정 자료 건수와 내용이 동일

증거를 제출용으로 옮길 때는 다음 값을 반드시 가린다.

```text
password: [가림]
Cookie: session=abc…생략
Set-Cookie: session=abc…생략
token/secret: abc…생략
```

<br>

## 8. 내보내기와 계정 삭제

- `GET /api/export`는 현재 로그인한 사용자의 자료만 JSON 한 파일로 내보낸다.
- 다른 사용자의 자료는 내보내기 결과에 포함하지 않는다.
- 계정 삭제 시 내 자료가 함께 삭제되도록 구현하거나, 삭제 범위를 화면에 명확히 안내한다.
- 계정 삭제 전 실제로 무엇이 지워지는지 확인 문구를 보여 준다.

<br>

## 9. Vercel 배포

GitHub에 올릴 때 `.env.local`은 **절대 커밋하지 않는다.**

Vercel Environment Variables:

- `DATABASE_URL` = Neon pooled connection string

서버 측 세션을 랜덤 ID + DB 저장 방식으로 구현하면 JWT 서명용 비밀키는 사용하지 않는다. 추가 비밀값이 생길 경우에는 반드시 Vercel Environment Variables에만 둔다.

배포 후 첫 화면은 **로그인 화면**이어야 한다. 심사자는 계정을 만들지 않아도 이 첫 화면까지 열 수 있어야 하며, 내 기록은 로그인 전에 노출되면 안 된다.

<br>

## 10. 비밀값 점검

```powershell
npm run security:scan
```

제출 직전 추가로 직접 확인한다.

- DevTools > Network 응답에 `DATABASE_URL`, 비밀번호, 세션 원문이 없는지
- Console에 비밀값이 없는지
- URL에 세션/토큰 값이 없는지
- GitHub commit/history에 `.env.local`이나 비밀값이 올라간 적 없는지
- Vercel 환경변수 외 배포 파일에 비밀값이 없는지
- 제출문/스크린샷/요청·응답 기록에서 `Cookie`, `Set-Cookie`, 비밀번호, 토큰·세션 값을 가렸는지

<br>

## 11. 인증 구현 설명서 최종 목차

최종 제출 때 아래 여섯 항목을 **각각 나눠서** 적는다.

1. 무엇으로 붙였나
2. 왜 그걸 골랐나
3. 어디를 어떻게 고쳤나
4. 안 열리는 것을 확인한 기록
5. AI와 나
6. 아직 못 막은 것

⑥은 비워 두지 않는다.

예를 들어 실제로 구현하지 않았다면 다음과 같은 항목을 사실대로 적을 수 있다.

- 로그인 무차별 대입에 대한 rate limit 미구현
- 비밀번호 재설정 미구현
- 2단계 인증 미구현

단, 최종 문서에는 **실제로 못 막은 것만** 적는다.

<br>

## 12. 작업 문서

- `COVERAGE.md` — T07 조건 ↔ 구현 위치 ↔ 확인 방법 대응표
- `T07-CHECKLIST.md` — 제출 전 수동 검수표
- 인증 구현 설명서 — 구현 완료 후 별도 작성
