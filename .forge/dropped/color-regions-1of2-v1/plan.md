<!-- forge-slug: color-regions-1of2 -->
<!-- task: 3 -->
<!-- part: 1/2 -->
<!-- tdd: on -->
# 색 영역 모드 코어: Lab 최근접 색 분류 · 명도 높이 · 색별 파트 · 다중 파트 3MF (1/2)

## Goal / Non-goals
- Goal: 컬러 이미지의 각 셀을 고른 필라멘트 색(1~4개) 중 Lab 거리가 가장 가까운 색으로 분류하고, 셀 높이를 명도로 정해(밝을수록 높음), 색마다 별도 파트(필라멘트 지정)로 만든 Bambu A1 다중 파트 3MF 를 출력하는 순수 코어 로직. UI 는 2/2. 이 파트의 끝에서 사용자가 작은 샘플 3MF 를 Bambu Studio 로 열어 구조를 확인한다(2/2 의 선행 확인).
- Non-goals: UI·3D 뷰어·미리보기(2/2) / 흑백 2색 층 모드 변경(그대로 유지) / 층 쌓기·색 교체(`tool_change`) 방식 / 채도 기준 분류 / 베이스 슬롯 / 반투명 혼합 / 슬롯별 소재·온도 / 작은 조각(섬) 정리 같은 후처리.

## Source of truth
- Glossary terms: Color region mode, Palette, Color region, Tone step, Layer mode in .forge/CONTEXT.md
- Related ADRs: .forge/adr/261117-154234-color-region-mode.md (이 작업의 결정), .forge/adr/261116-134329-two-filament-thickness-tone-bambu-3mf.md (층 모드 유지, 레이어 격자 스냅·3MF 출력 기반)
- 규칙(ADR 확정): 팔레트 = 슬롯 순서의 색 K개(1..4, `#rrggbb`), 슬롯 i 의 필라멘트 번호 = i+1. 셀 색 = 알파 가중 박스 평균 RGB(기존 `processImage` 와 같은 리샘플). 셀의 색 인덱스 = Lab(L*,a*,b*) 유클리드 거리가 최소인 팔레트 색(동점이면 낮은 슬롯). 톤 단계 = L*(0..100)×2.55 를 기존 `adjust`(밝기·대비·감마·반전)에 통과시켜 `quantize` 한 N단계(0=가장 어두움, N-1=가장 밝음, 층 모드와 같은 방향). 높이 = `snapToLayerGrid(baseThickness)` + k×m×layerHeight. 색 분류에는 `adjust` 를 적용하지 않는다(높이에만). 마스크(커버 0.5 미만, 둥근 모서리)는 `processImage` 와 같은 규칙. 색마다 파트 1개(그 색 셀의 높이맵, z 0→높이), 셀이 하나도 없는 색은 파트 없음. K=1 은 파트 1개(높이만).
- 재사용: `git stash list` 의 "ams-color-groups-1of2: color group mode core (discarded)" 항목에 `src/core/color.ts`(`rgbToLab`, `parseHex`), `colorGroups.ts`(알파 가중 리샘플·마스크·`buildMesh` 파트화), `threemf.ts` 의 `build3mfParts`(객체/컴포넌트/파트별 extruder/필라멘트 K 확장)와 테스트가 있다. 채도 기준 분류(`classifyGroup`)와 베이스 슬롯 로직은 쓰지 않는다. 층 모드 `build3mf` 의 출력은 바꾸지 않는다(HEAD 와 sha256 동일 유지).
- 3MF 필라멘트 확장 근거(Measured): 원본 `fourth+wing+ams.3mf`(필라멘트 3개)의 `project_settings.config` 에서 길이 3인 키 100개가 필라멘트별 배열이고 템플릿(`src/core/bambu-a1-project-settings.json`)은 그 100개를 길이 2로 줄인 것. 템플릿의 길이 2 키 중 나머지 20개는 `machine_max_*` 등 기계 모드 배열.
- 분류 근거(Measured, 이전 작업): 채도(a*b*)만 보면 검정·흰색이 구분되지 않고 연분홍(255,160,160)이 검정 그룹으로 갔다 — 그래서 명도를 포함한 3차원 Lab 거리를 쓴다.
- Definition of Done (사전 상태, 작성 시점 측정):
  1. `npm test` exit 0 — 사전: 56 passed (회귀 방어). 사후: 새 테스트 포함 전부 통과.
  2. `npm run build` exit 0 — 사전: 통과 (회귀 방어).
  3. 층 모드 보존: 기존 `threemf.test.ts`·`heights.test.ts` 단언이 수정 없이 통과하고, `build3mf` 출력 8개 엔트리 sha256 이 HEAD 와 같다(git worktree 비교) — 사전: 동일(회귀 방어).
  4. 분류 테스트(`color.test.ts`): Lab 기준값(흰색 L≈100·a≈0·b≈0, 빨강 ≈ (53.2, 80.1, 67.2)); 팔레트 [검정, 분홍 #f0a8b4, 흰색] 에서 검정(0,0,0)→검정, 분홍(240,168,180)→분홍, 흰색→흰색, 옅은 분홍(250,215,220)→분홍 또는 흰색 중 Lab 거리가 작은 쪽(테스트가 거리로 기대값을 계산해 단언), 중간 회색(128,128,128)→검정/흰색 중 Lab 거리가 작은 쪽; 동점이면 낮은 슬롯 — 사전: 파일 없음(forward check).
  5. 파이프라인·파트 테스트(`colorRegions.test.ts`): 3×1 이미지에서 색 인덱스·톤 단계 기대값, 높이 = 0.88 + k×0.08, 밝을수록 높음, `adjust` 의 invert 가 높이에만 적용되고 색 인덱스는 그대로, 투명 셀 마스크, 파트 수 = 셀이 있는 색의 수, 각 파트 z 범위 [0, 최대 높이], 파트 부피 = Σ(셀 넓이×높이) 허용오차 1e-6, 모든 파트의 부피 합 = 전체 Σ(셀 넓이×높이), 파트 간 셀 중복 없음, K=1 은 파트 1개 — 사전: 파일 없음.
  6. 3MF 테스트(`threemf.test.ts` 확장): 다중 파트 3MF 의 `object_1.model` 에 파트 수만큼 `<object>`, root 컴포넌트 수 일치, `model_settings.config` 의 각 `<part>` 에 `extruder` = 슬롯 번호, 필라멘트별 100개 키 길이 K, `filament_colour` = 팔레트(대문자), `filament_maps` K개, `custom_gcode_per_layer.xml` 없음, 파트 xy 중심 공유 — 사전: 없음.
  7. `npm run sample -- regions` 가 `samples/sample-regions.3mf` 를 만들고 `unzip -l` 로 확인(합성 컬러 이미지: 검정 링·분홍 원·흰 배경, 팔레트 [검정, 흰색, 분홍]) — 사전: 인자 없음(forward check).
  8. 수동 슬라이서 확인(사용자, 자동화 불가): `samples/sample-regions.3mf` 를 Bambu Studio 에서 열어 파트 3개가 각각 필라멘트 1·2·3번(검정·흰색·분홍)으로 지정되어 보이는지, 슬라이스가 되는지 확인 — 사전: 없음. (다중 파트 3MF 는 원본에 참고가 없는 미검증 영역이며, 이 확인이 이 계획을 둘로 나눈 이유다 — ADR Consequences 참조.)

## Work slices
- [ ] S1. Lab 최근접 색 분류 — stash 의 `src/core/color.ts` 에서 `rgbToLab`·`parseHex` 를 가져오고, `nearestColor(r, g, b, palette)`(Lab 유클리드 최소, 동점은 낮은 번호)를 추가한다(채도 기준 `classifyGroup` 은 가져오지 않는다). — completion criterion: DoD 4번 `color.test.ts` 단언이 모두 통과한다.
- [ ] S2. 색 영역 파이프라인 — `src/core/colorRegions.ts` 에 `processRegionImage(rgba, w, h, params)` 를 추가한다: stash 의 `colorGroups.ts` 의 알파 가중 리샘플·마스크 코드를 재사용해 셀 색 → `nearestColor` → 톤 단계(L*→`adjust`→`quantize`) → 높이(스냅된 베이스 + k×m×layerHeight)를 만든다. — completion criterion: DoD 5번 중 색 인덱스·단계·높이·마스크·invert 단언이 통과한다. (depends: S1)
- [ ] S3. 색별 파트 메시 — 같은 파일에 `buildRegionParts(result, params)` 를 추가해 색마다 그 색 셀의 높이맵을 `buildMesh` 로 파트화한다(셀이 없는 색은 파트 없음, K=1 은 파트 1개). — completion criterion: DoD 5번의 파트 수·z 범위·부피·중복 없음 단언이 통과한다. (depends: S2)
- [ ] S4. 다중 파트 3MF — stash 의 `threemf.ts` 에서 `build3mfParts`(파트별 `<object>`·컴포넌트·`<part extruder>`·`projectSettings(p, colors)` 의 필라멘트 K 확장)를 가져온다. 층 모드 `build3mf` 의 외부 동작은 바꾸지 않는다. — completion criterion: DoD 6번 단언이 통과하고 기존 층 모드 단언이 수정 없이 통과하며 `build3mf` 출력이 HEAD 와 sha256 동일하다(DoD 3번). (depends: S3)
- [ ] S5. 샘플 스크립트·수동 확인 — `scripts/sample.ts` 에 `regions` 인자를 추가해 합성 컬러 이미지(검정 링, 분홍 원, 흰 배경 + 약한 명도 그라디언트)로 `samples/sample-regions.3mf` 를 만들고 색별 셀 수·파트 수·슬롯 매핑을 출력한다. 수동 슬라이서 확인 절차를 run 노트에 남긴다. — completion criterion: `npm run sample -- regions` 가 파일을 만들고 `unzip -l` 에 3MF 엔트리가 보이며, 사용자가 Bambu Studio 확인 결과를 알려 준다(DoD 7·8번). (depends: S4)
