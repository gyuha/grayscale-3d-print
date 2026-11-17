# run — ams-color-groups-1of2

Run mode: 워크플로 없이 메인 세션에서 직접 구현 (S1→S2→S3→S4→S5 가 직렬 의존). TDD: 각 슬라이스의 테스트를 먼저 쓰고 실패(`Cannot find module './color'`, `'./colorGroups'`, `build3mfParts is not a function`)를 확인한 뒤 구현.

## Per-slice results
- S1 Lab 색도 분류 (`src/core/color.ts`: `rgbToLab`, `classifyGroup`, `parseHex`) — ✅ as planned (9 tests)
- S2 컬러 이미지 파이프라인 (`processColorImage`, `groupSlotsOf`) — ⚠ 계획한 분류 규칙(Lab 색도 거리)은 그대로 구현했지만, 중립 슬롯(검정)이 있으면 채도가 낮은 색(연분홍·살색·어두운 빨강)이 검정 그룹으로 가는 성질이 측정됨 (아래 Plan vs actual)
- S3 파트 메시 (`buildGroupParts`) — ✅ as planned (베이스 z 0→0.88, 그룹 파트 z [0.88, 0.88+k·m·0.08], 부피 = 셀 넓이×두께 합 모두 1e-6 이내, 단계 0 셀은 파트 없음)
- S4 다중 파트 3MF (`build3mfParts`) — ✅ as planned (+ `build3mf` 내부를 파트 수·필라멘트 수를 받도록 일반화; 층 모드 출력은 HEAD 와 8개 엔트리 sha256 전부 동일함을 직접 비교)
- S5 샘플 스크립트 (`npm run sample -- groups`) — ✅ as planned; **수동 Bambu Studio 확인은 사용자 몫이라 아직 미완**

## Plan vs actual
- **분류 규칙의 한계 (Measured, `/tmp/probe.ts`)**: 슬롯 [검정, 빨강, 파랑] 에서 연분홍(255,160,160) chroma 38 → 검정 그룹, 살색(224,172,140) chroma 28 → 검정 그룹, 어두운 빨강(64,0,0) chroma 33 → 검정 그룹, 어두운 빨강(120,10,10) chroma 55 → 빨강, 파스텔 빨강(255,100,100) chroma 67 → 빨강. 즉 슬롯 색 chroma 의 약 절반 미만인 색은 중립 슬롯으로 간다. 사진의 피부색·파스텔은 흰 바탕 위 얇은 검정(연한 회색)으로 출력된다. ADR 의 "무채색은 색도가 가장 낮은 슬롯" 의 귀결이며 규칙은 바꾸지 않았다(`colorGroups.test.ts` 의 "classification limit" 테스트로 고정). 개선안(채도 정규화 또는 중립 슬롯 임계값)은 사용자 결정 사항.
- 이 규칙에서 계획 DoD 4번의 "어두운 빨강(#400000)은 빨강 그룹" 은 중립 슬롯이 **없을 때**(슬롯 [빨강·초록·파랑])만 성립 — `color.test.ts` 는 그 조건으로 통과. 중립 슬롯이 있는 `colorGroups.test.ts` 의 샘플 픽셀은 규칙상 빨강으로 가는 (200,40,40), (120,10,10) 으로 정했다.
- 3MF: 다중 파트는 하나의 `object_1.model` 안에 파트 수만큼 `<object>` 를 두고 root 의 wrapper object(id = 파트 수 + 1) 가 `<components>` 로 참조. 파트 xy 중심은 `parts[0]`(베이스 판) 기준으로 공유. `custom_gcode_per_layer.xml` 은 넣지 않았다 — 이 구조가 Bambu Studio 에서 의도대로 열리는지는 미검증(수동 확인 대기).
- `build3mf`(층 모드)의 `projectSettings` 는 `LAYER_MODE_COLORS`(검정/흰색)로 `projectSettings(p, colors)` 를 호출하도록 바뀌었다 (출력은 동일).
- 재사용: 폐기한 K색 층 구현의 `NON_FILAMENT_KEYS`/필라멘트 배열 확장 코드를 stash 기억에서 그대로 가져옴 (stash@{0} 는 아직 남아 있음).

## DoD baseline → after
1. `npm test`: 56 passed → 81 passed (회귀 방어 + 새 테스트 25개)
2. `npm run build`: 통과 → 통과 (회귀 방어)
3. 층 모드 보존: 기존 `threemf.test.ts`·`heights.test.ts` 단언 수정 없이 통과(이미 통과 상태, 회귀 방어). 추가로 `build3mf` 출력 8개 엔트리를 HEAD 와 sha256 비교 → 전부 동일
4. 분류 단위 테스트: 파일 없음 → `color.test.ts` 9개 통과 (Lab 기준값, [R,G,B] 슬롯 분류, 어두운 빨강/연분홍, 회색→검정, 동점)
5. 파이프라인·파트 테스트: 파일 없음 → `colorGroups.test.ts` 통과 (그룹·단계, 베이스 슬롯 변경, invert, 투명 마스크, 파트 z·부피, 단계 0 부재, m=2)
6. 3MF 파트 테스트: 없음 → `threemf.test.ts` 확장 통과 (객체·컴포넌트 수, 파트별 extruder [1,3,4], 필라멘트 4개·100개 키, 대문자 색, custom_gcode 없음, face_count 합)
7. `npm run sample -- groups`: 인자 없음 → `samples/sample-groups.3mf` 생성, 300×200 셀, 파트 4개(슬롯 1: 4000, 슬롯 2: 9636, 슬롯 3: 3118, 슬롯 4: 3086 삼각형), `unzip -l` 7 files. 인자 없이 `npm run sample` 은 이전과 같이 `sample.3mf` (top_z 0.96)
8. 수동 슬라이서 확인: 없음 → **대기 중** (사용자가 `samples/sample-groups.3mf` 를 Bambu Studio 에서 확인)
