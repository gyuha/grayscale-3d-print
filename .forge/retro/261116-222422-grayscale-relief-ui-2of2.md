<!-- auto-retro: fg-done all -->
# 2026-11-16 — 그레이스케일 릴리프 웹 UI: 업로드·파라미터·2D/3D 미리보기·3MF 다운로드 (2/2)

## Plan vs actual
- 계획대로 진행된 것: S2~S5 (파라미터 패널, 2D 톤 미리보기, three.js 릴리프, 정보 패널 + 다운로드).
- 불일치:
  - S1: jsdom에는 canvas가 없어 이미지 디코딩을 단위 테스트로 검증하지 못했다. 실제 브라우저(agent-browser)로 600×800 사진 업로드를 구동해 확인했다.
  - 계획 밖 추가: `processImage` 반환값에 `gray` 추가, 정보 패널에 슬라이서 마커 높이(0.96) 표시, tsconfig에 `vite/client`·`resolveJsonModule` 추가, 사용자 요청으로 dev 서버 `--host 0.0.0.0`과 Taskfile.yml 추가.
  - 번들 835kB(three.js)로 Vite 청크 크기 경고가 남았고 처리하지 않았다.

## Learnings
- 다음에 다르게 할 것: canvas·WebGL 의존 UI는 계획 단계에서 "브라우저 구동 UAT"를 검증 수단으로 명시한다(jsdom으로는 불가). 모바일 레이아웃은 이 작업 범위에 없었고 이후 별도 작업으로 CSS 미디어 쿼리로 추가했다.

## Doc updates
- 검토되지 않음 (자동 회고) — fg-learn 일괄 승급 대상
