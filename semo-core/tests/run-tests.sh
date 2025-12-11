#!/bin/bash
#
# SEMO Test Framework - Test Runner
#
# Claude Code CLI의 비대화형 모드를 활용한 Agent/Skill 테스트 실행기
#
# 사용법:
#   ./run-tests.sh                    # 모든 테스트 실행
#   ./run-tests.sh orchestrator       # 특정 테스트 파일만 실행
#   ./run-tests.sh --dry-run          # 테스트 케이스만 출력 (실행 안함)
#   ./run-tests.sh --help             # 도움말
#

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

# 라이브러리 로드
source lib/assertions.sh

# 색상
BLUE='\033[0;34m'
CYAN='\033[0;36m'

# 설정
CASES_DIR="$SCRIPT_DIR/cases"
RESULTS_DIR="$SCRIPT_DIR/results"
DRY_RUN=false
VERBOSE=false
TARGET_FILE=""

# 총 비용 추적
TOTAL_COST=0

#######################################
# 도움말 출력
#######################################
show_help() {
    cat << EOF
SEMO Test Framework - Claude Code 기반 Agent/Skill 테스트

사용법:
  ./run-tests.sh [옵션] [테스트파일]

옵션:
  --help, -h      도움말 출력
  --dry-run       테스트 케이스만 출력 (실제 실행 안함)
  --verbose, -v   상세 출력

예시:
  ./run-tests.sh                     # 모든 테스트 실행
  ./run-tests.sh orchestrator        # orchestrator.json만 실행
  ./run-tests.sh --dry-run           # 드라이런

테스트 케이스 위치:
  $CASES_DIR/

결과 저장 위치:
  $RESULTS_DIR/

테스트 케이스 형식:
  JSON 파일 (.json) - jq만 필요
EOF
}

#######################################
# 인자 파싱
#######################################
parse_args() {
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                show_help
                exit 0
                ;;
            --dry-run)
                DRY_RUN=true
                shift
                ;;
            --verbose|-v)
                VERBOSE=true
                shift
                ;;
            *)
                TARGET_FILE="$1"
                shift
                ;;
        esac
    done
}

#######################################
# JSON 테스트 케이스 파싱 및 실행
# Arguments:
#   $1 - JSON 파일 경로
#######################################
run_test_file() {
    local json_file="$1"
    local filename
    filename=$(basename "$json_file" .json)

    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  테스트 파일: $filename${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""

    # JSON에서 테스트 개수 확인
    local test_count
    test_count=$(jq '.tests | length' "$json_file")

    if [[ "$test_count" == "0" ]] || [[ -z "$test_count" ]]; then
        echo -e "${YELLOW}테스트 케이스가 없습니다.${NC}"
        return
    fi

    echo "테스트 케이스: $test_count 개"
    echo ""

    # 각 테스트 케이스 실행
    for ((i=0; i<test_count; i++)); do
        local name input
        name=$(jq -r ".tests[$i].name" "$json_file")
        input=$(jq -r ".tests[$i].input" "$json_file")

        test_start "$name"

        if [[ "$DRY_RUN" == "true" ]]; then
            echo "  입력: $input"
            test_skip "드라이런 모드"
            continue
        fi

        # Claude Code 호출
        echo "  입력: $input"
        local response
        response=$(run_claude "$input" 180)

        if [[ -z "$response" ]]; then
            test_fail "Claude Code 응답 없음"
            continue
        fi

        local result
        result=$(get_result "$response")

        if [[ "$VERBOSE" == "true" ]]; then
            echo "  응답: ${result:0:200}..."
        fi

        # 비용 추적
        local cost
        cost=$(get_cost "$response")
        TOTAL_COST=$(echo "$TOTAL_COST + $cost" | bc -l 2>/dev/null || echo "$TOTAL_COST")

        # 검증 수행
        local passed=true

        # contains 검증
        local contains_count
        contains_count=$(jq ".tests[$i].expect.contains | length // 0" "$json_file")

        for ((j=0; j<contains_count; j++)); do
            local expected
            expected=$(jq -r ".tests[$i].expect.contains[$j]" "$json_file")

            if ! assert_contains "$result" "$expected"; then
                test_fail "포함되어야 함: $expected"
                passed=false
                break
            fi
        done

        # contains_any 검증
        if [[ "$passed" == "true" ]]; then
            local contains_any_count
            contains_any_count=$(jq ".tests[$i].expect.contains_any | length // 0" "$json_file")

            if [[ "$contains_any_count" -gt 0 ]]; then
                local found=false
                local options=""

                for ((j=0; j<contains_any_count; j++)); do
                    local option
                    option=$(jq -r ".tests[$i].expect.contains_any[$j]" "$json_file")
                    options="$options \"$option\""

                    if assert_contains "$result" "$option"; then
                        found=true
                        break
                    fi
                done

                if [[ "$found" == "false" ]]; then
                    test_fail "다음 중 하나 포함되어야 함:$options"
                    passed=false
                fi
            fi
        fi

        # not_contains 검증
        if [[ "$passed" == "true" ]]; then
            local not_contains_count
            not_contains_count=$(jq ".tests[$i].expect.not_contains | length // 0" "$json_file")

            for ((j=0; j<not_contains_count; j++)); do
                local forbidden
                forbidden=$(jq -r ".tests[$i].expect.not_contains[$j]" "$json_file")

                if ! assert_not_contains "$result" "$forbidden"; then
                    test_fail "포함되면 안됨: $forbidden"
                    passed=false
                    break
                fi
            done
        fi

        # pattern (정규식) 검증
        if [[ "$passed" == "true" ]]; then
            local pattern
            pattern=$(jq -r ".tests[$i].expect.pattern // empty" "$json_file")

            if [[ -n "$pattern" ]]; then
                if ! assert_matches "$result" "$pattern"; then
                    test_fail "패턴 불일치: $pattern"
                    passed=false
                fi
            fi
        fi

        if [[ "$passed" == "true" ]]; then
            test_pass
        fi
    done
}

#######################################
# 메인 함수
#######################################
main() {
    parse_args "$@"

    echo -e "${CYAN}========================================"
    echo -e "  SEMO Test Framework"
    echo -e "  Claude Code 기반 Agent/Skill 테스트"
    echo -e "========================================${NC}"

    # 의존성 확인: jq만 필요
    if ! command -v jq &> /dev/null; then
        echo -e "${RED}[ERROR] jq가 설치되어 있지 않습니다.${NC}"
        echo "설치: brew install jq (macOS) 또는 apt install jq (Linux)"
        exit 1
    fi

    if [[ "$DRY_RUN" != "true" ]]; then
        if ! command -v claude &> /dev/null; then
            echo -e "${RED}[ERROR] Claude Code CLI가 설치되어 있지 않습니다.${NC}"
            echo "설치: npm install -g @anthropic-ai/claude-code"
            exit 1
        fi
    fi

    # 결과 디렉토리 생성
    mkdir -p "$RESULTS_DIR"

    # 테스트 파일 수집 (JSON만)
    local test_files=()

    if [[ -n "$TARGET_FILE" ]]; then
        # 특정 파일 지정
        local target_path="$CASES_DIR/${TARGET_FILE}.json"
        if [[ -f "$target_path" ]]; then
            test_files+=("$target_path")
        else
            echo -e "${RED}[ERROR] 테스트 파일을 찾을 수 없음: $target_path${NC}"
            exit 1
        fi
    else
        # 모든 JSON 파일
        while IFS= read -r -d '' file; do
            test_files+=("$file")
        done < <(find "$CASES_DIR" -name "*.json" -print0 2>/dev/null)
    fi

    if [[ ${#test_files[@]} -eq 0 ]]; then
        echo -e "${YELLOW}테스트 파일이 없습니다.${NC}"
        echo "테스트 케이스를 $CASES_DIR/ 에 추가하세요. (JSON 형식)"
        exit 0
    fi

    echo ""
    echo "테스트 파일: ${#test_files[@]} 개"

    if [[ "$DRY_RUN" == "true" ]]; then
        echo -e "${YELLOW}[DRY-RUN 모드] 실제 Claude 호출 없음${NC}"
    fi

    # 각 테스트 파일 실행
    for file in "${test_files[@]}"; do
        run_test_file "$file"
    done

    # 결과 요약
    print_summary
    local exit_code=$?

    # 비용 출력
    if [[ "$DRY_RUN" != "true" ]]; then
        echo ""
        echo -e "총 비용: \$${TOTAL_COST}"
    fi

    # 결과 저장
    local timestamp
    timestamp=$(date +%Y%m%d_%H%M%S)
    local result_file="$RESULTS_DIR/result_${timestamp}.json"

    cat > "$result_file" << EOF
{
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "passed": $TESTS_PASSED,
  "failed": $TESTS_FAILED,
  "skipped": $TESTS_SKIPPED,
  "total_cost_usd": $TOTAL_COST
}
EOF

    echo "결과 저장: $result_file"

    exit $exit_code
}

main "$@"
