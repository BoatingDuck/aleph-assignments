# ShieldLog — 보안 이벤트 탐지·분석 웹앱

**배포 주소:** https://shieldlog-premium.vercel.app/

브라우저에서 CSV/JSON 보안 로그를 분석하고, 반복 로그인 실패·다중 계정 인증 시도·민감 경로 탐색·HTTP 오류 급증을 탐지하는 보안 운영 워크벤치입니다. 탐지 근거 확인, 사건 상태·메모 저장, 검색·내보내기 기능을 제공합니다.

## 즉시 확인하기 (3단계)

1. **배포 주소로 접속**하여 합성 샘플 로그 150건 및 탐지 사건 4개를 확인합니다.
2. **탐지된 사건**에서 사건을 열어 근거 로그를 확인하고 `조사 중` 선택 및 메모 저장 후 새로고침합니다.
3. **사건 보고서 내보내기**를 눌러 Markdown 파일을 다운로드하고, **원본 이벤트**에서 검색을 시연합니다.

초기 통계: 전체 150건, 탐지 사건 4개(유형별 1개), 높은 위험 2개, 고유 IP 9개. 모든 수치는 합성 데이터의 예시입니다.

## 로컬 실행

프로젝트 디렉터리에서 Python이 설치되어 있다면:

```bash
python -m http.server 8000
```

브라우저에서 `http://localhost:8000`에 접속합니다. VS Code의 Live Server로 `index.html`을 실행해도 됩니다. 별도 라이브러리 설치는 필요하지 않습니다. `standalone.html`은 한 파일로 합친 시연용 버전입니다.

## 자동 테스트

Node.js 18 이상에서 다음 명령어를 실행합니다.

```bash
npm test
```

`tests/engine.test.mjs`는 탐지 임계값, 시간 창, CSV 따옴표 처리, 유효하지 않은 시간값, JSON 래퍼, 샘플 데이터 재현, 공격 위험 문자열 입력을 검증하는 12개의 단위 테스트를 포함합니다.

## 입력 파일 사양

- 크기: 최대 2MB / 최대 4,000행
- 형식: `.csv`, `.json`
- 열: `timestamp` 필수, `ip`·`username`·`path`·`status`·`method`·`message` 권장
- 타임스탬프: ISO 8601 형식(예: `2026-11-06T03:00:00Z`)
- JSON: 이벤트 객체 배열 또는 `{ "events": [...] }`
- 인식 가능한 동의어: `time`, `sourceIp`, `source_ip`, `user`, `statusCode` 등
- 잘못된 시간값 행은 분석에서 제외하며, 제외 개수가 화면에 표시됩니다.

`examples/` 폴더에 샘플 JSON/CSV가 있습니다.

## 프로젝트 구조

```text
shieldlog/
├── index.html                  # 원본 웹앱 페이지
├── styles.css                  # 반응형 디자인
├── app.mjs                     # 화면 상태, 파일 입출력, 사건 관리
├── engine.mjs                  # 로그 정규화, 4종 탐지 규칙
├── favicon.svg
├── standalone.html             # 단일 HTML 실행/배포 동등본
├── vercel.json                 # 정적 배포 보안 응답 헤더 구성
├── package.json               # 테스트 명령어
├── plan.md                    # 계획 설계서
├── examples/                  # 합성 예제 로그
├── tests/                     # 단위 테스트
└── docs/                      # 점검·최종 제출 가이드·증거 이미지
```

## 데이터 보호와 사용 범위

- 분석은 브라우저 안에서만 이루어집니다. 외부 분석 API 또는 백엔드 서버로 로그를 업로드하지 않습니다.
- 조사 메모와 사용자 가져오기 데이터는 브라우저의 `localStorage`에 저장됩니다. 공유 컴퓨터에서는 앱의 **분석 가이드 → 로컬 데이터 삭제**를 사용하세요.
- 데이터 용량 제한 또는 사생활 보호 모드에서는 저장이 실패할 수 있으며 이 경우 화면에 안내됩니다.
- 실제 보안 장비 로그에는 인증정보·토큰·개인정보를 제거하거나 적절히 비식별화한 후 입력하세요.
- 탐지 규칙이 일치한다고 실제 공격이 확정되는 것은 아닙니다. 교육·실습 보조 도구이지 운영 SOC·자동 차단 솔루션은 아닙니다.

## 배포 및 소스의 차이

Vercel에는 원본 `index.html`에 `styles.css`, `engine.mjs`, `app.mjs`를 동일한 내용으로 내장한 **단일 HTML 빌드**를 배포했습니다. ZIP은 기능 유지·수정을 쉽게 하도록 원본 파일을 분리해 포함합니다. `standalone.html`도 ZIP에 포함하므로 배포판을 그대로 확인할 수 있습니다. `vercel.json`의 CSP는 분리된 정적 파일 배포용입니다.

## 검증 상태

- 자동 테스트 12/12 PASS
- Chromium 브라우저에서 대시보드·4개 사건·상태 저장 및 재조회·검색·CSV 가져오기·모바일 메뉴 확인
- Vercel API를 통해 프로덕션 READY 및 공식 URL 연결 확인
- Vercel 배포 URL 조회로 프로덕션 주소의 HTTP 200 OK와 앱 HTML 원문 반환 확인. 익명 사용자 브라우저에서의 최종 렌더링은 제출자가 직접 확인 권장

## 제출

계획서 `plan.md`를 Workbench에 올리고 **새 버전 저장**을 수행한 뒤, 중간 점검 1·2차 및 최종 제출란을 순서대로 작성해야 합니다. Workbench 점검 접수는 앱 배포만으로 자동 완료되지 않습니다. 제출란에 사용할 문구는 `docs/` 폴더에 수록했습니다.

## GitHub 소스 관리

GitHub 원본 소스는 [`BoatingDuck/aleph-assignments/shieldlog`](https://github.com/BoatingDuck/aleph-assignments/tree/main/shieldlog)에 보관합니다. 원본 정적 파일을 Vercel에 연결할 때는 프로젝트 루트에 있는 `index.html`, `app.mjs`, `engine.mjs`, `styles.css` 및 `vercel.json`을 그대로 배포합니다. 기존 운영 중인 `shieldlog-premium.vercel.app` 도메인은 배포 주소이며 GitHub 저장소 이름과는 독립적입니다.

## 2차 점검 업데이트 (v1.1)

- CSV/JSON 전체 파일 가져오기, 브라우저 저장과 문서 다시 불러오기 후 조사 메모 복원, 사건 보고서(Markdown)/원본 CSV 다운로드를 Chromium에서 회귀 검증했습니다.
- 모바일 390px에서 사이드바 열기/사건 목록 이동과 수평 스크롤 없는 표시를 확인했습니다.
- 입력 로그의 HTTP 상태값이 누락되었을 때 성공(`200`)으로 간주되던 문제를 고쳤습니다. 이제 상태를 알 수 없음을 `N/A`로 표시합니다.
- 테스트 결과와 점검 입력란 초안은 `docs/CHECKPOINT_2.md`, 상세 실행 결과는 `docs/CHECKPOINT_2_RESULTS.md`에서 확인할 수 있습니다.
- 브라우저 자동화는 로컬 인라인 문서와 테스트용 저장소 모의 객체를 사용했습니다. 이는 공개 URL의 실사용자 브라우저 환경에서의 저장 지속 여부에 대한 보증과 구별합니다.

브라우저 동작의 재현용 코드는 `tests/browser_smoke.py`에 있습니다(Python Playwright 및 로컬 Chromium 필요). 테스트용 로컬 저장 모의 구현이 포함되어 있으므로 실제 사용자 브라우저 영속성 검증과는 구별합니다.
