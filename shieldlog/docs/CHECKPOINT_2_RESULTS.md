# ShieldLog v1.1 — 중간 점검 2차 검증 기록

- 날짜: 2026-11-06 (KST)
- 테스트 대상: `shieldlog/` 정적 파일 및 동일 로직을 내장한 `standalone.html`
- 도구: Node.js v22, Python Playwright + Chromium (오프라인 문서 로드)
- 테스트 구분: 도구 기반 회귀 검증 / 실제 제3자 사용성 평가 미실시

## 실행 및 결과

| 번호 | 시나리오 | 관찰 결과 |
|---|---|---|
| 1 | 합성 로그 초기 로드 | 전체 150건, 탐지 사건 4건, 높은 위험 2건 |
| 2 | 사건 상세에서 `조사 중`과 메모 저장 | 사건 목록에 변경 상태 표시 |
| 3 | 문서 재로딩 및 저장된 값 다시 조회 | 상태 `investigating`, 메모 내용 재확인 |
| 4 | 사건 보고서(Markdown) 다운로드 | 파일 생성 및 저장된 메모·조사 상태 포함 |
| 5 | 원본 이벤트 IP 검색 | `203.0.113.24` 검색 7건 표시 |
| 6 | 원본 CSV 다운로드 | 헤더 1행 + 이벤트 150행 확인 |
| 7 | 샘플 CSV 가져오기 | 이벤트 150건·탐지 사건 4건 |
| 8 | 샘플 JSON 가져오기 | 이벤트 150건·탐지 사건 4건 |
| 9 | 상태 코드가 없는 파일 입력 | `N/A` 표시, 성공 HTTP 200으로 표시하지 않음 |
| 10 | 390px 모바일 메뉴 탐색 | 메뉴 열기/사건 4건 목록 이동, 화면 가로 넘침 없음 |

- 실행 결과: 브라우저 시나리오 **10/10 PASS**, 관찰된 JavaScript 예외 **0건**
- 탐지 엔진 자동 테스트: `npm test` **12/12 PASS**
- 코드 정적 확인: `node --check app.mjs`, `node --check engine.mjs` 통과

### 사용한 검증 방식과 한계

브라우저 작업 환경의 외부 URL 및 로컬 HTTP 탐색 제한 때문에, Chromium 테스트는 HTML 콘텐츠를 인라인으로 삽입하고 테스트용 `localStorage` 모의 구현을 사용했습니다. 따라서 DOM 이벤트, 파일 선택, 저장/복원 코드 경로, 다운로드 내용과 모바일 레이아웃은 검증했지만, 실제 도메인 origin의 브라우저 저장소 영속성 자체를 이 자동화만으로 입증하지는 못합니다. 배포 상태는 별도로 Vercel에서 확인합니다.

사용자가 직접 접속해 느낀 편의성, 버그·사용후기는 수집하지 않았고 허위로 작성하지 않았습니다. 공용 PC에서 민감한 실로그 사용은 권장하지 않습니다.

### 실행 방법

```bash
npm test
# 필요 시 Chromium과 Python Playwright 준비 후
python tests/browser_smoke.py
```

캡처 결과는 `docs/checkpoint2-desktop.jpg`, `docs/checkpoint2-mobile.jpg`에 보관했습니다. UI의 사건 수치는 가상 로그를 기준으로 합니다.

## 최신 프로덕션 배포 점검

- 2차 업데이트 배포 ID: `dpl_HcPskC2P6n7WxKcPQkbiRkgwB5G9`
- 배포 환경: Production / `READY` (Vercel 배포 API 확인)
- 공식 도메인 연결: `shieldlog-premium.vercel.app`, `shieldlog-premium-boating-duck.vercel.app`
- 새 빌드는 분리된 정적 소스 `index.html`, `app.mjs`, `engine.mjs`, `styles.css` 등을 사용합니다.
- 외부 웹페이지 조회 도구에서 프로덕션 HTML을 직접 열지 못해, 실제 공개 사용자 브라우저에서의 정상 렌더링은 **최종 수동 확인 항목**으로 남겨둡니다.
