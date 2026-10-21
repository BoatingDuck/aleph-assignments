# ALEPH T08 · T01 소개 페이지 + WebAuthn 패스키 비공개 자리

## 최종 결과 (2026-10-21)

- 결과물: https://duckalepht08.vercel.app/
- 소스: https://github.com/BoatingDuck/aleph-assignments/tree/main/T08
- 실제 아이폰 패스키로 PC QR 승인 로그인·가상 메모 3건 확인.
- Chrome DevTools WebAuthn 가상 인증기로 운영 서버에 변조 서명 403/정상 200/동일 요청 재전송 409, 삭제 키 인증 403 실측.
- 등록 취소 후 패스키 수 유지, 로그아웃 후 401, 양방향 다른 계정 403, 마지막 키 삭제 409 확인.
- 자동 테스트 31/31 PASS; 최종 DB owner/reviewer 각 패스키 1개와 비공개 메모 3건 유지.
- [제출정리](docs/제출정리.md), [인증구현설명서](docs/인증구현설명서.md), [조건별재점검](docs/조건별재점검.md), [실측기록](docs/검사결과_2026-10-21.md)

> 아래 설치 명령과 초기 재검토 안내는 당시 작업 방법을 남긴 개발 이력입니다. **현재 미실행 항목이나 제출 전 미완료를 뜻하지 않습니다.** 최종 상태는 위 링크를 기준으로 판단합니다.

## 구현 요약

기존 **T01 전체 공개 소개** 아래에 T08 비공개 섹션만 추가합니다. 정적인 `public/index.html`에는 비공개 가상 메모가 들어 있지 않습니다. 비공개 자료는 서버의 `GET /api?action=notes`에서 **HttpOnly 세션 쿠키** 확인 후에만 내려갑니다. 비밀번호 로그인·비밀번호 DB 칼럼은 없습니다.

* **인증**: SimpleWebAuthn 13.2.2 (WebAuthn/FIDO2), 애플리케이션 서버에 개인키를 보내지 않는 인증, 서버 측 공개키·서명 검증. 발견 가능한 자격 증명(`residentKey: required`) 및 사용자 확인을 요구
* **DB**: Supabase PostgreSQL, 사용자 2명(`owner`, `reviewer`), 서로 다른 가상 메모 3건씩
* **배포**: Vercel (프레임워크 Other, Root Directory = `T08`, npm, Node.js 22.x)
* **최초 등록**: 터미널에서 발급하는 **10분·1회용 초대 URL**. 최초 등록 이외에는 사용할 수 없습니다. 별도 비밀번호는 사용하지 않습니다. 로그인 후에는 기존 패스키 인증을 거친 세션으로만 추가 등록합니다.
* **잠금 안전장치**: 마지막 패스키 삭제 금지. 아무 패스키 없는 초기 계정은 로그인 거절 후 새 일회용 초대로 최초 등록해야 합니다.
* **실제 개인정보**: 사용하지 않습니다. 비공개 자료는 만들어 넣은 실습 데이터입니다.

## 설치 (Windows PowerShell)

1. 기존 저장소 `C:\Users\User\Desktop\aleph-assignments`에 압축을 풀어 `T08` 폴더를 넣으세요. 기존 `T01` 폴더는 수정하지 않습니다.
2. 터미널을 `...\aleph-assignments\T08`로 열고 아래 명령을 실행하세요.

```powershell
npm.cmd install
npm.cmd run sync:t01
npm.cmd run build
npm.cmd test
```

`sync:t01`은 **실제 기존 T01의 HTML/CSS/JS/파비콘을 읽어** `T08/public`에 복사하고 비공개 섹션만 덧붙입니다. ZIP에도 동일 내용의 공개 소개 페이지를 별도로 넣었지만, **최종 제출에는 이 명령을 꼭 실행해 본래 T01 화면을 100% 유지**하세요. 복사 결과 `public/index.html`, `public/style.css`, `public/script.js`, `public/assets/favicon.svg`도 `T08` 커밋에 포함해야 합니다.

## Supabase 데이터베이스 및 Vercel 배포

1. Supabase에서 새 프로젝트를 만든 후 Dashboard → Connect → Transaction pooler (6543)의 PostgreSQL 접속 URI를 복사합니다. Vercel 서버리스 연결이므로 `pg`(node-postgres)의 파라미터 바인딩 및 1개 연결 풀을 사용합니다. Supabase Auth는 사용하지 않습니다. **절대 Git에 올리지 마세요.** T08 전용 프로젝트를 권장합니다. 테이블에는 `t08_` 접두사가 붙습니다.
2. Vercel에서 새 프로젝트를 연결합니다. GitHub `BoatingDuck/aleph-assignments` 저장소, Root Directory `T08`, Framework Preset `Other`, Build Command `npm run build`, Output Directory `public`, Node.js 22.x. **접근 보호/비밀번호 보호는 끕니다.**
3. 고정 HTTPS 배포 주소를 정하고 Vercel 프로젝트 환경변수 3개를 추가합니다.

| 변수 | 예시 형식 | 주의 |
| --- | --- | --- |
| `DATABASE_URL` | Supabase Connect → Transaction pooler의 PostgreSQL URI | **비밀값**, Vercel 서버 전용, 클라이언트 접두사 금지 |
| `RP_ORIGIN` | `https://t08-example.vercel.app` | 배포된 페이지의 **정확한** Origin, 슬래시 없이 |
| `RP_ID` | `t08-example.vercel.app` | 포트·스킴 없는 호스트명 |

환경변수를 설정한 뒤 **Redeploy**하세요. Preview URL이나 도메인이 달라지면 WebAuthn 검증이 실패할 수 있으므로 하나의 고정 프로덕션 도메인에서 등록하고 시험하세요.

**Supabase 보안 설정**: `npm run db:init`은 스키마를 만들고 `t08_` 7개 테이블 전체에 RLS를 적용하며 `anon`/`authenticated`의 접근 권한을 회수합니다. 이 앱은 Supabase Data API 또는 Supabase Auth를 쓰지 않습니다. WebAuthn 서버만 비공개 데이터에 접근합니다. PostgreSQL 접속 계정은 서버에서만 사용합니다.

**설치 의존성 변경**: 이전 Neon 라이브러리를 제거하고 `pg`를 사용합니다. 패치 적용 후 반드시 `npm.cmd install`을 실행하여 `package-lock.json`을 다시 만들고 같이 커밋해야 합니다.

4. PC PowerShell 터미널에서 실제 값으로 **해당 세션의 환경변수만 지정**합니다. 아래 URL은 예시이며 실제 비밀값을 문서/캡처에 포함하지 않습니다.

```powershell
$env:DATABASE_URL = 'SUPABASE에서_받은_Transaction_pooler_URI'
$env:RP_ORIGIN = 'https://실제-T08-배포-주소.vercel.app'
$env:RP_ID = '실제-T08-배포-주소.vercel.app'
npm.cmd run db:init
```

5. `npm.cmd run invite:owner`로 10분 유효한 등록 링크를 발급해 **본인의 브라우저에서만** 열고 첫 패스키 등록. 이어 로그인 상태에서 `예비 패스키`를 추가 등록합니다. 저장 위치를 (Google 비밀번호 관리자 / 기기 자체 / 보안 키) 중 실제 상황대로 기록하세요.
6. `npm.cmd run invite:reviewer`로 검증 계정을 별도 시크릿 창 또는 다른 브라우저에서 등록합니다. 이 두 번째 계정에 대한 초대 URL도 절대 제출하지 마세요.
7. 검사 스크립트 (PowerShell):

```powershell
$env:SITE_URL = $env:RP_ORIGIN
npm.cmd run check:public
npm.cmd run public-keys
```

`check:public`은 **로그인 전 요청 6개와 페이지 HTML 검사만 실제 테스트**해 `docs/evidence/public-check.json`을 생성합니다. 패스키 기기 실험은 직접 수행하고 `docs/인증구현설명서.md`의 기록 칸을 채워야 합니다. `public-keys`는 DB에 저장된 **공개키만** 출력하며, 서버 비밀값은 표시하지 않습니다.

## 로컬 실행 (선택)

로컬 실행은 PostgreSQL을 연결한 상태에서 `RP_ORIGIN=http://localhost:3000`, `RP_ID=localhost`로 설정하고 `npm.cmd run db:init`, `npm.cmd run build`, `npm.cmd run dev`를 사용하세요. 프로덕션의 등록된 패스키는 localhost에서 재사용할 수 없으므로 별도의 DB를 권장합니다.

## API 경로와 권한 경계

`api/index.js`가 모든 서버 API를 담당합니다. `src/passkey-client.js`는 브라우저의 패스키 요청/응답만 중계하며 비공개 자료를 소스에 포함하지 않습니다.

| 메서드/경로 | 의미 | 검사/권한 |
| --- | --- | --- |
| `GET /api?action=status` | 로그인 상태 (공개 메타만) | 무로그인 허용 |
| `POST /api?action=registration-options` | 등록 질문 생성·DB 보관 | 현재 로그인 세션 또는 일회용 등록 초대 |
| `POST /api?action=registration-verify` | 패스키 공개키 저장 | 질문·Origin·RPID·UV 검증, 1회 소비 |
| `POST /api?action=authentication-options` | 로그인 새 질문 생성·DB 보관 | 등록된 계정의 패스키만 허용 목록에 포함 |
| `POST /api?action=authentication-verify` | 공개키로 응답 서명 검증 | 일회용 질문 원자적 소비 후 세션 발급 |
| `POST /api?action=logout` | 세션 폐기 | 서버에서 세션 해지 + 쿠키 만료 |
| `GET/POST /api?action=notes` | **내 가상 비공개 자료** | 세션 계정 ID만 사용, 클라이언트 제공 계정 ID 무시 |
| `GET /api?action=account-notes&account=...` | 타 계정 거절 증거용 | 계정 ID 다르면 403 |
| `GET /api?action=passkeys` | 패스키 이름/등록일 | 로그인 세션 필수 |
| `POST /api?action=passkey-delete` | 패스키 하나 폐기 | 내 키만, 마지막 1개는 삭제 거절 |

로그아웃한 세션/없어진 패스키/타인 계정은 서버 검증을 통과하지 않습니다. 모든 POST는 Same-Origin + JSON만 허용하며, 세션은 12시간 후 만료되고 쿠키에는 원시 불투명 토큰만 담겨 `HttpOnly`, `SameSite=Strict`, HTTPS에서 `Secure`를 적용합니다. DB에는 세션 토큰의 SHA-256 해시만 저장합니다.

## 한계 및 정직한 범위

- `npm test`는 **순수 함수 및 구현 구조·T01 원본 파일 동일성**에 대한 자동 테스트입니다. 실제 기기 패스키 생성·서명/삭제와 DB 연결 성공은 실행 환경에서 검증해야 합니다.
- 보안 키/플랫폼 인증기 종류에 따라 동일 기기에서 별개의 두 패스키가 저장되지 않을 수 있습니다. 두 번째 기기나 하드웨어 보안 키를 사용하세요.
- 동기화형 패스키는 제공업체에 의해 암호화되어 다른 기기로 동기화될 수 있습니다. 따라서 “개인키가 앱 서버로 전송되지 않는다”는 것과 “어떠한 형태로도 원래 기기를 벗어나지 않는다”는 것은 다릅니다.
- 사용자 분실 시 단순 이메일·비밀번호 복구 기능은 **제공하지 않습니다.** 관리자가 신원을 확인하는 별도 오프라인 절차도 아직 구현되지 않았습니다.
- 서버 측 횟수 제한·지속적인 보안 감사 이벤트·분산 환경의 IP별 차단은 향후 과제입니다.
- `public/index.html`에 가상 비공개 항목이 없는지는 소스 보기로, 서버 API 차단은 직접 API 응답으로 각각 확인하세요.

## Git 업로드 순서

저장소 루트 `C:\Users\User\Desktop\aleph-assignments`에서:

```powershell
git status
git add T08
git status
git commit -m "T08 T01 소개 페이지 패스키 비공개 영역 추가"
git push origin main
```

최종 제출: 결과물 `https://<배포 도메인>/`, 소스 `https://github.com/BoatingDuck/aleph-assignments/tree/main/T08`. 최종 HTTPS URL은 직접 배포 뒤 확인해 적어야 합니다.

## 재검토 안내 (2026-10-15)

- 첫 ZIP에서 T01의 JS/CSS가 재작성된 버전이었으나, 이번 재검토 파일에서는 GitHub T01의 원본과 Git blob SHA-1 해시가 **각각 완전히 일치**하도록 복원했습니다. 최종 설치 후 `sync:t01`도 실행해 원본과 일치시켜 주세요.
- 발견 가능한 패스키 생성을 위한 `residentKey: required`로 조정했고, 등록 취소 메시지와 개발자 도구 테스트 예제를 수정했습니다.
- 2026-10-15 당시 자동 테스트는 11개였으며, 최종 2026-10-21 자동 테스트는 31개 모두 통과했습니다. **당시에는 실제 기기 인증 성공을 확인하지 못한 상태였습니다.** 이후 아이폰 QR 로그인, 실제 운영 HTTP 401/403/409, GitHub Actions 설치·빌드·테스트를 검증했습니다.
- 과제별 구현 여부 및 직접 증빙 요건은 `docs/조건별재점검.md`를 참고합니다.
