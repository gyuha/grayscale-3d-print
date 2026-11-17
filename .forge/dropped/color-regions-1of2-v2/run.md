# run — color-regions-1of2 (재실행: 평평한 높이로 재구현)

Run mode: 워크플로 없이 메인 세션에서 직접 구현. 사용자 요청("색상별 grayscale 과정을 잊고 다시 만들어 주세요")으로 이전 결과를 `failed` 로 기록하고 fix-and-re-run. 계획·ADR(Amendment)·CONTEXT 를 먼저 고친 뒤, TDD 로 `colorRegions.test.ts` 를 새 규칙으로 고쳐 실패(`adjust` 의 undefined 오류)를 확인하고 구현. 이전 실행 기록은 `.forge/dropped/color-regions-1of2-v1/` 에 보관.

## Per-slice results
- S1 Lab 최근접 색 분류 (`color.ts`) — ✅ as planned (수정 없음, `color.test.ts` 10개 그대로 통과)
- S2 색 영역 파이프라인 — ⚠ 톤 단계·`adjust`·명도(L*) 계산·`RegionParams.steps/adjust` 와 결과의 `stepIdx` 를 제거하고 모든 셀 같은 높이(`snapToLayerGrid(baseThickness)`)로 재구현 (이전 실행은 명도→톤 단계→높이였음)
- S3 색별 파트 메시 — ✅ as planned (새 결과로 파트를 만들며 모든 파트가 평평함: z 0→0.88)
- S4 다중 파트 3MF — ✅ as planned (수정 없음, 기존 단언 그대로 통과; 층 모드 `build3mf` 8개 엔트리 sha256 은 HEAD 와 동일)
- S5 샘플 스크립트 — ⚠ `regions` 분기에서 `steps`·`adjust`·명도 그라디언트(높이 단차 원인)를 제거; **수동 Bambu Studio 확인은 사용자 몫이라 아직 미완**

## Plan vs actual
- 색 분류 규칙(Lab 최근접)과 색별 파트 구조는 이전과 같다. 달라진 것은 높이뿐이다: 명도 톤 단계 → 평평한 높이.
- 남은 그레이스케일 흔적 확인(Measured): `colorRegions.ts`·`colorRegions.test.ts` 에서 `stepIdx|quantize|adjust|lightness|steps` 를 검색해 주석·부정 단언 외에 남은 것이 없음. 테스트가 `stepIdx`·`gray` 가 결과에 없고 `RegionParams` 에 `steps`/`adjust` 키가 없음을 단언한다.
- 샘플 (Measured): `sample-regions.3mf` 300×200 셀, 파트 3개(필라멘트 1 검정 4,884 셀 17,576 삼각형 / 2 흰색 53,472 셀 95,160 / 3 분홍 1,644 셀 6,016), 세 파트 모두 z 값이 {0, 0.88} 뿐(단차 없음), 파트별 extruder [1,2,3]. `object_1.model` 은 8.3MB.
- 코드 재사용·stash 는 이전과 같다: `stash@{1}`("ams-color-groups-1of2") 에서 가져온 `color.ts`·`threemf.ts` 는 그대로 쓰고, `stash@{0}`("layered-multi-color-wizard")는 쓰지 않았다.

## DoD baseline → after
1. `npm test`: 83 passed → 85 passed (회귀 방어 + 색 영역 테스트를 새 규칙으로 교체)
2. `npm run build`: 통과 → 통과 (회귀 방어)
3. 층 모드 보존: 기존 단언 수정 없이 통과(회귀 방어), `build3mf` 출력 8개 엔트리 sha256 → HEAD 와 동일 (LAYER-MODE-IDENTICAL)
4. 분류 테스트: `color.test.ts` 10개 → 수정 없이 통과 (회귀 방어, 이미 통과 상태)
5. 색 영역 테스트: 이전 규칙 테스트 통과 중 → 새 규칙 테스트 통과 (색 인덱스 [1,0,2], 모든 셀 높이 0.88, 톤 단계·gray 없음, `baseThickness` 0.9→0.88·1.2→1.2, 마스크, 파트 수·z [0,0.88]·부피·부피 합·K=1·셀 없는 색 파트 없음·높이 1.2)
6. 3MF 테스트: 통과 중 → 수정 없이 통과 (회귀 방어)
7. `npm run sample -- regions`: 명도 높이 샘플 → 평평한 샘플 (파트 3개, z {0, 0.88}, `unzip -l` 7 files). 인자 없이 `npm run sample` 은 이전과 같음 (6,012 삼각형)
8. 수동 슬라이서 확인: 없음 → **대기 중** (사용자가 `samples/sample-regions.3mf` 를 Bambu Studio 에서 확인)

## Failed attempts
- 1: 색 영역 코어가 명도로 톤 단계를 만들고 그 단계로 높이를 정했다(그레이스케일 과정). 사용자 의도와 달라 제거 요청 / 톤 단계·adjust·명도 높이를 걷어내고 모든 셀 같은 높이로 재구현
