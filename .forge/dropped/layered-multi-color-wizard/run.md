# run — layered-multi-color-wizard

Run mode: 워크플로 없이 메인 세션에서 직접 구현 (S1→S2→{S3}→S4/S5→S6 이 거의 직렬이고 App.tsx 하나를 공유하므로). 먼저 `git stash pop stash@{1}`("ams-four-color-support", K색 층 구현)로 복원한 뒤(복원 직후 72 passed) 계획의 추가분을 TDD 로 구현: K=1·쌓는 순서 테스트를 먼저 쓰고 실패(4개, 3개, 4개)를 확인한 뒤 구현.

## Per-slice results
- S1 코어 (`toneColorIndex` K=1, `toolChanges` order·K=1) — ✅ as planned (복원한 코어 + 테스트 4개 추가)
- S2 3MF (`build3mf` 옵션 `colors`·`order`·`steps`, 객체 `extruder`=order[0]+1, K=1 은 custom_gcode 파일 없음) — ✅ as planned; 기본 출력은 HEAD 와 8개 엔트리 sha256 전부 동일(git worktree 로 직접 비교)
- S3 UI 모델 (`defaultColors(1)`, `defaultOrder`, `moveStack`, `stackColors`, `stepColors(order)`) — ✅ as planned
- S4 위저드 UI (1. 필라멘트 → 2. 이미지 → 3. 옵션, 쌓는 순서 ↑↓, K=1 정보 패널 "없음") — ⚠ 이미지 드롭 영역을 패널 맨 위에서 "2. 이미지" 섹션으로 옮겼고 기존 h2(톤 단계·이미지 보정·크기·레이어)를 "3. 옵션" 아래 h3 로 내림(스타일 `.panel h3` 추가)
- S5 3D 뷰어 — ✅ as planned (복원한 다중 임계값 셰이더 + 스택 순서로 정렬된 색, K=1 은 단색)
- S6 샘플 스크립트 `npm run sample -- <K> [order]` — ✅ as planned; **수동 Bambu Studio 확인은 사용자 몫이라 아직 미완**

## Plan vs actual
- 복원한 stash 에는 이미 K=2~4, 색 선택 UI, 다중 임계값 뷰어가 있었다. 이번 작업의 실제 추가분은 K=1, 쌓는 순서(`order`), 위저드 섹션 구조, 샘플 인자였다.
- 쌓는 순서 UI: 스택 목록은 DOM 에서는 아래→위(베이스 먼저)로 두고 CSS `order: -pos` 로 화면에서는 위층이 위에 보이게 했다. ↑는 층을 위로(position+1), ↓는 아래로(position-1) 옮기고, 맨 위/맨 아래에서 비활성.
- 필라멘트 개수를 바꾸면 그 개수의 기본 색과 기본 순서로 초기화(사용자가 고른 색은 유지하지 않음), 단계 수는 K 미만이면 K 로 올림.
- 프라임 타워는 템플릿 값(0)을 유지(계획대로). 필요하면 옵션 추가는 후속 작업.
- **계획 밖 발견 (수정하지 않음, 이전 모바일 작업 `app.css` 의 결과)**: 모바일 폭(390px)에서 3D 뷰어가 세로 화면에 모델 좌우가 잘리게 확대됨. 카메라 거리가 종횡비를 고려하지 않는 `Viewer.tsx` 의 `size * 0.9/1.1` 때문으로 보인다 (Inferred, 스크린샷 `/tmp/wizard-mobile.png` 확인; 원인 코드는 확인했으나 수정 전). 이 계획의 비목표에는 없지만 DoD 8번의 "모바일에서 위저드 컨트롤이 깨지지 않음"은 별개로 통과(가로 넘침 없음).
- 폐기된 방식(`ams-color-groups-1of2` 컬러 그룹 파트)의 stash@{0} 는 남겨 두었다.

## DoD baseline → after
1. `npm test`: 56 passed → 84 passed (회귀 방어 + 새 테스트 28개)
2. `npm run build`: 통과 → 통과 (회귀 방어)
3. 기본 보존: `build3mf` K=2·순서 [0,1]·[#000000,#FFFFFF] 출력 8개 엔트리 sha256 — HEAD 와 동일 → 변경 후에도 동일(IDENTICAL). 브라우저 기본 화면 정보 패널 "0.88 mm (슬라이서 마커 0.96 mm)", 삼각형 6,012 (사전과 동일, 회귀 방어)
4. 코어 테스트: 함수 없음/K=1·order 미지원 → `heights.test.ts` 26개 통과 (K=1 [0,…], K=1 변경 [], 순서 [2,0,3,1] → extruder [1,4,2], 순서 [1,0] → 1)
5. 3MF 테스트: 없음 → 통과 (순서 [1,0]: 객체 extruder 2·tool_change extruder 1·#000000, 순서 [2,0,3,1]: 객체 3·변경 1,4,2, K=1: custom_gcode 없음·filament_colour 1개·flush ['0']·filament_maps "1")
6. UI 모델 테스트: 없음 → 통과 (`defaultColors(1)`=['#ffffff'], `defaultOrder`, `moveStack` 범위 내/밖, `stackColors`, `stepColors(order)`, K=1 `summarize` 변경 없음)
7. `npm run sample -- <K> [order]`: 인자 없음 → `-- 1` 7 files(custom_gcode 없음), `-- 4` 8 files(0.96→2, 1.12→3, 1.28→4), `-- 4 2,0,3,1` 8 files(0.96→1, 1.12→4, 1.28→2), 인자 없음은 이전과 같음(0.96→2), 잘못된 순서(`3 0,1,1`)는 오류
8. 브라우저 UAT(agent-browser, Measured): 섹션 "1. 필라멘트/2. 이미지/3. 옵션"; K=1 정보 패널 "없음 (필라멘트 1개)", 색 선택 1개, 스택 목록 없음; K=4 정보 패널 "0.88 / 1.04 / 1.2 mm (마커 0.96 / 1.12 / 1.28 mm)", N 최솟값 4; 순서 ↑ 2회 후 스택 [슬롯2(베이스), 슬롯1, 슬롯4, 슬롯3] 로 3D 뷰어 색 순서(빨강·검정·파랑·초록)와 스와치 순서가 따라 바뀜; 3MF 다운로드 K=4 순서 변경 상태 53,975 bytes `model/3mf`; 모바일 폭 390px 에서 가로 넘침 없음(scrollWidth 388 = clientWidth 388), ↑↓ 버튼 44×38. (3D 뷰어 잘림은 위 "계획 밖 발견")
9. 수동 슬라이서 확인: 없음 → **대기 중** (사용자가 4색 3MF 와 순서를 바꾼 3MF 를 Bambu Studio 에서 확인)
