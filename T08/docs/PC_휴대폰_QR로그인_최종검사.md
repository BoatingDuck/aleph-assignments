# T08 PC↔휴대폰 QR 패스키 인증 및 마지막 실측 검사

> 이 문서는 **구현/검사 절차**이지 실행 성공 증빙이 아닙니다. 성공 표시와 실제 HTTP 응답은 본인이 배포 및 기기에서 확인한 뒤 입력합니다.

## 적용과 구동

1. 이 브랜치의 변경 사항을 병합하기 전, `T08`을 백업합니다.
2. `T08/scripts/schema.sql`에 `t08_phone_logins`이 추가되었습니다. 기존 데이터/패스키를 지우지 않고, 기존과 동일한 Supabase `DATABASE_URL` 환경에서 **`npm.cmd run db:init`을 한 번 실행**해야 합니다. 이때 DB URL을 Git/캡처에 남기지 마세요.
3. `T08` 디렉터리에서 `npm.cmd install`, `npm.cmd run build`, `npm.cmd test` 실행. 배포가 연결되어 있으면 Vercel Production을 재배포합니다.
4. PC에서 고정된 HTTPS 배포 도메인을 열어 `휴대폰 패스키로 로그인` → **사이트에서 만든 QR**을 휴대폰 기본 카메라로 스캔 → 모바일 브라우저에서 `내 휴대폰 패스키로 PC 로그인 승인` → 휴대폰의 등록된 패스키로 인증 → PC 화면 자동 로그인 확인.
5. QR은 3분만 유효하고 승인 후 한 번만 PC 세션으로 바뀝니다. 브라우저/WebAuthn 팝업의 Bluetooth 및 USB 보안키 검색을 이용하지 않습니다. **휴대폰에서 PC가 시작한 요청임을 확인한 후 승인**하세요.

## 변경된 보안 설계

- `phone-start`: PC 전용 HttpOnly/SameSite=Strict 쿠키 + 별도 QR 일회용 토큰을 생성합니다. DB에는 양쪽 토큰의 SHA-256 해시만 저장합니다.
- `phone-prepare`: 휴대전화가 QR 토큰을 제시하면 서버가 등록된 계정의 WebAuthn 인증 질문을 생성합니다.
- `phone-approve`: 서버가 휴대전화 WebAuthn 서명, Origin, RP ID, challenge, user verification, 저장된 공개키/카운터를 검증합니다. 검증 성공 시 **승인 상태만 기록**하며 휴대폰에 PC 세션을 전송하지 않습니다.
- `phone-poll`: PC의 원래 HttpOnly 쿠키와 대기 요청이 일치할 때만 원자적으로 승인을 소비하고 기존과 동일한 12시간 HttpOnly 로그인 세션을 PC에 발급합니다.
- `phone-cancel`: 대기 요청을 종료합니다. 로그인과 패스키 자체는 삭제하지 않습니다.
- 기존 `registration-verify`, `authentication-verify`, `notes`, `logout`, `passkey-delete`의 접근 제한은 유지합니다.

## 아직 남은 7개 실측

| ID | 직접 실행 | 기록할 값 | 예상 |
| --- | --- | --- | --- |
| C23 | 패스키 **추가 등록 성공 시** PC/휴대폰 DevTools Network `registration-verify` Request Payload 확인 | 실제 필드 이름과 개인키 미포함 여부 | 개인키 필드 없음. 정상 응답에 attestation 및 공개 정보 |
| C25 | 등록된 패스키 개수 확인 → 추가 등록 시작 → 인증 창에서 취소 → 다시 `passkeys` 요청 | 취소 전후 `passkeys.length` | 동일 |
| C30 | 정상 `authentication-verify` 200 확보 후 **다른 새 challenge**로 잘못된 서명/미등록 ID 응답 전송 | 200과 403, 요청 시각, 실패 메시지 | 200/403 |
| C31 | 정상 `authentication-verify`에 성공했던 `challengeId` 및 `response` **전체 JSON 재전송** | 성공 요청 200, 재전송 응답 | 409 |
| C33 | DevTools에서 로그아웃 **전 쿠키를 로컬에서만 보존**, 로그아웃 후 동일한 쿠키를 가진 별도 HTTP 요청으로 `GET /api?action=notes` | 로그아웃 전 200, 로그아웃 후 401 | 200/401 |
| C39 | 상대 계정으로 로그인해 `GET /api?action=notes`의 건수 측정 → 내 계정에서 `account-notes&account=상대계정` 403 시도 → 상대 계정에서 건수 재측정 | 자료 건수 전/후 + 거절 403 | 3→3 |
| C45 | 패스키 A/B 두 개 등록 → A 삭제 → A의 credential ID로 새 로그인 challenge에 대해 검증 요청 → B로 정상 로그인 | A 제거 후 403, B 200 | 403/200 |

**중요한 한계**: C30/31/45의 서명 JSON은 `phone-approve`가 아니라 과제의 기존 `authentication-verify` 요청으로 검사해야 합니다. PC QR 인증 성공은 기존 WebAuthn 서명 검증 경로를 공유하지만, 과제의 재전송 증거를 자동으로 대신하지 않습니다. 크롬 DevTools Network의 Preserve log를 켜고 정상 직접 로그인(가능한 기기) 또는 휴대전화 브라우저에서 정상 인증 요청을 관찰하십시오. 민감한 원시 서명/세션 쿠키/QR 토큰을 최종 제출 파일에 넣지 말고 상태 코드·필드·가린 캡처만 첨부하십시오.

### 검증 기록 (직접 작성)

- 배포 주소/브라우저/OS: [입력]
- `npm test` / `npm run build` 실제 결과: [입력]
- PC QR 생성 → 휴대전화 패스키 승인 → PC 세션 로그인 성공 여부: [입력]
- C23: [입력]
- C25: [입력]
- C30: [입력]
- C31: [입력]
- C33: [입력]
- C39: [입력]
- C45: [입력]

**제출 전:** Vercel 환경변수 `RP_ORIGIN`과 `RP_ID`가 PC/휴대전화에서 여는 동일한 운영 도메인인지 확인합니다. 화면 캡처에서 개인 토큰 및 사용자 데이터가 노출되지 않도록 가립니다.
