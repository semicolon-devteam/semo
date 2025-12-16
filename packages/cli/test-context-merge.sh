#!/bin/bash
# 컨텍스트 분배 병합 테스트
# 새로 추가된 세미콜론 컨텍스트가 각 그룹 CLAUDE.md에 포함되었는지 확인

set -e

SEMO_ROOT="/Users/reus/Desktop/Sources/semicolon/semo"
TEST_DIR="/tmp/semo-context-test"

echo "========================================"
echo "세미콜론 컨텍스트 분배 병합 테스트"
echo "========================================"
echo ""

# 유틸리티 함수
check_contains() {
  local file="$1"
  local pattern="$2"
  local description="$3"

  if grep -q "$pattern" "$file" 2>/dev/null; then
    echo "  ✅ $description"
    return 0
  else
    echo "  ❌ $description"
    return 1
  fi
}

cleanup() {
  rm -rf "$TEST_DIR"
}

# 병합 함수 - CLI 로직 시뮬레이션
do_merge() {
  local test_name="$1"
  shift
  local groups="$@"

  local dest="$TEST_DIR/$test_name"
  mkdir -p "$dest"

  local merged="$dest/CLAUDE.md"
  echo "# SEMO Project Configuration" > "$merged"
  echo "" >> "$merged"

  # 그룹 CLAUDE.md 병합 (헤더 레벨 조정)
  for group in $groups; do
    local group_src="$SEMO_ROOT/packages/$group/CLAUDE.md"
    if [ -f "$group_src" ]; then
      echo "---" >> "$merged"
      echo "" >> "$merged"
      # 헤더 레벨 조정: # → ##, ## → ###, ### → ####
      cat "$group_src" | \
        sed 's/^### /#### /g' | \
        sed 's/^## /### /g' | \
        sed 's/^# /## /g' >> "$merged"
      echo "" >> "$merged"
    fi
  done
}

total_errors=0

# 테스트 1: eng 그룹 - 세미콜론 개발 컨텍스트 확인
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "테스트 1: eng 그룹 - 세미콜론 개발 컨텍스트"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

cleanup
mkdir -p "$TEST_DIR"
do_merge "test1" "eng"

errors=0
claude_md="$TEST_DIR/test1/CLAUDE.md"

check_contains "$claude_md" "세미콜론 개발 컨텍스트" "세미콜론 컨텍스트 섹션" || errors=$((errors + 1))
check_contains "$claude_md" "아키텍처 마이그레이션" "아키텍처 전환 현황" || errors=$((errors + 1))
check_contains "$claude_md" "core-backend" "코어 레포지토리 (core-backend)" || errors=$((errors + 1))
check_contains "$claude_md" "core-interface" "코어 레포지토리 (core-interface)" || errors=$((errors + 1))
check_contains "$claude_md" "스키마 임의 수정 금지" "코어 스키마 규칙" || errors=$((errors + 1))
check_contains "$claude_md" "Supabase 환경별 접근" "Supabase 분기" || errors=$((errors + 1))
check_contains "$claude_md" "On-Premise" "On-Premise 환경" || errors=$((errors + 1))
check_contains "$claude_md" "https://dev.{service}.com" "환경별 URL 패턴" || errors=$((errors + 1))
check_contains "$claude_md" "github.com/semicolon-devteam?q=cm" "동적 프로젝트 조회 링크" || errors=$((errors + 1))

echo "  결과: $errors 에러"
total_errors=$((total_errors + errors))

# 테스트 2: biz 그룹 - 프로젝트 컨텍스트 확인
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "테스트 2: biz 그룹 - 프로젝트 컨텍스트"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

do_merge "test2" "biz"

errors=0
claude_md="$TEST_DIR/test2/CLAUDE.md"

check_contains "$claude_md" "세미콜론 프로젝트 컨텍스트" "프로젝트 컨텍스트 섹션" || errors=$((errors + 1))
check_contains "$claude_md" "정식 프로젝트" "정식 프로젝트 유형" || errors=$((errors + 1))
check_contains "$claude_md" "MVP 프로젝트" "MVP 프로젝트 유형" || errors=$((errors + 1))
check_contains "$claude_md" "역할 체계 (SEMO 기준)" "SEMO 역할 체계" || errors=$((errors + 1))
check_contains "$claude_md" "레거시 역할" "레거시 역할 매핑" || errors=$((errors + 1))
check_contains "$claude_md" "github.com/semicolon-devteam?q=cm" "동적 프로젝트 조회" || errors=$((errors + 1))

echo "  결과: $errors 에러"
total_errors=$((total_errors + errors))

# 테스트 3: ops 그룹 - 운영 컨텍스트 확인
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "테스트 3: ops 그룹 - 운영 컨텍스트"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

do_merge "test3" "ops"

errors=0
claude_md="$TEST_DIR/test3/CLAUDE.md"

check_contains "$claude_md" "세미콜론 운영 컨텍스트" "운영 컨텍스트 섹션" || errors=$((errors + 1))
check_contains "$claude_md" "테스트 환경" "테스트 환경 섹션" || errors=$((errors + 1))
check_contains "$claude_md" "QA 프로세스" "QA 프로세스" || errors=$((errors + 1))
check_contains "$claude_md" "테스트 요청 시 포함 정보" "테스트 요청 템플릿" || errors=$((errors + 1))
check_contains "$claude_md" "core-interface-ashen.vercel.app" "API 문서 링크" || errors=$((errors + 1))
check_contains "$claude_md" "github.com/semicolon-devteam/core-interface/releases" "릴리즈 노트 링크" || errors=$((errors + 1))

echo "  결과: $errors 에러"
total_errors=$((total_errors + errors))

# 테스트 4: 3개 그룹 전체 병합
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "테스트 4: 3개 그룹 전체 병합"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

do_merge "test4" "biz eng ops"

errors=0
claude_md="$TEST_DIR/test4/CLAUDE.md"

check_contains "$claude_md" "세미콜론 프로젝트 컨텍스트" "biz 컨텍스트 포함" || errors=$((errors + 1))
check_contains "$claude_md" "세미콜론 개발 컨텍스트" "eng 컨텍스트 포함" || errors=$((errors + 1))
check_contains "$claude_md" "세미콜론 운영 컨텍스트" "ops 컨텍스트 포함" || errors=$((errors + 1))

# 중복 체크
biz_count=$(grep -c "세미콜론 프로젝트 컨텍스트" "$claude_md" || echo "0")
eng_count=$(grep -c "세미콜론 개발 컨텍스트" "$claude_md" || echo "0")
ops_count=$(grep -c "세미콜론 운영 컨텍스트" "$claude_md" || echo "0")

if [ "$biz_count" = "1" ] && [ "$eng_count" = "1" ] && [ "$ops_count" = "1" ]; then
  echo "  ✅ 각 컨텍스트 1회씩 (중복 없음)"
else
  echo "  ❌ 중복 발생 - biz:$biz_count, eng:$eng_count, ops:$ops_count"
  errors=$((errors + 1))
fi

echo "  결과: $errors 에러"
total_errors=$((total_errors + errors))

# 결과 요약
echo ""
echo "========================================"
echo "전체 테스트 결과"
echo "========================================"
if [ "$total_errors" = "0" ]; then
  echo "✅ 모든 테스트 통과!"
else
  echo "❌ 총 $total_errors 에러 발생"
fi
echo ""

# 정리
cleanup

exit $total_errors
