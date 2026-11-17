<!-- forge-slug: ams-color-groups-1of2 -->
<!-- task: 3 -->
<!-- part: 1/2 -->
<!-- tdd: on -->
# 컬러 그룹 모드 코어: 색 분류 · 그룹별 두께 파트 · 다중 파트 3MF (1/2)

## Goal / Non-goals
- Goal: 컬러 이미지를 AMS 슬롯 색 그룹으로 분류(Lab 색도 거리)하고, 그룹 안에서 명도를 흰 베이스 위 두께(밝을수록 얇고 단계 0은 베이스만, 단계 k는 k×m 레이어)로 만들어, 베이스 판 + 그룹별 파트를 필라멘트 슬롯이 지정된 Bambu A1 3MF로 출력하는 순수 코어 로직. UI는 다음 파트(2/2).
- Non-goals: UI·3D 뷰어·2D 미리보기(2/2) / 흑백 2색 층 모드 변경(그대로 유지) / 3·4색 층 방식 / 그룹 4개(베이스가 슬롯 1개를 차지하므로 색 그룹은 3개) / 반투명 시뮬레이션 / 슬롯별 소재·온도 설정.

## Source of truth
- Glossary terms: Layer mode, Color group mode, Base slot, Color group, Tone step in .forge/CONTEXT.md
- Related ADRs: .forge/adr/261117-150705-color-group-mode.md (이 작업의 결정), .forge/adr/261116-134329-two-filament-thickness-tone-bambu-3mf.md (층 모드, 유지), .forge/adr/261117-143215-multi-color-height-bands.md (superseded — 참고만)
- 규칙(ADR 확정): 베이스 슬롯 1개 + 색 그룹 슬롯 3개(슬롯 4개 중 베이스 슬롯은 사용자가 고르며 기본 슬롯 1=흰색). 픽셀의 그룹 = 픽셀 Lab 색도(a*,b*)와 각 그룹 슬롯 색의 색도 사이 거리가 최소인 슬롯(동점이면 낮은 슬롯 번호). 명도 L*(0..100)을 0..255로 환산해 기존 `adjust`(밝기·대비·감마·반전)를 거친 뒤 어두움 = 255-값을 `quantize`로 N단계(0=가장 밝음). 두께 = 단계 k 이면 k×m×layerHeight, 단계 0 은 그룹 파트 없음. 베이스 판은 마스크된 전체 영역, 두께 = 층 모드와 같은 `snapToLayerGrid(baseThickness)`. 그룹 파트는 베이스 윗면(z = 스냅된 베이스 높이)에서 시작.
- 재사용: 보관된 stash(`git stash list`의 "ams-four-color-support" 항목)의 `src/core/threemf.ts` 에서 필라멘트 배열 K 확장 코드(`NON_FILAMENT_KEYS`, `projectSettings(p, colors)`: 필라멘트별 100개 키를 K개로, `filament_colour`·`filament_multi_colour`·`filament_self_index`·flush matrix K×K·vector 2K·`different_settings_to_system` K+2)만 가져온다. 층 모드 `build3mf` 의 외부 동작은 바꾸지 않는다(K=2).
- Definition of Done (사전 상태 기록):
  1. `npm test` exit 0 — 사전: 56 passed (회귀 방어, 층 모드 보존 확인용). 사후: 새 테스트 포함 전부 통과.
  2. `npm run build` exit 0 — 사전: 통과 (회귀 방어).
  3. 층 모드 보존: 기존 `threemf.test.ts`·`heights.test.ts` 단언이 수정 없이 통과 — 사전: 통과 중 (회귀 방어).
  4. 분류 단위 테스트(`color.test.ts`): sRGB→Lab 기준값(흰색 L≈100·a≈0·b≈0, 빨강 ≈ (53.2, 80.1, 67.2)), 슬롯 [빨강·초록·파랑]에서 순수 빨강과 어두운 빨강(#400000)이 모두 빨강 그룹, 슬롯 [검정·빨강·파랑]에서 회색 픽셀이 검정 그룹, 동점이면 낮은 슬롯 — 사전: 파일 없음(forward check).
  5. 파이프라인·파트 테스트(`colorGroups.test.ts`): 작은 이미지에서 그룹·단계가 기대값, 단계 0 셀은 어느 그룹 파트에도 없음, 베이스 윗면 z = 0.88, 그룹 파트 z 범위 = [0.88, 0.88 + k×m×0.08], 각 파트의 부호 있는 부피 = 셀 넓이 × 두께의 합(허용오차 1e-6) — 사전: 파일 없음.
  6. 3MF 테스트(`threemf.test.ts` 확장): 다중 파트 3MF 의 `object_1.model`에 파트 수만큼 `<object>`, `model_settings.config` 의 각 `<part>` 에 `extruder` = 해당 슬롯 번호, 필라멘트별 100개 키 길이 4, `filament_colour` = 슬롯 색, `custom_gcode_per_layer.xml` 없음 — 사전: 없음.
  7. `npm run sample -- groups` 가 `samples/sample-groups.3mf` 를 만들고 `unzip -l` 로 확인 — 사전: 인자 없음(forward check).
  8. 수동 슬라이서 확인(사용자, 자동화 불가): `samples/sample-groups.3mf` 를 Bambu Studio 에서 열어 파트가 의도한 필라멘트(슬롯)로 지정되고 필라멘트 4개가 보이는지, 슬라이스가 되는지 확인 — 사전: 없음. (다중 파트 3MF 는 원본에 참고가 없는 미검증 영역 — ADR Consequences 참조.)

## Work slices
- [ ] S1. Lab 색도 분류 — `src/core/color.ts` 에 `rgbToLab`, `classifyGroup(rgb, slotColors)`(색도 거리 최소, 동점은 낮은 번호) 추가. — completion criterion: DoD 4번의 `color.test.ts` 단언이 모두 통과한다.
- [ ] S2. 컬러 이미지 파이프라인 — `src/core/colorGroups.ts` 에 `processColorImage(rgba, w, h, params)` 를 추가한다: 알파 가중 RGB 박스 평균 리샘플(기존 `resampleGray` 를 채널별로 재사용) → 셀별 그룹 분류 → L*→0..255 → `adjust` → 어두움 → `quantize`. 투명·마스크 처리는 `processImage` 와 같은 규칙(커버 0.5 미만 셀 제외, 둥근 모서리 마스크). — completion criterion: DoD 5번 중 그룹·단계 기대값 단언이 통과한다. (depends: S1)
- [ ] S3. 파트 메시 — 같은 파일에 `buildGroupParts(result, params)` 를 추가해 베이스 판(마스크 전체, `snapToLayerGrid(baseThickness)` 두께)과 그룹별 두께 맵 파트(기존 `buildMesh` 사용 후 z 를 베이스 높이만큼 이동; 두께 0 인 그룹은 파트 없음)를 `{slot, mesh}[]` 로 반환한다. — completion criterion: DoD 5번의 z 범위·부피·단계 0 부재 단언이 통과한다. (depends: S2)
- [ ] S4. 다중 파트 3MF — `threemf.ts` 에 `build3mfParts(parts, opts)` 를 추가한다: 파트마다 `<object>` 와 root `<components>`·`model_settings` 의 `<part>`(extruder 지정), `projectSettings(p, colors)` 는 보관된 stash 의 필라멘트 배열 확장 코드를 재사용하고, 색 교체용 `custom_gcode_per_layer.xml` 은 넣지 않는다. 층 모드 `build3mf` 의 출력은 바꾸지 않는다. — completion criterion: DoD 6번 단언이 통과하고, 기존 `threemf.test.ts` 층 모드 단언이 수정 없이 통과한다. (depends: S3)
- [ ] S5. 샘플 스크립트·수동 확인 — `scripts/sample.ts` 에 `groups` 인자를 추가해 합성 컬러 이미지(색상 그라디언트 + 명도 그라디언트)로 `samples/sample-groups.3mf` 를 만들고 그룹별 셀 수·파트 수·슬롯 매핑을 출력한다. 수동 슬라이서 확인 절차를 run 노트에 남긴다. — completion criterion: `npm run sample -- groups` 가 파일을 만들고 `unzip -l` 에 3MF 엔트리가 보이며, 사용자가 Bambu Studio 확인 결과를 알려 준다(DoD 7·8번). (depends: S4)
