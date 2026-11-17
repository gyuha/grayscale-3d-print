<!-- forge-slug: color-regions-1of2 -->
<!-- task: 3 -->
<!-- part: 1/2 -->
<!-- tdd: on -->
# 색 영역 모드 코어: Lab 최근접 색 분류 · 평평한 높이 · 색별 파트 · 다중 파트 3MF (1/2)

## Goal / Non-goals
- Goal: 컬러 이미지의 각 셀을 고른 필라멘트 색(1~4개) 중 Lab 거리가 가장 가까운 색으로 분류하고, 모든 셀을 같은 높이로 만들어 색마다 별도 파트(필라멘트 지정)로 낸 Bambu A1 다중 파트 3MF 를 출력하는 순수 코어 로직. UI 는 2/2. 이 파트의 끝에서 사용자가 작은 샘플 3MF 를 Bambu Studio 로 열어 구조를 확인한다(2/2 의 선행 확인).
- Non-goals: **명도·그레이스케일·톤 단계·이미지 보정(밝기/대비/감마/반전)·명도 기반 높이(사용자 요청으로 제거 — ADR Amendment)** / UI·3D 뷰어·미리보기(2/2) / 흑백 2색 층 모드 변경(그대로 유지) / 층 쌓기·색 교체 방식 / 채도 기준 분류 / 베이스 슬롯 / 반투명 혼합 / 슬롯별 소재·온도 / 작은 조각(섬) 정리.

## Source of truth
- Glossary terms: Color region mode, Palette, Color region in .forge/CONTEXT.md
- Related ADRs: .forge/adr/261117-154234-color-region-mode.md (결정과 Amendment), .forge/adr/261116-134329-two-filament-thickness-tone-bambu-3mf.md (층 모드 유지, 레이어 격자 스냅·3MF 출력 기반)
- 규칙(ADR 확정): 팔레트 = 슬롯 순서의 색 K개(1..4, `#rrggbb`), 슬롯 i 의 필라멘트 번호 = i+1. 셀 색 = 알파 가중 박스 평균 RGB(기존 `processImage` 와 같은 리샘플). 셀의 색 인덱스 = Lab(L*,a*,b*) 유클리드 거리가 최소인 팔레트 색(동점이면 낮은 슬롯). 높이 = 모든 셀 같음 = `snapToLayerGrid(baseThickness)`. 톤 단계·`adjust`·명도 계산은 색 영역 모드에서 쓰지 않는다. 마스크(커버 0.5 미만, 둥근 모서리)는 `processImage` 와 같은 규칙. 색마다 파트 1개(그 색 셀의 높이맵, z 0→높이), 셀이 하나도 없는 색은 파트 없음. K=1 은 파트 1개(높이만).
- 이미 구현되어 유지되는 부분(이전 실행, 테스트 통과): `src/core/color.ts`(`rgbToLab`·`parseHex`·`nearestColor`)와 `color.test.ts`, `threemf.ts` 의 `build3mfParts`(파트별 객체·extruder·필라멘트 K 확장)와 `threemf.test.ts`, 층 모드 `build3mf` 출력 불변(HEAD 와 sha256 동일). 이번 재작업은 `colorRegions.ts`·그 테스트·샘플 스크립트에서 톤 단계/명도/adjust 를 걷어내는 것이다.
- Definition of Done (사전 상태 = 이전 실행 직후, 작성 시점 측정):
  1. `npm test` exit 0 — 사전: 83 passed (회귀 방어). 사후: 전부 통과(색 영역 테스트는 새 규칙으로 교체되어 개수가 달라질 수 있음).
  2. `npm run build` exit 0 — 사전: 통과 (회귀 방어).
  3. 층 모드 보존: 기존 `threemf.test.ts`·`heights.test.ts` 단언이 수정 없이 통과하고 `build3mf` 출력 8개 엔트리 sha256 이 HEAD 와 같다 — 사전: 동일(회귀 방어).
  4. 분류 테스트(`color.test.ts`) 10개가 수정 없이 통과 — 사전: 통과(회귀 방어).
  5. 색 영역 테스트(`colorRegions.test.ts`, 새 규칙): 3×1 이미지에서 색 인덱스 [분홍, 검정, 흰색] = [1,0,2], **모든 셀 높이가 같고 0.88**, `RegionParams` 에 `steps`·`adjust` 가 없으며 결과에 톤 단계가 없다, 투명 셀 마스크·높이 0, 파트 수 = 셀이 있는 색의 수, 각 파트 z 범위 [0, 0.88], 파트 부피 = 셀 수×셀 넓이×0.88 허용오차 1e-6, 모든 파트 부피 합 = 전체, K=1 은 파트 1개, `baseThickness` 를 바꾸면(예: 0.9 → 스냅 0.88, 1.2 → 1.2) 모든 파트 높이가 따라 바뀜 — 사전: 이전 규칙(톤 단계·명도 높이)의 테스트가 통과 중 → 새 규칙 기대값과 달라 forward check.
  6. 3MF 테스트: `build3mfParts` 관련 단언이 수정 없이 통과 — 사전: 통과(회귀 방어).
  7. `npm run sample -- regions` 가 `samples/sample-regions.3mf` 를 만들고 `unzip -l` 로 확인(검정 링·분홍 점·흰 배경, 팔레트 [검정, 흰색, 분홍], 높이 모두 0.88) — 사전: 샘플이 명도 높이로 만들어짐(forward check).
  8. 수동 슬라이서 확인(사용자, 자동화 불가): `samples/sample-regions.3mf` 를 Bambu Studio 에서 열어 파트 3개가 각각 필라멘트 1·2·3번(검정·흰색·분홍)으로 지정되어 보이는지, 평평한지, 슬라이스가 되는지 확인 — 사전: 없음. (다중 파트 3MF 는 원본에 참고가 없는 미검증 영역이며, 이 확인이 이 계획을 둘로 나눈 이유다.)

## Work slices
- [ ] S1. Lab 최근접 색 분류 — `src/core/color.ts`(`rgbToLab`, `parseHex`, `nearestColor`)는 이미 구현되어 있다. 이번에는 수정 없이 `color.test.ts` 가 계속 통과하는지만 확인한다. — completion criterion: DoD 4번 `color.test.ts` 10개가 수정 없이 통과한다.
- [ ] S2. 색 영역 파이프라인(평평한 높이) — `src/core/colorRegions.ts` 의 `processRegionImage` 에서 톤 단계·`adjust`·명도(L*) 계산·`RegionParams.steps/adjust` 를 제거하고, 색 인덱스와 마스크, 모든 셀 같은 높이(`snapToLayerGrid(baseThickness)`)만 반환하도록 바꾼다. `colorRegions.test.ts` 는 새 규칙으로 먼저 고쳐 실패를 확인한 뒤 구현한다. — completion criterion: DoD 5번 중 색 인덱스·같은 높이·마스크·`baseThickness` 반영 단언이 통과한다. (depends: S1)
- [ ] S3. 색별 파트 메시 — `buildRegionParts` 가 새 결과(평평한 높이)로 색마다 파트를 만든다(셀 없는 색은 파트 없음, K=1 은 파트 1개). — completion criterion: DoD 5번의 파트 수·z 범위·부피·부피 합·K=1 단언이 통과한다. (depends: S2)
- [ ] S4. 다중 파트 3MF — `build3mfParts` 는 이미 구현되어 있다. 이번에는 수정 없이 기존 단언이 통과하고 `build3mf` 출력이 HEAD 와 sha256 동일한지만 확인한다. — completion criterion: DoD 3·6번이 수정 없이 통과한다. (depends: S3)
- [ ] S5. 샘플 스크립트·수동 확인 — `scripts/sample.ts` 의 `regions` 분기에서 `steps`·`adjust`·명도 그라디언트(높이 단차용)를 제거하고 평평한 합성 이미지(검정 링, 분홍 점, 흰 배경)로 `samples/sample-regions.3mf` 를 만든다. 수동 슬라이서 확인 절차를 run 노트에 남긴다. — completion criterion: `npm run sample -- regions` 가 파일을 만들고 `unzip -l` 에 3MF 엔트리가 보이며 모든 파트 높이가 0.88 이고, 사용자가 Bambu Studio 확인 결과를 알려 준다(DoD 7·8번). (depends: S4)
