---
name: handoff
description: 디자인-개발 핸드오프 문서 생성
---

# /SAX:handoff Command

디자인을 개발팀에 전달하기 위한 핸드오프 문서를 생성합니다.

## Trigger

- `/SAX:handoff {대상}` 명령어
- "핸드오프", "개발 전달", "스펙 문서" 키워드

## Action

`design-master` Agent → `design-handoff` Skill을 호출하여 핸드오프 문서를 생성합니다.

## Usage

```bash
# 최근 목업에 대한 핸드오프
/SAX:handoff

# 특정 컴포넌트 핸드오프
/SAX:handoff 로그인 폼

# Figma 기반 핸드오프
/SAX:handoff https://www.figma.com/file/abc123/...
```

## Expected Output

```markdown
[SAX] Orchestrator: 의도 분석 완료 → 핸드오프 문서

[SAX] Agent: design-master 호출 (트리거: /SAX:handoff)

[SAX] Skill: design-handoff 호출

## 핸드오프 문서: 로그인 폼

✅ 문서 생성 완료: `docs/handoff/login-form-handoff.md`

### 포함된 섹션
1. ✅ 개요
2. ✅ 시각 스펙 (색상, 타이포그래피, 스페이싱)
3. ✅ 인터랙션 (상태, 애니메이션)
4. ✅ 반응형 (Desktop, Tablet, Mobile)
5. ✅ 접근성 (ARIA, 키보드, 색상대비)
6. ✅ 에셋 (Figma, 아이콘)
7. ✅ 구현 노트

### 다음 단계
- 개발자에게 문서 공유
- GitHub Issue에 핸드오프 링크 첨부
- Slack #_협업 채널에 알림
```

## Document Structure

생성되는 핸드오프 문서 구조:

```markdown
# Design Handoff: {컴포넌트명}

## 1. 개요
- 목적
- 대상 사용자
- 사용 맥락

## 2. 시각 스펙
- 레이아웃
- 색상
- 타이포그래피
- 스페이싱

## 3. 인터랙션
- 상태별 스타일
- 애니메이션

## 4. 반응형
- Desktop / Tablet / Mobile

## 5. 접근성
- ARIA 속성
- 키보드 탐색
- 색상 대비

## 6. 에셋
- Figma 링크
- 이미지

## 7. 구현 노트
- 기술 권장
- 주의사항
```

## Options

| 옵션 | 설명 | 예시 |
|------|------|------|
| 대상 | 핸드오프 대상 컴포넌트 | "로그인 폼" |
| Figma URL | Figma 디자인 링크 | "https://figma.com/..." |
| 출력 경로 | 문서 저장 위치 | "--output docs/" |

## Related

- [design-handoff Skill](../../skills/design-handoff/SKILL.md)
- [design-master Agent](../../agents/design-master/design-master.md)
- [generate-mockup Skill](../../skills/generate-mockup/SKILL.md)
