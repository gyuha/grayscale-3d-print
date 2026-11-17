<!-- forge-slug: ams-color-groups-2of2 -->
<!-- task: 4 -->
<!-- part: 2/2 -->
<!-- tdd: on -->
# 컬러 그룹 모드 UI: 모드 전환 · 슬롯/베이스 선택 · 미리보기 · 다운로드 (2/2)

## Goal / Non-goals
- Goal: 1/2 의 코어를 웹 UI 에 연결한다. "층(흑백)" / "컬러 그룹" 모드 전환, AMS 슬롯 4개의 색 지정과 베이스 슬롯 선택(기본 슬롯 1=흰색, 나머지 검정·빨강·파랑), 컬러 이미지의 2D 그룹 미리보기, 그룹 색으로 칠한 3D 뷰어, 다중 파트 3MF 다운로드. 층 모드 화면과 동작은 그대로다.
- Non-goals: 그룹 경계·분류 규칙의 사용자 조절 / 그룹 4개 / 반투명 색 시뮬레이션 / 코어 로직 변경(1/2 의 책임) / 슬롯별 소재 설정.

## Source of truth
- Glossary terms: Layer mode, Color group mode, Base slot, Color group in .forge/CONTEXT.md
- Related ADRs: .forge/adr/261117-150705-color-group-mode.md, .forge/adr/261116-134329-two-filament-thickness-tone-bambu-3mf.md (층 모드 유지)
- 선행: 1/2(`ams-color-groups-1of2`)의 `processColorImage`·`buildGroupParts`·`build3mfParts` 를 사용한다. 소프트 순서이므로 1/2 가 봉인되기 전에도 실행은 가능하지만, 1/2 없이는 구현할 수 없다.
- Definition of Done (사전 상태 기록 — 1/2 완료 시점의 `npm test` 개수를 승격 시 다시 측정):
  1. `npm test` exit 0 — 사전: 1/2 완료 후 값(승격 시 측정) (회귀 방어). 사후: 새 테스트 포함 전부 통과.
  2. `npm run build` exit 0 — 사전: 통과 (회귀 방어).
  3. 층 모드 보존: 컬러 그룹 모드 코드가 층 모드 상태·기본 화면을 바꾸지 않는다 — 브라우저에서 모드가 "층"일 때 정보 패널이 "색 교체 높이 0.88 mm (슬라이서 마커 0.96 mm)", 삼각형 6,012(합성 600×300 그라디언트, 기본 파라미터)로 이 작업 이전과 같다 — 사전: 이전 작업 UAT 에서 측정한 값과 동일해야 함(회귀 방어).
  4. UI 모델 테스트(`model.test.ts` 확장): 기본 슬롯 색 [#ffffff, #000000, #d03030, #3050d0] 과 기본 베이스 슬롯 0, 베이스 슬롯을 바꾸면 나머지 3개가 그룹 슬롯, 그룹 미리보기 색 합성 함수의 기대값 — 사전: 없음(forward check).
  5. 브라우저 UAT(agent-browser): 컬러 합성 이미지 업로드 → "컬러 그룹" 모드 → 슬롯 색 지정·베이스 슬롯 변경 → 2D 그룹 미리보기가 슬롯 색으로 보임, 3D 뷰어가 베이스(흰색)와 그룹 색 3개로 칠해짐, 정보 패널에 그룹별 셀 수, 3MF 다운로드 성공 — 사전: 없음.
  6. 모바일 폭(768px 이하)에서 새 컨트롤이 깨지지 않음(스크린샷 확인) — 사전: 없음.

## Work slices
- [ ] S1. UI 모델 — `ui/model.ts` 에 컬러 그룹 모드 기본값(슬롯 색 4개, 베이스 슬롯 0), 베이스 슬롯 변경 시 그룹 슬롯 목록, 그룹 미리보기 픽셀 합성(베이스 색과 그룹 색을 단계 비율로 혼합), 그룹별 셀 수 요약을 순수 함수로 추가한다. — completion criterion: DoD 4번의 `model.test.ts` 단언이 통과한다.
- [ ] S2. 메시 워커 — 파트 메시를 워커에서 만들도록 `mesh.worker.ts` 에 컬러 그룹 요청 형태를 추가하고(1/2 의 `buildGroupParts` 사용), 층 모드 요청 처리는 바꾸지 않는다. — completion criterion: 브라우저에서 컬러 그룹 모드 메시가 생성되어 삼각형 수가 표시되고(DoD 5번), 층 모드 삼각형 수는 6,012 로 같다(DoD 3번). (depends: S1)
- [ ] S3. 3D 뷰어 — `Viewer.tsx` 가 파트 목록과 파트별 색을 받아 꼭짓점 색으로 칠한다(컬러 그룹 모드). 층 모드의 임계값 셰이더는 그대로 둔다. — completion criterion: 브라우저 스크린샷에서 베이스와 그룹 색 3개가 구분되어 보인다(DoD 5번). (depends: S2)
- [ ] S4. 패널·미리보기·다운로드 — `App.tsx` 에 모드 전환, 슬롯 색 피커 4개와 베이스 슬롯 선택(라디오), 컬러 그룹 2D 미리보기(원본·그룹 합성), 그룹별 셀 수 정보, `build3mfParts` 다운로드를 추가하고 층 모드 UI 는 유지한다. 모바일 미디어 쿼리에서 새 컨트롤이 보이게 한다. — completion criterion: 브라우저 UAT(DoD 5번)와 모바일 폭 스크린샷(DoD 6번)이 통과하고 층 모드 값이 보존된다(DoD 3번). (depends: S1, S2, S3)
