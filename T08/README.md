# ALEPH T08 — 공개 소개와 패스키 비공개 영역

기존 T01 소개는 누구나 열 수 있고, 그 아래의 가상 기록만 WebAuthn 패스키로 인증한 계정에 보여 주는 과제입니다. 비밀번호 입력이나 저장 기능은 없습니다.

**최종 운영:** https://duckalepht08.vercel.app/  
**GitHub 소스:** https://github.com/BoatingDuck/aleph-assignments/tree/main/T08  
**최종 점검:** 2026-10-21

## 현재 동작과 검사 결과

- T01 소개 원본을 T08에 합성했습니다. 공개 HTML/JavaScript에 비공개 기록 본문을 포함하지 않으며, 로그인하지 않아도 소개 화면은 열립니다.
- owner, reviewer 두 가상 계정에 서로 다른 비공개 기록이 **3건씩** 있습니다. 로그인 후에는 각자의 기록만 보여 줍니다.
- WebAuthn 등록·로그인은 SimpleWebAuthn 13.2.2를 사용합니다. 서버는 공개키·credential ID·서명 카운터와 등록 이름을 보관하며 **개인키는 저장하지 않습니다**.
- PC의 USB 보안키 선택창에서 아이폰 패스키 로그인에 실패한 문제를 해결하기 위해 **PC 사이트 QR → 아이폰 패스키 승인 → PC 자동 로그인** 기능을 추가했습니다. 실제 아이폰으로 승인해 PC 기록 3건을 확인했습니다.
- PC Chrome의 WebAuthn 가상 인증기에서 별도의 검사용 패스키를 등록해 **변조 서명 403, 정상 서명 200, 동일 요청 재전송 409, 삭제된 패스키 인증 403**을 운영 API에서 확인했습니다. 아이폰 실물 인증과 가상 인증기 실험은 다른 검사입니다.
- **등록 취소** 후 수량 유지, **로그아웃** 후 기존 세션 401, **양방향 계정 격리** 403, **마지막 키 삭제 방지** 409를 확인했습니다.
- Node.js 22로 GitHub Actions 자동 테스트 **31/31 PASS**.
- 최종 DB에서 owner와 reviewer 각각 **패스키 1개 및 가상 기록 3건**을 확인했습니다. 시험용 가상 키는 삭제했습니다.

## 제출 관련 문서

| 문서 | 포함 내용 |
| --- | --- |
| [제출정리](docs/제출정리.md) | 제출 주소, 짧은 확인 4줄, AI와 내 판단 3줄 |
| [인증구현설명서](docs/인증구현설명서.md) | 인증 선택 이유, 구현 경로, 네 가지 성공·거절 검사, 한계 |
| [검사결과](docs/검사결과_2026-10-21.md) | C23·C25·C30·C31·C33·C39·C44~C46 실측 근거와 환경 |
| [조건별재점검](docs/조건별재점검.md) | 과제 C01~C03·C10~C53 총 47개 기준의 대응 상태 |
| [아이폰과 PC 실험 과정](docs/PC_휴대폰_QR로그인_최종검사.md) | 아이폰 인증 제약, QR 변경 이유, 가상 인증기 검사 단계 |

## 소스 위치

| 파일 | 역할 |
| --- | --- |
| `scripts/sync-t01.mjs` | 원본 T01 공개 소개 합성 |
| `snippets/private-room.html`, `public/index.html` | T08 잠금 UI와 공개 HTML |
| `src/passkey-client.js`, `src/passkey-login.js` | 브라우저 패스키 등록·로그인·QR 연동 |
| `api/index.js` | WebAuthn 검증, 일회용 질문, 권한 검사, PC 승인·세션 발급 |
| `scripts/schema.sql` | Supabase 계정·메모·키·질문·세션·QR 연결 7개 테이블 및 RLS |
| `tests/*.test.mjs` | 로직·정적 파일·암호학 회귀 검사 |

환경은 Vercel(T08 Root Directory, Node.js 22)과 Supabase PostgreSQL입니다. 환경변수 `DATABASE_URL`, `RP_ORIGIN`, `RP_ID` 및 필요할 때의 TLS CA 값은 서버 측에만 설정하며 GitHub에 게시하지 않았습니다.

## 로컬 코드 검증

저장소의 T08 디렉터리에서 다음 명령을 실행할 수 있습니다.

```powershell
npm.cmd ci
npm.cmd run sync:t01
npm.cmd run build
npm.cmd test
```

이는 **자동 테스트**이며, 브라우저에 저장된 아이폰 패스키의 실제 인증을 대신하지 않습니다. 실기기 인증과 실패 요청 실측은 운영 사이트에서 별도 진행했으며 해당 HTTP 결과를 문서에 남겼습니다.

## 보안 제한 및 개발 기록

세션 쿠키에는 HttpOnly·SameSite=Strict·Secure(HTTPS) 속성을 적용하고, 로그인 질문을 1회 소비합니다. PC 연결용 QR은 3분 만료되며 PC·휴대전화 토큰을 분리합니다. Supabase의 7개 테이블에는 RLS를 켰고 브라우저의 anon/authenticated 역할 접근 권한을 회수했습니다.

패스키 분실 시 독립 복구 절차, IP별 로그인 속도 제한, 지속적인 보안 감사 로그는 구현하지 않았습니다. C23 Network 캡처의 일부 접힌 필드와 C46의 키 0개 시나리오는 개별 실측으로 남기지 않았습니다. C40은 GET 주소 및 POST 본문에서 다른 계정명을 전달하는 요청을 직접 실측해 둘 다 본인 자료 3건만 반환함을 확인했습니다. 가능한 범위를 넘겨 통과했다고 적지 않았습니다.

기존 `docs/디자인업그레이드*.md`, `docs/Supabase_설정안내.md` 및 TLS 연결 문서는 **버전별 개발 과정**을 보존한 자료입니다. 과거 설치 안내·테스트 개수는 현재 제출 상태가 아니며 위의 최종 문서를 우선 확인합니다.
