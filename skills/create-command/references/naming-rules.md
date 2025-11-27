# Naming Rules Reference

## 네이밍 규칙

**올바른 방법**:

- ✅ 파일명: `commands/SAX/onboarding.md`
- ✅ 호출: `/SAX:onboarding`
- ✅ 디렉토리명이 프리픽스 역할

**잘못된 방법**:

- ❌ 파일명: `commands/SAX/:onboarding.md` (: 프리픽스 불필요)
- ❌ 결과: `/SAX::onboarding` (이중 콜론 발생)

## 커맨드 파일 구조

```markdown
# Command Title

> 간단한 설명 (1줄)

## Purpose

커맨드의 목적과 역할

## Usage

커맨드 사용 방법 및 예시

## Workflow

1. Step 1
2. Step 2
3. Step 3

## Examples

실제 사용 예제
```

## CLAUDE.md 업데이트

새 커맨드 생성 후 반드시 Commands 섹션에 추가:

```markdown
### Commands

| Command           | 역할                    | 파일                      |
| ----------------- | ----------------------- | ------------------------- |
| /SAX:new-command  | 커맨드 설명             | `commands/SAX/new-command.md` |
```
