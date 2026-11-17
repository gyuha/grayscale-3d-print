# run — ams-four-color-support

Run mode: 워크플로 없이 메인 세션에서 직접 구현 (S1→S2→S3→{S4,S5}→S6 이 거의 직렬이고 App.tsx 하나를 공유하므로). TDD: S1·S2·S3 는 테스트를 먼저 쓰고 실패(`toneColorIndex is not a function` 등)를 확인한 뒤 구현.

## Per-slice results
- S1 `toneColorIndex` / `toolChanges` (heights.ts) — ✅ as planned (K=2/K=4/m=2/N<K 테스트, `toolChangeTopZ` 대체)
- S2 3MF K개 필라멘트 — ⚠ `build3mf` 옵션 `steps`·`colors` 를 필수로 만들어 기존 테스트 호출부 2곳과 App/sample 호출부를 함께 수정. K=2 단언은 그대로 통과
- S3 UI 상태 (`defaultColors`/`minSteps`/`stepColors`/`summarize`) — ⚠ `summarize` 반환 형태가 `colorChangeZ`/`firstWhiteLayerZ` 단일값에서 `colorChangeZs`/`markerZs` 배열로 바뀌어 기존 `model.test.ts` 단언 2건 갱신
- S4 UI 패널 (색 개수 select, 슬롯별 color picker, 스와치, 정보 패널, 다운로드) — ✅ as planned (+ 라벨 "단계당 흰 레이어 m" → "단계당 레이어 m": 4색에서 "흰"이 틀려져서)
- S5 3D 뷰어 다중 임계값 셰이더 — ✅ as planned (uniform 배열 `uThresholds[3]`/`uColors[4]`, 미사용 슬롯은 1e9)
- S6 `npm run sample -- <K>` — ✅ as planned; **수동 Bambu Studio 확인은 사용자 몫이라 아직 미완**

## Plan vs actual
- 필라멘트별 배열 키 판별: 템플릿 길이 2 배열 중 `machine_max_*` 등 20개(`NON_FILAMENT_KEYS`)를 제외한 100개를 K개로 확장 (Measured: 테스트가 정확히 100개·길이 4 단언). 새 슬롯은 필라멘트 1번 값을 복사. `filament_colour`/`filament_multi_colour`=선택 색(대문자 정규화), `filament_self_index`=1..K, flush matrix K×K(템플릿 쌍은 원값, 그 외 비대각 652), vector 2K, `different_settings_to_system` K+2.
- 색 개수를 바꾸면 그 개수의 기본 색으로 초기화(사용자가 고른 색은 유지하지 않음), 단계 수는 K 미만이면 K로 올림.
- 3D 뷰어 밝기: 이전 검정 0.06 / 흰색 0.95 범위를 `c*0.89+0.06`으로 보존 (K=2 외형 유지).

## DoD baseline → after
1. `npm test`: 56 passed → 72 passed (회귀 방어 + 새 테스트 16개)
2. `npm run build`: 통과 → 통과 (회귀 방어)
3. K=2 출력 보존: 기존 `threemf.test.ts` 의 `top_z 0.96`/`extruder 2`/`#FFFFFF`/`filament_colour` 단언 → 변경 후에도 통과 (회귀 방어, 이미 통과 상태였음). 브라우저 K=2 기본 화면도 0.88/마커 0.96, 삼각형 6,012 로 동일
4. K=4 단위 테스트: 없음 → 통과 (top_z [0.96,1.12,1.28], extruder [2,3,4], 색 인덱스 [0,1,1,2,2,3,3], 100개 키 길이 4, flush 16/8, diff 6, filament_maps "1 1 1 1")
5. `npm run sample -- 4`: 인자 없음 → `samples/sample.3mf` 생성, `unzip -l` 8 files, `top_z` 0.96→2, 1.12→3, 1.28→4. 인자 없이 실행하면 K=2 (0.96→2)
6. 브라우저 UAT(agent-browser, Measured): 4색 선택 → N 최솟값 4, 정보 패널 "0.88 / 1.04 / 1.2 mm (마커 0.96 / 1.12 / 1.28 mm)", 슬롯 색 임의 지정 시 3D 뷰어가 높이 구간별 선택 색(빨강/초록/파랑)으로 표시, K=2·N=2 에서 K=4 로 바꾸면 N=4 로 보정, 3MF 다운로드 49,973 bytes `model/3mf` 생성
7. 수동 슬라이서 확인: 없음 → **대기 중** (사용자가 `samples/sample.3mf`(4색)를 Bambu Studio 에서 확인)
