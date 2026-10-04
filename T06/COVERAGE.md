# T06 조건 대응표

| 조건 | 구현 위치 | 확인 방법 |
|---|---|---|
| C04 기간 | `plans.start_date/end_date` | 계획 저장 후 새로고침 |
| C05 우선순위 | `plans.priority` | 계획 화면 |
| C06 성공 기준 | `plans.success_criteria` | 계획 화면 |
| C07 예상 시간 | `plans.estimated_minutes` | 계획 화면 |
| C08 수정 전 계획 보관 | `plan_versions.snapshot` | 계획 수정 후 수정 이력 |
| C09 생성 | `POST /api/tasks` | 할 일 만들기 |
| C10 수정 | `PATCH /api/tasks/[id]` | 할 일 수정 |
| C11 완료 | `POST /api/tasks/[id]/complete` | 완료 버튼 |
| C12 완료 취소 | `PATCH /api/tasks/[id]` + completion cycle | 진행 중으로 버튼 |
| C13 삭제 | soft delete `deleted_at` | 삭제 후 목록에서 사라짐 |
| C14~17 | `due_date/priority/tags/estimated_minutes` | 할 일 폼/카드 |
| C18 검색 | 서버 route filter | 검색창 |
| C19 필터 | 서버 route filter | 상태/우선순위/태그 |
| C20 정렬 | 서버 정렬 + 화면의 현재 정렬 기준 | 정렬 select |
| C21 중복 완료 방지 | idempotency key + 상태 조건부 update + UNIQUE `(task_id, completion_cycle)` | 완료 연속 클릭 |
| C22 완료 집계 1회 | reflection은 현재 task status만 집계 | 전/후 완료 수 비교 |
| C23~26 | `execution_logs` | 실제 기록 폼/목록 |
| C27 계획 비덮어쓰기 | execution 별도 table | 기록 전후 예상값 비교 |
| C28 계획 수 | active task 수 | 돌아보기 계획 수 |
| C29 완료 수 | active task 중 `status=done` | 돌아보기 완료 수 |
| C30 지연 수 | 미완료 + due date < 서울 오늘 | 돌아보기 지연 수 |
| C31 막힘 수 | blocker reason이 있는 distinct task | 돌아보기 막힘 수 |
| C32 시간/차이 | task 예상 합, execution 실제 합, actual-estimated | 돌아보기 시간 카드 |
| C83 근거 이동 | metric button → evidence panel | 숫자 클릭 |
| C33 다음 계획 | `reflections` + `plans.improvement_from_previous` | 고칠 점 한 줄 넘기기 |
| C34 실제 DB | Neon PostgreSQL | Neon table/새로고침 |
| C35 복원 | GET API가 DB 재조회 | 새로고침 전후 비교 |
| C36 한 파일 내보내기 | `GET /api/export` | JSON 내보내기 |
| C78~81 실데이터 | 최종 점검 화면 카운터 | 실제 기록 입력 후 확인 |
| C82 공개 안내 | hero의 공개 안내 | 첫 화면 |
| C57 스크립트 문자열 | `security_checks` + React text rendering | `<script>…</script>` 저장 |
| C58 비밀값 | server-only DB env + `.gitignore` + scan script | `npm run security:scan` + 수동 DevTools/Git 확인 |
| C59/C60 제출문 | 앱 밖 제출문 조건 | 제출 시 4줄/3줄 작성 |
| C01 무로그인 공개 | 앱에 auth 없음 | 배포 후 시크릿 창 |
