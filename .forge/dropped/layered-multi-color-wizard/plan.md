<!-- forge-slug: layered-multi-color-wizard -->
<!-- task: 3 -->
<!-- tdd: on -->
# 필라멘트 1~4개 층 쌓기 + 색/쌓는 순서 선택 위저드

## Goal / Non-goals
- Goal: 흑백 고정 층 모드를 필라멘트 1~4개로 일반화한다. UI 는 "1. 필라멘트 개수와 색·쌓는 순서 선택 → 2. 이미지 선택 → 3. 옵션 조정" 흐름이다. 1개는 색 교체 없이 높이만, 2개는 현재 흑백 구조에 색·순서만 선택, 3~4개는 색 구간을 추가로 쌓는다(색 교체 K-1회). 3MF 는 K개 필라멘트와 K-1개 `tool_change` 를 담고, 3D 미리보기·스와치·정보 패널이 선택한 색과 여러 색 교체 높이를 보여 준다. 기본(2개, [검정, 흰색], 순서 그대로)은 현재 출력과 같다.
- Non-goals: 반투명 혼합(HueForge식) / 이미지 색상으로 영역을 나누는 방식(폐기된 컬러 그룹 모드) / 색 구간 경계 수동 조절 / 슬롯별 소재·온도 / 2D 톤 미리보기 컬러화(회색 유지) / 프라임 타워 설정 변경(템플릿 값 0 유지) / K>4.

## Source of truth
- Glossary terms: Base, Color change height, Color band, Stack order, White layer in .forge/CONTEXT.md
- Related ADRs: .forge/adr/261117-152717-layered-multi-color-stack-order.md (이 작업의 결정), .forge/adr/261117-143215-multi-color-height-bands.md (구간 규칙, 확장됨), .forge/adr/261116-134329-two-filament-thickness-tone-bambu-3mf.md (두께 기반 톤·3MF 출력)
- 규칙(ADR 확정): K 는 1..4(기본 2). 색은 슬롯 순서(slot 0..K-1)로 저장하고, 쌓는 순서 `order` 는 슬롯 인덱스의 순열(기본 [0..K-1], 아래→위). 톤 단계 k(0..N-1)의 색 구간 위치 = k==0 ? 0 : 1 + floor((k-1)(K-1)/(N-1)), 위치 c 는 슬롯 order[c] 로 출력. N≥K 필수(K=1 은 제한 없음, 최소 2 유지). 위치 c(≥1)의 `tool_change top_z` = (그 위치가 맡는 첫 단계 s_c 의 바로 아래 단계 s_c-1 의 높이) + 1레이어, `extruder` = order[c]+1. K=1 이면 색 교체 없음. 3MF 의 첫 층 필라멘트(model_settings 객체 `extruder`) = order[0]+1. 예(기본 레이어, m=1, N=7): K=2 → [0.96], K=4 → [0.96, 1.12, 1.28] (구간: 단계 0 / 1-2 / 3-4 / 5-6).
- 재사용: `git stash list` 의 "ams-four-color-support"(K색 층 구현) 항목에 코어(`toneColorIndex`/`toolChanges`), 3MF 필라멘트 배열 확장(`NON_FILAMENT_KEYS`/`projectSettings(p, colors)`), UI 모델(`defaultColors`/`minSteps`/`stepColors`/`summarize`), 뷰어 다중 임계값 셰이더, App 패널, 샘플 스크립트가 있다. 그 위에서 K=1·쌓는 순서·위저드 UI 를 더한다. "ams-color-groups-1of2" stash 는 폐기된 방식이므로 쓰지 않는다.
- 3MF 필라멘트 확장 근거(Measured): 원본 `fourth+wing+ams.3mf`(필라멘트 3개)의 `project_settings.config` 에서 길이 3인 키 100개가 필라멘트별 배열이고 템플릿(`src/core/bambu-a1-project-settings.json`)은 그 100개를 길이 2로 줄인 것. 템플릿의 길이 2 키 중 나머지 20개는 `machine_max_*` 등 기계 모드 배열. flush matrix K², vector 2K, `different_settings_to_system` K+2.
- 프라임 타워(Measured): 템플릿 `enable_prime_tower` = 0 (참조 3MF 와 동일). 이번 작업은 이 값을 바꾸지 않는다.
- DoD 사이트 파인더(작성 시점 실행 결과): `git grep -nE "toolChangeTopZ|colorChangeZ|firstWhiteLayerZ|filament_colour|filament_maps" -- src scripts` — src/core/threemf.ts, src/core/heights.ts(stepHeights 공유), src/ui/model.ts, src/ui/Viewer.tsx, src/App.tsx, scripts/sample.ts, src/core/bambu-a1-project-settings.json. 승격 시 재실행해 목록 밖 사이트가 나오면 DoD 에 포함한다.
- Definition of Done (사전 상태 기록, 작성 시점 측정):
  1. `npm test` exit 0 — 사전: 56 passed (회귀 방어, 층 모드 보존 확인용). 사후: 새 테스트 포함 전부 통과.
  2. `npm run build` exit 0 — 사전: 통과 (회귀 방어).
  3. 기본 보존: K=2·순서 [0,1]·[#000000,#FFFFFF] 의 `build3mf` 출력 8개 엔트리 sha256 이 HEAD 와 같다(git worktree 로 비교) — 사전: 동일(이번 작업 전이므로 자명, 회귀 방어). 브라우저 기본 화면은 정보 패널 "0.88 mm (슬라이서 마커 0.96 mm)", 삼각형 6,012(합성 600×300 그라디언트).
  4. 코어 테스트(`heights.test.ts`): `toneColorIndex`(K=1 [0,0,…], K=2 N=7 [0,1,1,1,1,1,1], K=4 N=7 [0,1,1,2,2,3,3], N<K RangeError), `toolChanges`(K=1 [], K=2 [{0.96,2}], K=4 [{0.96,2},{1.12,3},{1.28,4}], m=2 첫 단계 아래 높이+1레이어, 순서 [2,0,3,1] 이면 extruder [1,4,2]) — 사전: 함수 없음(forward check).
  5. 3MF 테스트(`threemf.test.ts`): K=4 에서 필라멘트별 100개 키 길이 4·`filament_colour` 가 슬롯 순서의 선택 색(대문자)·`top_z` [0.96,1.12,1.28]·`filament_maps` "1 1 1 1"·`flush_volumes_matrix` 16; 순서 [1,0] 이면 객체 `extruder` = 2 이고 `tool_change` extruder = 1; K=1 은 `custom_gcode_per_layer.xml` 없음 — 사전: 없음.
  6. UI 모델 테스트(`model.test.ts`): 기본 색(K=1 [#ffffff], 2 [#000000,#ffffff], 3 [#000000,#808080,#ffffff], 4 [#000000,#555555,#aaaaaa,#ffffff]), `minSteps`, `stepColors` 가 순서를 반영, `summarize` 가 변경 높이·마커 높이 목록을 순서와 무관하게 높이 오름차순으로 반환, 순서 이동 헬퍼 — 사전: 없음.
  7. `npm run sample -- <K> [order]` 가 `samples/sample.3mf` 를 만들고 `unzip -l` 로 확인 — 사전: 인자 없음.
  8. 브라우저 UAT(agent-browser): 필라멘트 1개(색 교체 없음, 정보 패널에 변경 높이 없음) / 4개(정보 패널 변경 높이 3개, 3D 뷰어 구간별 선택 색) / 쌓는 순서 ↑↓ 로 바꾸면 3D 뷰어·스와치 색 순서가 바뀜 / N 이 K 미만으로 내려가지 않음 / 3MF 다운로드 성공 — 사전: 없음. 모바일 폭(768px 이하)에서 위저드 컨트롤이 깨지지 않음(스크린샷).
  9. 수동 슬라이서 확인(사용자, 자동화 불가): 4색 3MF 와 순서를 바꾼 3MF 를 Bambu Studio 에서 열어 필라멘트 4개·색 교체 3개가 의도한 레이어에 걸리고 첫 층 필라멘트가 쌓는 순서의 첫 색인지 확인 — 사전: 없음. (이전 회고: 슬라이서 마커 높이는 수동 확인을 DoD 에 포함해야 한다.)

## Work slices
- [ ] S1. 코어 복원·확장 — stash "ams-four-color-support" 에서 `heights.ts` 의 `toneColorIndex`/`toolChanges` 를 복원하고, K=1(변경 없음)과 쌓는 순서 `order`(위치→슬롯, `extruder` = order[c]+1)를 더한다. `threemf.ts` 의 `toolChangeTopZ` 는 이 일반화로 대체한다. — completion criterion: DoD 4번 `heights.test.ts` 단언이 모두 통과한다.
- [ ] S2. 3MF — stash 의 필라멘트 배열 K 확장(`NON_FILAMENT_KEYS`, `projectSettings(p, colors)`)을 복원하고, `build3mf` 옵션 `steps`·`colors`(슬롯 순서)·`order` 를 받아 `filament_colour`/`filament_maps`/flush/diff 배열을 K 에 맞추고, 객체 `extruder` = order[0]+1, `custom_gcode_per_layer.xml` 은 변경이 있을 때만 `extruder`·`color` 와 함께 쓴다. — completion criterion: DoD 5번 단언과 기존 `threemf.test.ts` 단언(K=2)이 통과하고, 기본 출력이 HEAD 와 sha256 동일하다(DoD 3번). (depends: S1)
- [ ] S3. UI 모델 — stash 의 `defaultColors`/`minSteps`/`stepColors`/`summarize` 를 복원하고 K=1 기본 색·순서 반영(`stepColors`/`summarize`)·순서 이동 헬퍼를 더한다. — completion criterion: DoD 6번 `model.test.ts` 단언이 통과한다. (depends: S1)
- [ ] S4. 위저드 UI — `App.tsx` 패널을 "1. 필라멘트(개수 1~4, 슬롯별 색 피커, 쌓는 순서 ↑↓ 목록) → 2. 이미지 → 3. 옵션(기존 톤 단계·보정·크기·레이어)" 순서의 섹션으로 정리하고, 스와치·정보 패널(변경 높이 목록)·다운로드가 선택한 색과 순서를 쓰게 한다. 개수를 바꾸면 그 개수의 기본 색으로 초기화하고 단계 수는 K 미만이면 K 로 올린다. 모바일 미디어 쿼리에서 새 컨트롤이 보이게 한다. — completion criterion: 브라우저 UAT(DoD 8번 앞부분)와 모바일 스크린샷이 통과한다. (depends: S2, S3)
- [ ] S5. 3D 뷰어 — stash 의 `Viewer.tsx` 다중 임계값 셰이더를 복원해 `colorChangeZs`·쌓는 순서가 반영된 `colors` 로 칠하고, K=1 은 단색으로 칠한다. — completion criterion: 브라우저 스크린샷에서 4색이 구간별 선택 색으로, 순서를 바꾸면 색 순서가 바뀌어 보이고 K=2 기본 화면은 이전과 같다(DoD 3·8번). (depends: S3)
- [ ] S6. 샘플 스크립트·수동 확인 — `scripts/sample.ts` 가 `<K> [order]` 인자를 받아 해당 3MF 를 만들고 변경 목록(top_z→extruder)을 출력하게 한다. 수동 슬라이서 확인 절차를 run 노트에 남긴다. — completion criterion: `npm run sample -- 4`, `npm run sample -- 4 2,0,3,1` 이 파일을 만들고 `unzip -l` 에 8개 엔트리가 보이며, 사용자가 Bambu Studio 확인 결과를 알려 준다(DoD 7·9번). (depends: S2)
