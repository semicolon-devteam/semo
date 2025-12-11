#!/bin/bash
#
# SEMO Test Framework - Assertion Functions
#
# 사용법:
#   source lib/assertions.sh
#   assert_contains "$response" "expected"
#   assert_contains_any "$response" "option1" "option2"
#

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 테스트 결과 카운터
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_SKIPPED=0

# 현재 테스트 이름
CURRENT_TEST=""

#######################################
# 테스트 시작 선언
# Arguments:
#   $1 - 테스트 이름
#######################################
test_start() {
    CURRENT_TEST="$1"
    echo -e "${YELLOW}[TEST]${NC} $CURRENT_TEST"
}

#######################################
# 테스트 성공
#######################################
test_pass() {
    ((TESTS_PASSED++))
    echo -e "  ${GREEN}✓ PASS${NC}"
}

#######################################
# 테스트 실패
# Arguments:
#   $1 - 실패 메시지
#######################################
test_fail() {
    local message="${1:-Assertion failed}"
    ((TESTS_FAILED++))
    echo -e "  ${RED}✗ FAIL${NC}: $message"
}

#######################################
# 테스트 스킵
# Arguments:
#   $1 - 스킵 사유
#######################################
test_skip() {
    local reason="${1:-Skipped}"
    ((TESTS_SKIPPED++))
    echo -e "  ${YELLOW}○ SKIP${NC}: $reason"
}

#######################################
# 문자열 포함 여부 검증
# Arguments:
#   $1 - 검사할 문자열
#   $2 - 포함되어야 할 문자열
# Returns:
#   0 - 포함됨
#   1 - 포함 안됨
#######################################
assert_contains() {
    local haystack="$1"
    local needle="$2"

    if [[ "$haystack" == *"$needle"* ]]; then
        return 0
    else
        return 1
    fi
}

#######################################
# 여러 문자열 중 하나 이상 포함 여부 검증
# Arguments:
#   $1 - 검사할 문자열
#   $2+ - 포함되어야 할 문자열들 (하나라도 있으면 통과)
# Returns:
#   0 - 하나 이상 포함됨
#   1 - 모두 포함 안됨
#######################################
assert_contains_any() {
    local haystack="$1"
    shift

    for needle in "$@"; do
        if [[ "$haystack" == *"$needle"* ]]; then
            return 0
        fi
    done

    return 1
}

#######################################
# 모든 문자열 포함 여부 검증
# Arguments:
#   $1 - 검사할 문자열
#   $2+ - 모두 포함되어야 할 문자열들
# Returns:
#   0 - 모두 포함됨
#   1 - 하나라도 누락
#######################################
assert_contains_all() {
    local haystack="$1"
    shift

    for needle in "$@"; do
        if [[ "$haystack" != *"$needle"* ]]; then
            return 1
        fi
    done

    return 0
}

#######################################
# 문자열 미포함 여부 검증
# Arguments:
#   $1 - 검사할 문자열
#   $2 - 포함되지 않아야 할 문자열
# Returns:
#   0 - 포함 안됨
#   1 - 포함됨
#######################################
assert_not_contains() {
    local haystack="$1"
    local needle="$2"

    if [[ "$haystack" != *"$needle"* ]]; then
        return 0
    else
        return 1
    fi
}

#######################################
# 정규식 패턴 매칭 검증
# Arguments:
#   $1 - 검사할 문자열
#   $2 - 정규식 패턴
# Returns:
#   0 - 매칭됨
#   1 - 매칭 안됨
#######################################
assert_matches() {
    local haystack="$1"
    local pattern="$2"

    if [[ "$haystack" =~ $pattern ]]; then
        return 0
    else
        return 1
    fi
}

#######################################
# 에러 여부 검증 (is_error 필드)
# Arguments:
#   $1 - JSON 응답
#   $2 - 예상 값 (true/false)
# Returns:
#   0 - 일치
#   1 - 불일치
#######################################
assert_is_error() {
    local json="$1"
    local expected="$2"

    local actual
    actual=$(echo "$json" | jq -r '.is_error // false')

    if [[ "$actual" == "$expected" ]]; then
        return 0
    else
        return 1
    fi
}

#######################################
# 결과 요약 출력
#######################################
print_summary() {
    local total=$((TESTS_PASSED + TESTS_FAILED + TESTS_SKIPPED))

    echo ""
    echo "========================================"
    echo "  테스트 결과 요약"
    echo "========================================"
    echo -e "  ${GREEN}통과${NC}: $TESTS_PASSED"
    echo -e "  ${RED}실패${NC}: $TESTS_FAILED"
    echo -e "  ${YELLOW}스킵${NC}: $TESTS_SKIPPED"
    echo "  총계: $total"
    echo "========================================"

    if [[ $TESTS_FAILED -gt 0 ]]; then
        return 1
    else
        return 0
    fi
}

#######################################
# Claude Code 호출 및 결과 추출
# Arguments:
#   $1 - 프롬프트
# Outputs:
#   JSON 응답 전체
#######################################
run_claude() {
    local prompt="$1"
    local timeout="${2:-120}"

    # Claude Code 비대화형 모드 실행
    timeout "$timeout" claude -p "$prompt" --output-format json 2>/dev/null
}

#######################################
# Claude 응답에서 result 필드 추출
# Arguments:
#   $1 - JSON 응답
# Outputs:
#   result 문자열
#######################################
get_result() {
    local json="$1"
    echo "$json" | jq -r '.result // ""'
}

#######################################
# Claude 응답에서 비용 추출
# Arguments:
#   $1 - JSON 응답
# Outputs:
#   비용 (USD)
#######################################
get_cost() {
    local json="$1"
    echo "$json" | jq -r '.total_cost_usd // 0'
}
