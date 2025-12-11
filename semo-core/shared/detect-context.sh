#!/bin/bash
#
# SEMO Platform Auto-Detection
#
# 프로젝트 파일 기반으로 플랫폼을 자동 감지합니다.
#
# 사용법:
#   ./detect-context.sh [project_dir]
#
# 출력:
#   nextjs | spring | microservice | mvp
#
# 예시:
#   platform=$(./detect-context.sh /path/to/project)
#   echo "Detected platform: $platform"
#

set -e

# 프로젝트 디렉토리 (기본값: 현재 디렉토리)
PROJECT_DIR="${1:-.}"

#######################################
# 플랫폼 감지 함수
#######################################
detect_platform() {
    local dir="$1"

    # Next.js 감지
    if [ -f "$dir/next.config.js" ] || [ -f "$dir/next.config.ts" ] || [ -f "$dir/next.config.mjs" ]; then
        echo "nextjs"
        return 0
    fi

    # Spring/Java 감지
    if [ -f "$dir/pom.xml" ] || [ -f "$dir/build.gradle" ] || [ -f "$dir/build.gradle.kts" ]; then
        echo "spring"
        return 0
    fi

    # Microservice 감지 (docker-compose + 특정 키워드)
    if [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/docker-compose.yaml" ]; then
        if grep -qE "(microservice|service-discovery|api-gateway)" "$dir/docker-compose.yml" 2>/dev/null || \
           grep -qE "(microservice|service-discovery|api-gateway)" "$dir/docker-compose.yaml" 2>/dev/null; then
            echo "microservice"
            return 0
        fi
    fi

    # Python/FastAPI 감지
    if [ -f "$dir/requirements.txt" ] && grep -q "fastapi\|flask\|django" "$dir/requirements.txt" 2>/dev/null; then
        echo "python"
        return 0
    fi

    # Go 감지
    if [ -f "$dir/go.mod" ]; then
        echo "go"
        return 0
    fi

    # Rust 감지
    if [ -f "$dir/Cargo.toml" ]; then
        echo "rust"
        return 0
    fi

    # React (non-Next.js) 감지
    if [ -f "$dir/package.json" ]; then
        if grep -q '"react"' "$dir/package.json" 2>/dev/null && \
           ! grep -q '"next"' "$dir/package.json" 2>/dev/null; then
            echo "react"
            return 0
        fi
    fi

    # 기본값: MVP
    echo "mvp"
    return 0
}

#######################################
# 추가 컨텍스트 감지 (선택적)
#######################################
detect_additional_context() {
    local dir="$1"
    local context=""

    # TypeScript 사용 여부
    if [ -f "$dir/tsconfig.json" ]; then
        context="${context}typescript,"
    fi

    # Monorepo 여부
    if [ -f "$dir/pnpm-workspace.yaml" ] || [ -f "$dir/lerna.json" ] || [ -d "$dir/packages" ]; then
        context="${context}monorepo,"
    fi

    # Docker 사용 여부
    if [ -f "$dir/Dockerfile" ] || [ -f "$dir/docker-compose.yml" ]; then
        context="${context}docker,"
    fi

    # CI/CD 감지
    if [ -d "$dir/.github/workflows" ]; then
        context="${context}github-actions,"
    fi

    # 마지막 쉼표 제거
    echo "${context%,}"
}

#######################################
# 메인
#######################################
main() {
    if [ ! -d "$PROJECT_DIR" ]; then
        echo "Error: Directory not found: $PROJECT_DIR" >&2
        exit 1
    fi

    # --verbose 옵션 처리
    if [ "$2" = "--verbose" ] || [ "$2" = "-v" ]; then
        local platform
        platform=$(detect_platform "$PROJECT_DIR")
        local additional
        additional=$(detect_additional_context "$PROJECT_DIR")

        echo "platform: $platform"
        [ -n "$additional" ] && echo "context: $additional"
    else
        detect_platform "$PROJECT_DIR"
    fi
}

main "$@"
