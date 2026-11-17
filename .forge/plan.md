<!-- forge-slug: filament-count-modes -->
<!-- task: 5 -->
<!-- tdd: on -->
# 필라멘트 개수별 동작: 1개 높이만 · 2개 흑백 층(색 선택) · 3~4개 색 영역 + 톤 높이 (코어 + UI)

## Goal / Non-goals
- Goal: UI 흐름 "1. 필라멘트(개수 1~4, 색) → 2. 이미지 → 3. 옵션". 1개는 그레이스케일 톤 단계를 높이로만 쓰는 단색 릴리프, 2개는 기존 층 모드 그대로(색만 선택 가능), 3~4개는 각 셀을 Lab 최근접 필라멘트 색으로 나눈 색 영역을 색별 파트로 출력하고 높이는 같은 그레이스케일 톤 단계로 정한다. 화면(2D 미리보기·3D 뷰어·다운로드)에서 확인할 수 있어야 한다.
- Non-goals: 두께 농담(베이스 위 적층 혼합) / 층 쌓는 순서 선택 / 3색 이상 색 교체(tool_change) / 작은 조각 정리 / 슬롯별 소재 설정 / 모바일 3D 뷰어 잘림 수정.

## Source of truth
- Glossary terms: Layer mode, Color region mode, Palette, Color region, Tone step in .forge/CONTEXT.md
- Related ADRs: .forge/adr/261117-154234-color-region-mode.md (Amendment 2 가 현재 규칙), .forge/adr/261116-134329-two-filament-thickness-tone-bambu-3mf.md
- 규칙: 높이는 모든 개수에서 기존 `processImage` 의 결과(그레이스케일 → adjust → N단계 → 베이스 + k×m 레이어)를 그대로 쓴다. K≥3 의 셀 색 = 알파 가중 평균 RGB 의 Lab 최근접 팔레트 색, 색마다 파트 1개(필라멘트 = 슬롯+1), 색 교체 파일 없음. K=1 은 파트 1개. K=2 는 `build3mf`(색 교체 1회)에 색 2개를 넘기며 기본 [#000000,#FFFFFF] 출력은 HEAD 와 바이트 동일.
- 이미 있는 코드(작업 트리): `src/core/color.ts`(`nearestColor`), `threemf.ts` 의 `build3mfParts`, `colorRegions.ts`(평평한 높이 버전 — 이번에 톤 높이로 바꾼다).
- Definition of Done (사전 상태 측정):
  1. `npm test` exit 0 — 사전: 85 passed (회귀 방어).
  2. `npm run build` exit 0 — 사전: 통과 (회귀 방어).
  3. K=2 기본 색의 `build3mf` 출력 8개 엔트리 sha256 이 HEAD 와 동일 — 사전: 동일 (회귀 방어).
  4. `colorRegions.test.ts`: 색 인덱스는 Lab 최근접, 높이·톤 단계는 같은 입력의 `processImage` 결과와 완전히 같음, 파트 부피 합 = 전체, 셀 없는 색은 파트 없음 — 사전: 평평한 높이 테스트가 통과 중(forward check).
  5. `threemf.test.ts`: `build3mf` 에 colors [#112233,#AABBCC] 를 주면 `filament_colour` 와 tool_change color 가 그 색 — 사전: 옵션 없음.
  6. `model.test.ts`: 개수별 기본 색, 색 영역 미리보기 픽셀, 색별 셀 수 — 사전: 없음.
  7. 브라우저 UAT: 1개(단색, 색 교체 없음) / 2개(기본 화면이 이전과 같음: 0.88 / 마커 0.96, 삼각형 6,012) / 3개(검정·흰색·분홍 합성 이미지에서 분홍 부분이 분홍으로 2D·3D 에 보이고 높이 단차 있음) / 다운로드 성공 — 사전: 없음.
  8. 수동 슬라이서 확인(사용자): 3색 3MF 가 Bambu Studio 에서 파트별 필라멘트 1·2·3 으로 열리고 슬라이스되는지 — 사전: 없음.

## Work slices
- [ ] S1. 색 영역 코어 — `processRegionImage` 가 `processImage` 결과에 셀 색 인덱스를 더해 반환하고 `buildRegionParts(heights, color, cols, rows, pitch, K)` 가 색별 파트를 만든다. — completion criterion: DoD 4번 테스트가 통과한다.
- [ ] S2. 층 모드 색 선택 — `build3mf` 에 선택적 `colors`(2개)를 추가한다. — completion criterion: DoD 5번 테스트가 통과하고 기본 출력이 HEAD 와 동일하다(DoD 3번). (depends: S1)
- [ ] S3. UI 모델 — 개수별 기본 색, 색 영역 미리보기, 색별 셀 수. — completion criterion: DoD 6번 테스트가 통과한다. (depends: S1)
- [ ] S4. 워커·뷰어 — 워커가 파트 목록을 반환하고 뷰어가 파트별 색(2개일 때는 색 교체 높이 위아래 두 색)으로 칠한다. — completion criterion: 브라우저에서 1·2·3개 모두 3D 가 의도한 색으로 보인다(DoD 7번). (depends: S3)
- [ ] S5. 패널·미리보기·다운로드 — "1. 필라멘트 → 2. 이미지 → 3. 옵션", 3개 이상일 때 색 영역 2D 미리보기와 색별 셀 수, 개수에 맞는 3MF 다운로드. — completion criterion: DoD 7번 브라우저 UAT 가 통과한다. (depends: S2, S4)
- [ ] S6. 샘플 — `npm run sample -- regions` 가 새 규칙의 3색 샘플을 만든다. — completion criterion: 파일이 생성되고 사용자가 Bambu Studio 확인 결과를 알려 준다(DoD 8번). (depends: S1)
