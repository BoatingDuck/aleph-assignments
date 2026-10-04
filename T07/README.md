# T06 Plan · Do · See Diary

가을 테마의 Plan → Do → See 다이어리입니다. 로그인 없이 공개되며, 모든 주요 자료는 Neon PostgreSQL에 저장됩니다.

## 구성

- Next.js 16.3.8 App Router
- React 19.3
- Neon PostgreSQL + `@neondatabase/serverless`
- Vercel 배포 기준
- 서버 전용 `DATABASE_URL`
- `contracts/pds-schema-v2.json` 포함

## 1. VS Code에서 실행

```powershell
npm install
```

Neon에서 PostgreSQL 프로젝트를 하나 만들고 **pooled connection string**을 복사합니다.

`.env.example`을 복사해 `.env.local`을 만들고 실제 값을 넣습니다.

```env
DATABASE_URL="postgresql://..."
```

DB 테이블을 만듭니다.

```powershell
npm run db:init
```

개발 서버를 실행합니다.

```powershell
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 2. 실제 자료 넣기

1. `계획 세우기`에서 실제 계획을 저장합니다. `T06 계획 초안 채우기`는 입력 폼만 채우며 자동 저장하지 않습니다.
2. 계획을 한 번 수정해 `수정 이력`에 수정 전 값이 남는지 확인합니다.
3. `실제로 하기`에서 실제 할 일을 5개 이상 만듭니다. `T06 실제 할 일 6개 채우기`를 사용해도 됩니다.
4. 실제 작업을 하면서 실행 기록을 3건 이상 직접 저장합니다.
5. 완료 버튼을 빠르게 두 번 눌러도 완료 기록/집계가 한 번만 증가하는지 확인합니다.
6. `돌아보기`의 숫자를 눌러 해당 근거 기록이 보이는지 확인합니다.
7. 고칠 점 한 줄을 `다음 계획 만들기`로 넘깁니다.
8. `최종 점검`에서 스크립트 모양 문자열을 DB에 저장하고 글자 그대로 보이는지 확인합니다.
9. `전체 자료 JSON 내보내기`로 자료를 한 파일로 받습니다.

## 3. Vercel 배포

GitHub에 올릴 때 `.env.local`은 **절대 커밋하지 않습니다.** `.gitignore`에 이미 제외되어 있습니다.

Vercel 프로젝트의 Environment Variables에 아래 한 개만 등록합니다.

- `DATABASE_URL` = Neon pooled connection string

그 뒤 배포하면 됩니다. DB 초기화는 로컬에서 `npm run db:init`으로 한 번 실행해 둡니다.

## 4. 비밀값 점검

```powershell
npm run security:scan
```

이 검사는 소스/배포 대상 파일에서 PostgreSQL 인증정보, private key, 일반적인 secret/token 원문 후보를 찾습니다.

추가로 제출 직전에는 아래를 직접 확인합니다.

- 브라우저 DevTools > Network 응답에 `DATABASE_URL`이 없는지
- Console에 비밀값이 없는지
- GitHub commit/history에 `.env.local`이 올라간 적 없는지
- Vercel Environment Variables에만 실제 DB URL이 있는지

## 5. 주요 채점 조건 대응

- C04~C08: `plans`, `plan_versions`
- C09~C20: 할 일 CRUD + 검색/필터/정렬 + 명시된 tie-break 기준
- C21~C22: `idempotency_keys` + `task_completions UNIQUE(task_id, completion_cycle)` + 상태 조건부 UPDATE
- C23~C27: `execution_logs`; 계획 값과 별도 저장
- C28~C32: `/api/reflection`에서 현재 DB 자료로 계산
- C83: 집계 카드 클릭 → 집계 근거 영역으로 이동
- C33: 고칠 점을 `reflections`에 저장하고 `improvement_from_previous`가 들어간 다음 계획 생성
- C34~C35: 서버 PostgreSQL 저장/재조회
- C36: `/api/export` JSON 한 파일 내보내기
- C57: `security_checks`에 문자열 저장 후 React text rendering으로 표시
- C58: DB URL은 서버 전용 환경변수; `npm run security:scan` 제공
- C78~C81: 최종 점검 화면에서 실제 자료 개수를 바로 확인
- C82: 첫 화면 공개 안내 문구 표시
- C01: 앱 자체에는 로그인/인증/CAPTCHA 없음

## 6. 날짜/시간 규칙

`contracts/pds-schema-v2.json`에도 같은 규칙이 정리되어 있습니다.

- 계획 기간/마감일: PostgreSQL `DATE`
- 실행 시작/종료: `TIMESTAMPTZ`
- 화면 시간대: `Asia/Seoul`
- 지연: **현재 완료가 아니고** 마감일이 서울 기준 오늘보다 이전인 할 일
- 시간 단위: 분(integer)
- 차이: `실제 시간 - 예상 시간`

## 주의

이 과제는 로그인 전 단계입니다. 공개 배포 후 링크를 아는 사람은 DB에 들어 있는 내용을 볼 수 있으므로 민감한 내용, 타인의 개인정보, 연락처 등은 입력하지 마세요.
