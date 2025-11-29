# Workflow

> version-manager의 8단계 버저닝 프로세스

## Input Schema

```json
{
  "changes": [
    {
      "type": "added|changed|removed|fixed",
      "component": "Agent|Skill|Command|Config",
      "name": "component-name",
      "description": "변경 사항 설명",
      "package": "sax-po|sax-next|sax-meta"
    }
  ],
  "version_hint": "major|minor|patch|auto"
}
```

## Phase 1: 현재 버전 확인

```bash
# VERSION 파일 읽기
cat sax/VERSION
# 예: 3.7.0
```

## Phase 2: 버전 타입 판단

1. **version_hint 확인**:
   - `major|minor|patch` → 직접 사용
   - `auto` → Algorithm으로 자동 판단

2. **변경사항 분석**:
   - Added → MINOR
   - Removed → MINOR (또는 MAJOR if breaking)
   - Changed → MINOR (또는 PATCH if minor)
   - Fixed → PATCH

## Phase 3: 새 버전 계산

예시:
- 3.7.0 + MINOR → 3.8.0
- 3.8.0 + PATCH → 3.8.1
- 3.8.1 + MAJOR → 4.0.0

## Phase 4: CHANGELOG 파일 생성

**파일 위치**: `sax/CHANGELOG/{new_version}.md`

**날짜**: 현재 시스템 날짜 (`date +%Y-%m-%d`)

## Phase 5: INDEX.md 업데이트

1. **Latest Version 업데이트**:
   ```markdown
   **Latest Version**: [3.8.0](3.8.0.md) - 2025-11-26
   ```

2. **Version History 섹션에 추가**:
   ```markdown
   ### v3.x (2025-11-26)

   - [3.8.0](3.8.0.md) - SAX-Meta 패키지 분리
   - [3.7.0](3.7.0.md) - CHANGELOG 구조 개선
   ```

3. **Breaking Changes 업데이트** (MAJOR만):
   ```markdown
   ## Breaking Changes

   - **v4.0.0**: {변경사항 설명}
   ```

## Phase 6: VERSION 파일 업데이트

```bash
# 새 버전 쓰기
echo "{new_version}" > sax/VERSION
```

## Phase 7: 커밋

```bash
# 변경사항 스테이징
git add sax/VERSION sax/CHANGELOG/

# 버전 커밋 (CLAUDE.md 버저닝 커밋 형식 준수)
git commit -m "🔖 [SAX] {new_version}: {변경 요약}

- 상세 변경 내용 1
- 상세 변경 내용 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**커밋 메시지 형식** (CLAUDE.md 규칙):

```text
🔖 [SAX] {version}: {변경 요약}

- 상세 변경 내용 1
- 상세 변경 내용 2

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

**포함 파일**:

- `sax/VERSION`
- `sax/CHANGELOG/{new_version}.md`
- `sax/CHANGELOG/INDEX.md`

## Phase 8: 푸시 (필수)

> **🔴 필수 단계**: 버저닝은 푸시까지 완료해야 완료로 간주됩니다.

```bash
# 원격 저장소에 푸시
git push origin main
```

**서브모듈 환경**: 각 패키지(sax-meta, sax-po, sax-next)가 별도 레포인 경우 개별 푸시 필요

```bash
cd sax-meta && git push origin main
cd sax-po && git push origin main
cd sax-next && git push origin main
```

## Validation

**버저닝 전**:

- ✅ VERSION 파일 존재
- ✅ CHANGELOG/ 디렉토리 존재
- ✅ INDEX.md 파일 존재
- ✅ changes 배열 비어있지 않음

**버저닝 후**:

- ✅ VERSION 파일 업데이트 확인
- ✅ CHANGELOG/{new_version}.md 생성 확인
- ✅ INDEX.md Latest Version 업데이트 확인
- ✅ Keep a Changelog 형식 준수 확인
- ✅ 커밋 완료 확인 (`git log -1`)
- ✅ **푸시 완료 확인** (`git status` - "Your branch is up to date")
