# JSON 검사 기록

가져오기 전 템플릿 개수와 가져오기 후 개수를 함께 기록한다.

| 입력 | 기대 결과 | 가져오기 전 | 가져오기 후 | 판정 |
|---|---|---:|---:|---|
| samples/valid.json | 정상 복원 |  |  |  |
| samples/broken.json | 문법 오류 표시, 기존 목록 유지 |  |  |  |
| samples/missing-field.json | 필수 항목 오류 표시, 기존 목록 유지 |  |  |  |
