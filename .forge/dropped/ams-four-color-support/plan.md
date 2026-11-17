<!-- forge-slug: ams-four-color-support -->
<!-- task: 3 -->
<!-- tdd: on -->
# AMS 2~4색 출력 지원: 높이 구간별 색 교체 일반화

## Goal / Non-goals
- Goal: 지금의 검정·흰색 2색(색 교체 1회) 구조를 K색(2~4, 기본 2)·K-1회 색 교체로 확장한다. 사용자가 슬롯별 색을 고르면 Bambu A1 3MF가 K개 필라멘트와 K-1개 `tool_change`를 담고, 3D 미리보기·스와치·정보 패널이 선택한 색과 여러 색 교체 높이를 보여 준다. K=2는 현재 출력과 같다.
- Non-goals: 반투명 적층 혼합(HueForge식) / 색 구간 경계를 사용자가 직접 조절하는 UI(자동 규칙만) / 슬롯별 소재·온도 설정(전 슬롯 템플릿 필라멘트 공통) / 2D 톤 미리보기 컬러화(회색 유지) / 실제 출력 색 시뮬레이션 / K>4.

## Source of truth
- Glossary terms: Base, Color change height, Color band, White layer in .forge/CONTEXT.md
- Related ADRs: .forge/adr/261117-143215-multi-color-height-bands.md (이 작업의 결정), .forge/adr/261116-134329-two-filament-thickness-tone-bambu-3mf.md (부분 대체됨: 2색 고정만; 두께 기반 톤·레이어 스냅·3MF 출력은 유효)
- 색 구간 규칙(ADR 확정): 톤 단계 k(0..N-1)의 색 인덱스 = k==0 ? 0 : 1 + floor((k-1)(K-1)/(N-1)). N≥K 필수. 색 c(≥1)의 `tool_change top_z` = (그 색이 맡는 첫 단계 s_c 의 바로 아래 단계 s_c-1 의 높이) + 1레이어. 예(기본 레이어, m=1, N=7): K=2 → [0.96], K=4 → [0.96, 1.12, 1.28] (색2: 단계 1-2, 색3: 3-4, 색4: 5-6).
- 3MF 필라멘트 확장 근거(Measured): 원본 `fourth+wing+ams.3mf`(필라멘트 3개)의 `project_settings.config`에서 길이 3인 키 100개가 필라멘트별 배열이고, 템플릿(`src/core/bambu-a1-project-settings.json`)은 그 100개를 길이 2로 줄인 것이다. 템플릿의 길이 2 키 120개 중 나머지 20개는 `machine_max_*` 등 필라멘트 수와 무관한 기계 모드 배열이다. `flush_volumes_matrix`=K², `flush_volumes_vector`=2K, `different_settings_to_system`=K+2 (Measured: 원본 K=3은 9/6/5, 템플릿 K=2는 4/4/4 — 각각 K², 2K, K+2와 일치. S2에서 K=4의 diff 항목 내용은 원본을 다시 읽어 확정).
- 이 DoD의 "색 교체·색 필라멘트가 걸린 모든 사이트" 파인더(작성 시점 실행 결과): `git grep -nE "toolChangeTopZ|colorChangeZ|firstWhiteLayerZ|filament_colour|filament_maps" -- src scripts`
  - src/core/threemf.ts (toolChangeTopZ 정의, filament_maps, filament_colour, customGcode) · src/core/heights.ts (stepHeights 공유) · src/ui/model.ts (summarize) · src/ui/Viewer.tsx (colorChangeZ, 임계값 1개) · src/App.tsx (정보 패널·Viewer 호출·스와치) · scripts/sample.ts (toolChangeTopZ) · src/core/bambu-a1-project-settings.json (템플릿 배열)
  - 위 목록 밖의 사이트가 파인더 재실행(승격 시점)에서 나오면 그 사이트도 DoD에 포함한다.
- Definition of Done (명령으로 확인 가능, 작성 시점 사전 상태 함께 기록):
  1. `npm test` exit 0 — 사전: 56 passed (회귀 방어, 이미 통과: 기존 2색 동작 보존 확인용). 사후: 새 테스트 포함 전부 통과.
  2. `npm run build` exit 0 — 사전: 통과 (회귀 방어).
  3. K=2 출력 보존: 새 테스트가 `build3mf`의 K=2 결과에서 `custom_gcode_per_layer.xml`의 `top_z="0.96"`·`extruder="2"`·`#FFFFFF`와 `filament_colour`=["#000000","#FFFFFF"]를 단언 — 사전: 없음(기존 threemf.test.ts에 같은 단언이 있어 통과 중, 변경 후에도 통과해야 함).
  4. K=4 단위 테스트: 기본 레이어(m=1,N=7)에서 색 교체 `top_z`가 [0.96, 1.12, 1.28], extruder가 [2,3,4], 단계→색 인덱스가 [0,1,1,2,2,3,3]이고, 3MF의 `filament_colour`가 선택 색 4개, 필라멘트별 100개 키의 배열 길이가 모두 4, `flush_volumes_matrix` 길이 16, `flush_volumes_vector` 길이 8 — 사전: 없음(forward check, 실패/부재).
  5. 3MF K=3·K=4에서 `npm run sample`(색 개수 인자)이 8개 엔트리 3MF를 생성하고 `unzip -l`로 확인 — 사전: 색 개수 인자 없음.
  6. 브라우저 UAT(agent-browser): 4색 선택 → 컬러 피커로 색 지정 → 3D 뷰어가 높이 구간별 선택 색으로 칠해짐, 정보 패널에 색 교체 높이 3개 표시, N을 K 미만으로 내릴 수 없음, 3MF 다운로드 성공 — 사전: 없음.
  7. 수동 슬라이서 확인(사용자, 자동화 불가): 4색 3MF를 Bambu Studio에서 열어 필라멘트 4개·색 교체 3개가 의도한 레이어에 걸리는지 확인 — 사전: 없음. (이전 작업 회고: 슬라이서 마커 높이는 수동 확인을 DoD에 포함해야 한다.)

## Work slices
- [ ] S1. 코어: 단계→색 인덱스와 색 교체 목록 — `heights.ts`에 `toneColorIndex(k, steps, colors)`와 `toolChanges(steps, colors, layers)`(→ `{topZ, extruder}[]`)를 추가하고 `threemf.ts`의 `toolChangeTopZ`를 이 일반화로 대체한다. N<K는 RangeError. — completion criterion: 새 `heights.test.ts` 단언(K=2,N=7 → topZ [0.96], 색 인덱스 [0,1,1,1,1,1,1]; K=4,N=7 → topZ [0.96,1.12,1.28], 인덱스 [0,1,1,2,2,3,3]; m=2에서도 첫 단계 아래 높이+1레이어; N<K → RangeError)이 통과한다.
- [ ] S2. 3MF: K개 필라멘트 — `threemf.ts`의 `build3mf`가 `colors: string[]`(2..4)를 받아 필라멘트별 100개 키 배열을 K로 확장(새 슬롯은 템플릿 필라멘트 1번 값을 복사)하고, `filament_colour`·`default_filament_colour`를 선택 색으로, `flush_volumes_matrix`를 K×K(대각 0, 나머지 템플릿 비대각 값 중 하나 복제), `flush_volumes_vector`를 2K, `different_settings_to_system`를 K+2, `model_settings`의 `filament_maps`를 K개의 "1"로 만들고 `custom_gcode_per_layer.xml`에 S1의 교체 목록을 `extruder`·`color`와 함께 출력한다. 구현 전에 원본 3MF의 K=3 값(flush 9/6, diff 5)을 다시 읽어 길이 규칙을 확정한다. — completion criterion: K=2는 기존 `threemf.test.ts` 단언 전부 통과(회귀), K=4 3MF에서 DoD 4번의 길이·색·`top_z`·`extruder` 단언이 통과한다. (depends: S1)
- [ ] S3. UI 상태·검증 — 색 개수 K(2~4, 기본 2)와 슬롯별 색(기본 2색 [#000000,#FFFFFF], 4색 [#000000,#555555,#AAAAAA,#FFFFFF])을 `ui/model.ts`에 두고, K가 늘면 N이 K 미만이 되지 않도록 단계 수 최솟값을 K로 올린다. `summarize`는 색 교체 높이와 슬라이서 마커 높이 목록을 반환한다. — completion criterion: `model.test.ts`에 단언(K=2 기본값 보존, K=4 기본 색 4개, `summarize`의 목록이 S1과 일치, N<K 보정)이 통과한다. (depends: S1)
- [ ] S4. UI 패널 — `App.tsx`에 색 개수 선택과 슬롯별 `<input type="color">`를 추가하고, 스와치는 단계별로 배정된 색으로, 정보 패널은 색 교체 높이·슬라이서 마커 높이를 여러 개 표시하며, 3MF 다운로드가 선택한 색을 `build3mf`에 넘긴다. 2D 톤 캔버스는 회색 그대로. 모바일 미디어 쿼리에서도 레이아웃이 깨지지 않게 한다. — completion criterion: 브라우저에서 K 선택·색 선택·정보 패널 다중 높이·다운로드가 동작한다(DoD 6번의 앞부분). (depends: S2, S3)
- [ ] S5. 3D 뷰어 — `Viewer.tsx`의 단일 임계값을 색 교체 높이 배열과 색 배열(셰이더 uniform 배열)로 바꿔 높이 구간마다 선택 색으로 칠한다(불투명, 반투명 시뮬레이션 없음). K=2는 기존 검정/흰색과 같은 모습. — completion criterion: 브라우저 스크린샷에서 4색 모델의 높이 구간이 선택 색 4개로 구분되어 보이고, K=2 화면은 이전과 같다(DoD 6번의 뒷부분). (depends: S3)
- [ ] S6. 샘플 스크립트·검증 — `scripts/sample.ts`가 색 개수 인자(기본 2)를 받아 K색 3MF를 만들고 색 교체 목록을 출력하게 한다. 수동 슬라이서 확인 절차를 run 노트에 남긴다(자동화 불가, 사용자 확인). — completion criterion: `npm run sample -- 4`가 `samples/sample.3mf`를 만들고 `unzip -l`에 8개 엔트리가 보이며, 사용자가 Bambu Studio 확인 결과를 알려 준다(DoD 5·7번). (depends: S2)
