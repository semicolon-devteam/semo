#!/bin/bash
# SEMO Skill Test Runner
# 스킬 디렉토리의 구조와 필수 요소를 테스트합니다.

set -e

SKILLS_DIR="${1:-./skills}"
EXIT_CODE=0
PASSED=0
FAILED=0

echo "🧪 SEMO Skill Test Runner"
echo "========================="
echo "Target: $SKILLS_DIR"
echo ""

# 스킬 검증 함수
test_skill() {
    local skill_dir="$1"
    local skill_name=$(basename "$skill_dir")
    local errors=""

    # SKILL.md 존재 확인
    if [ ! -f "$skill_dir/SKILL.md" ]; then
        errors+="  - Missing SKILL.md\n"
    else
        # YAML frontmatter 확인
        if ! head -1 "$skill_dir/SKILL.md" | grep -q "^---$"; then
            errors+="  - Missing YAML frontmatter\n"
        fi

        # name 필드 확인
        if ! grep -q "^name:" "$skill_dir/SKILL.md"; then
            errors+="  - Missing 'name' in frontmatter\n"
        fi

        # description 필드 확인
        if ! grep -q "^description:" "$skill_dir/SKILL.md"; then
            errors+="  - Missing 'description' in frontmatter\n"
        fi

        # tools 필드 확인
        if ! grep -q "^tools:" "$skill_dir/SKILL.md"; then
            errors+="  - Missing 'tools' in frontmatter\n"
        fi
    fi

    # 결과 출력
    if [ -z "$errors" ]; then
        echo "  ✅ $skill_name"
        PASSED=$((PASSED + 1))
    else
        echo "  ❌ $skill_name"
        echo -e "$errors"
        FAILED=$((FAILED + 1))
        EXIT_CODE=1
    fi
}

echo "📋 Testing Skills:"
echo ""

# 모든 스킬 테스트
for skill in "$SKILLS_DIR"/*/; do
    if [ -d "$skill" ]; then
        skillname=$(basename "$skill")
        # CHANGELOG, _shared 등 제외
        if [[ "$skillname" != "CHANGELOG" ]] && [[ "$skillname" != "_shared" ]]; then
            test_skill "$skill"
        fi
    fi
done

echo ""
echo "📊 Test Results"
echo "==============="
echo "  Passed: $PASSED"
echo "  Failed: $FAILED"
echo "  Total:  $((PASSED + FAILED))"
echo ""

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed!"
else
    echo "❌ Some tests failed"
fi

exit $EXIT_CODE
