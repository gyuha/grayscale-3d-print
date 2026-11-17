# run — color-regions-1of2

Run mode: 워크플로 없이 메인 세션에서 직접 구현 (S1→S2→S3→S4→S5 가 직렬 의존). TDD: 각 슬라이스의 테스트를 먼저 쓰고 실패(`Cannot find module './color'`, `'./colorRegions'`, 6개 실패)를 확인한 뒤 구현.

## Per-slice results
- S1 Lab 최근접 색 분류 (`src/core/color.ts`: `rgbToLab`, `parseHex`, `nearestColor`) — ✅ as planned (10 tests; `rgbToLab`·`parseHex` 는 보관된 코드 재사용, 채도 기준 `classifyGroup` 은 가져오지 않음)
- S2 색 영역 파이프라인 (`processRegionImage`) — ✅ as planned (알파 가중 리샘플·마스크 재사용, 높이는 기존 `heightMap`)
- S3 색별 파트 메시 (`buildRegionParts`) — ✅ as planned (파트 수, z 범위 [0, 높이], 부피 = Σ 셀 넓이×높이, 파트 부피 합 = 전체, 셀 없는 색은 파트 없음, K=1 은 파트 1개)
- S4 다중 파트 3MF (`build3mfParts`) — ✅ as planned (보관된 `threemf.ts` 를 그대로 가져와 K=3 팔레트 테스트 추가; 층 모드 `build3mf` 출력은 HEAD 와 8개 엔트리 sha256 전부 동일함을 직접 비교)
- S5 샘플 스크립트 `npm run sample -- regions` — ✅ as planned; **수동 Bambu Studio 확인은 사용자 몫이라 아직 미완**

## Plan vs actual
- 테스트 기대값 수정 1건(구현 변경 아님): 분홍(240,168,180)의 L* 를 손계산으로 75 안팎으로 잡고 N=4 에서 단계 2 를 기대했으나, 실제 측정값 L* = 75.96 → 0..255 환산 193.7 → N=4 에서는 흰색과 같은 단계 3 이 된다 (Measured, `/tmp/probe2.ts`). 분홍과 흰색이 다른 단계로 갈리는 N=7 로 테스트를 고쳤다 (분홍 5, 검정 0, 흰색 6).
- 색 분류는 원본 색으로, `adjust`(밝기·대비·감마·반전)는 높이(톤 단계)에만 적용된다. invert 테스트로 색 영역은 그대로이고 단계만 뒤집힘을 고정했다.
- 샘플 크기 (Measured): `sample-regions.3mf` 의 `object_1.model` 이 8.4MB (파트 3개: 흰 배경 96,912 / 검정 18,806 / 분홍 6,388 삼각형). 배경에 위에서 아래로 약한 명도 그라디언트를 넣어 높이 단계가 여러 개라서 크다. Bambu Studio 에서 열리는 속도가 느리면 이 때문일 수 있다.
- 보관된 코드 재사용: `stash@{1}`("ams-color-groups-1of2") 의 `color.ts` 일부와 `threemf.ts`·`threemf.test.ts` 를 가져왔다. `stash@{0}`("layered-multi-color-wizard")는 쓰지 않았다. 두 stash 모두 아직 남아 있다.

## DoD baseline → after
1. `npm test`: 56 passed → 83 passed (회귀 방어 + 새 테스트 27개)
2. `npm run build`: 통과 → 통과 (회귀 방어)
3. 층 모드 보존: 기존 `threemf.test.ts`·`heights.test.ts` 단언 수정 없이 통과(이미 통과 상태, 회귀 방어), `build3mf` 출력 8개 엔트리 sha256 → HEAD 와 동일(IDENTICAL)
4. 분류 테스트: 파일 없음 → `color.test.ts` 10개 통과 (Lab 기준값, 정확한 팔레트 색 → 자기 자신, 검정/흰색 구분, 분홍 볼 → 분홍, 옅은 분홍·회색은 Lab 거리가 작은 쪽, 동점은 낮은 슬롯, 색 1개)
5. 파이프라인·파트 테스트: 파일 없음 → `colorRegions.test.ts` 9개 통과
6. 3MF 테스트: 없음 → `threemf.test.ts` 확장 통과 (파트별 extruder [1,2,3], 필라멘트 3개·100개 키·flush 9/6·`filament_maps` "1 1 1", custom_gcode 없음, 필라멘트 1개 파트 가능, 4색 파트 구조)
7. `npm run sample -- regions`: 인자 없음 → `samples/sample-regions.3mf` 생성, 300×200 셀, 파트 3개 (필라멘트 1 검정 4,884 셀 / 2 흰색 53,420 셀 / 3 분홍 1,696 셀), `unzip -l` 7 files. 인자 없이 `npm run sample` 은 이전과 같이 `sample.3mf` (6,012 삼각형)
8. 수동 슬라이서 확인: 없음 → **대기 중** (사용자가 `samples/sample-regions.3mf` 를 Bambu Studio 에서 확인)
