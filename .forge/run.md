# run — filament-count-modes

Run mode: 워크플로 없이 메인 세션에서 직접 구현(코어→UI 직렬, App.tsx 공유). TDD: S1·S2·S3 는 테스트를 먼저 쓰고 실패를 확인한 뒤 구현. 이전 시도(평평한 높이 색 영역 코어)의 forge 상태는 `.forge/dropped/color-regions-1of2-v2/` 에 보관.

## Per-slice results
- S1 색 영역 코어 (`processRegionImage` = `processImage` 결과 + 셀 색 인덱스, `buildRegionParts`) — ⚠ 실행 후 파트 구조 변경: 슬롯 1 베이스 판 + 위에만 색 + 1레이어 추가
- S2 층 모드 색 선택 (`build3mf` 의 선택적 `colors`) — ✅ as planned (기본 출력은 HEAD 와 8개 엔트리 sha256 동일)
- S3 UI 모델 (`defaultColors`, `regionRgba`, `regionCounts`) — ✅ as planned
- S4 워커·뷰어 — ✅ as planned (워커는 항상 파트 목록 반환, 뷰어는 파트별 below/above 색 uniform; 색만 바뀔 때는 지오메트리·카메라를 다시 만들지 않음)
- S5 패널·미리보기·다운로드 — ✅ as planned (+ 라벨 "단계당 흰 레이어 m" → "단계당 레이어 m", 개수별 한 줄 안내문 추가)
- S6 샘플 `npm run sample -- regions` — ✅ as planned; **수동 Bambu Studio 확인은 사용자 몫이라 아직 미완**

## Plan vs actual
- **실행 후 사용자 요청으로 변경(양면 문제)**: 3개 이상에서 색 파트가 바닥부터 통째라 그림이 바닥면에도 나왔다. 슬롯 1 색 베이스 판(바닥→베이스 두께) + 나머지 색은 베이스 윗면부터 + 모든 셀 1레이어 추가로 바꿨다(`buildRegionParts` 에 `base`·`lift` 인자, ADR Amendment 3). 계획의 "색마다 그 색 셀의 높이맵 파트" 규칙과 달라진 부분이다. 샘플 3MF 의 z 값(Measured): 슬롯 1 {0, 0.88, 0.96, 1.04}, 슬롯 2 {0.88, 1.36, 1.44}, 슬롯 3 {0.88, 1.2, 1.36}. 최대 높이는 1레이어 늘어 1.44mm.
- 3개 이상의 높이는 L* 가 아니라 1~2개와 완전히 같은 그레이스케일 파이프라인(`processImage`)을 쓴다. 테스트가 heights·stepIdx 가 `processImage` 결과와 같음을 단언한다.
- 1↔2 개 전환은 메시를 다시 만들지 않는다(높이가 같음). 3개 경계를 넘을 때만 파트를 비우고 다시 만든다.
- 3개 이상에서 2D 미리보기는 "원본 / N단계 톤(높이) / 색 영역" 으로 바뀐다(그레이스케일 캔버스 대신 색 영역).
- 경계 셀: 외곽선 가장자리처럼 두 색이 섞인 셀은 평균색 기준으로 분류되어 검정 파트에 톤 단계 1(0.96mm)짜리 셀이 생긴다 (Measured, 샘플 출력).
- 프라임 타워 설정은 건드리지 않았다(템플릿 값 0). 3색 이상은 같은 레이어에서 필라멘트가 바뀌므로 슬라이서에서 켜야 할 수 있다 (Inferred).
- 남아 있는 stash 2개(`layered-multi-color-wizard`, `ams-color-groups-1of2`)는 쓰지 않았다.

## DoD baseline → after
1. `npm test`: 85 passed → 88 passed (양면 수정 테스트 포함) (색 영역 테스트 교체 + 새 테스트, 회귀 방어)
2. `npm run build`: 통과 → 통과 (회귀 방어)
3. K=2 기본 `build3mf` 출력: HEAD 와 동일 → 동일 (IDENTICAL, 회귀 방어)
4. `colorRegions.test.ts`: 평평한 높이 테스트 → 새 규칙 7개 통과
5. `threemf.test.ts` colors 옵션: 없음 → 통과 (`filament_colour` [#112233,#AABBCC], tool_change color #AABBCC)
6. `model.test.ts`: 없음 → 통과 (개수별 기본 색, `regionRgba`, `regionCounts`)
7. 브라우저 UAT(agent-browser, Measured): 2개 기본 화면 "0.88 mm (마커 0.96 mm)", 삼각형 6,012 (이전과 동일); 합성 캐릭터 이미지에서 1개 = 색 교체 줄 없음·색 1개, 3개 = 2D 색 영역과 3D 에서 볼이 분홍·외곽선 검정·몸 흰색, 색 영역 셀 수 6,094 / 26,160 / 1,823; 다운로드 1개 555,980 B(색 교체 파일 없음) / 2개 556,518 B(있음) / 3개 592,600 B(없음)
8. 수동 슬라이서 확인: 없음 → **대기 중** (사용자가 `samples/sample-regions.3mf` 또는 화면에서 받은 3색 3MF 를 Bambu Studio 에서 확인)
