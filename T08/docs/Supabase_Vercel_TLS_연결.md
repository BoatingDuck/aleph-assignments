# T08 · Vercel ↔ Supabase TLS 신뢰 인증서 연결

> **문제 해결 경위 기록:** TLS 오류를 추적하던 시기의 설정 방법입니다. 현재 운영 `/api?action=status`가 HTTP 200으로 DB에 연결되는 것은 확인됐습니다. 아래의 CA 설정은 재현 방법으로 남겨 둔 것이며, **지금 다시 변경해야 한다는 뜻이 아닙니다**.

## 문제
배포된 API에서 `SELF_SIGNED_CERT_IN_CHAIN`이 발생하면 서버는 Supabase 연결의 TLS 인증서 체인을 검증할 수 없는 상태이다.

## 해결
`T08/lib/db.mjs`는 `SUPABASE_DB_CA_B64` 환경변수(공식 CA 인증서 PEM 파일의 base64 인코딩)를 읽어 `pg.Pool`의 `ssl.ca`로 전달한다. `rejectUnauthorized: true`를 유지하므로 인증서·호스트 검증은 해제되지 않는다. `DATABASE_URL`의 `sslmode` 등 SSL 관련 쿼리 파라미터는 `pg`가 별도 `ssl` 설정을 덮어쓰지 못하도록 코드에서 제거한다. 실제 연결은 TLS 필수로 진행한다.

## 강의실 PowerShell에서 CA 값을 Vercel로 복사
Supabase Dashboard의 Database Settings → SSL Configuration에서 내려받은 공식 `prod-ca-2021.crt` 파일이 Downloads에 있다고 가정한다.

```powershell
$caPath = Join-Path $env:USERPROFILE 'Downloads\prod-ca-2021.crt'
Test-Path $caPath
[Convert]::ToBase64String([IO.File]::ReadAllBytes($caPath)) | Set-Clipboard
```

Vercel → 기존 T08 프로젝트 → Settings → Environment Variables → `SUPABASE_DB_CA_B64` 등록, 환경은 `Production`, Value에는 클립보드의 base64 텍스트를 붙여넣는다. DB 비밀번호가 들어 있는 `DATABASE_URL`은 기존 값을 유지한다.

새 Git 커밋을 Production에 배포한 뒤 `/api?action=status`가 HTTP 200이고 가상 계정 2개가 반환되는지 확인한다. 이어서 `npm run check:public`을 다시 실행한다.

### 주의
- `.crt`는 공식 Supabase CA 인증서이어야 한다. 임의 인증서를 신뢰 저장소에 추가하지 않는다.
- `NODE_TLS_REJECT_UNAUTHORIZED=0` 또는 `rejectUnauthorized:false`를 사용하지 않는다.
- `DATABASE_URL`, 인증 세션, 초대 링크는 GitHub나 제출 문서에 게시하지 않는다.
- Vercel 서버리스 환경에서는 로컬 Downloads의 인증서 파일 경로를 사용할 수 없다.
- 진단용 환경변수에 인증서 외 다른 민감한 내용을 추가하지 않는다.
