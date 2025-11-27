#!/bin/bash

# SAX 패키지 설치 스크립트
# 사용법: ./install-sax.sh [패키지] [옵션]
# 패키지: po, next, meta
# 옵션: --force, --update
# 예시: ./install-sax.sh po
#       ./install-sax.sh po --force

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 설정
SAX_GITHUB_ORG="semicolon-devteam"
SAX_CORE_REPO="sax-core"
CLAUDE_DIR=".claude"
FORCE_MODE=false
UPDATE_MODE=false

# 출력 함수
print_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  SAX 패키지 설치 스크립트${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo ""
}

print_step() {
    echo -e "${YELLOW}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_prompt() {
    echo -e -n "${CYAN}? $1${NC}"
}

show_usage() {
    echo "사용법: $0 [패키지] [옵션]"
    echo ""
    echo "사용 가능한 패키지:"
    echo "  po      - SAX-PO (PO/기획자용)"
    echo "  next    - SAX-Next (Next.js 개발자용)"
    echo "  meta    - SAX-Meta (SAX 패키지 관리자용)"
    echo ""
    echo "옵션:"
    echo "  --force, -f   - 기존 설치 삭제 후 재설치"
    echo "  --update, -u  - 기존 설치를 최신 버전으로 업데이트"
    echo "  --help, -h    - 도움말 표시"
    echo ""
    echo "예시:"
    echo "  $0 po              # sax-po 설치"
    echo "  $0 next --force    # sax-next 강제 재설치"
    echo "  $0 meta --update   # sax-meta 최신 버전 업데이트"
    echo ""
}

check_prerequisites() {
    print_step "사전 요구사항 확인 중..."

    # git 확인
    if ! command -v git &> /dev/null; then
        print_error "git이 설치되어 있지 않습니다. git을 먼저 설치해주세요."
        exit 1
    fi
    print_success "git 확인됨"

    # git 저장소 확인
    if ! git rev-parse --is-inside-work-tree &> /dev/null; then
        print_error "git 저장소가 아닙니다. 먼저 git init을 실행해주세요."
        exit 1
    fi
    print_success "git 저장소 확인됨"

    # GitHub CLI 확인 (선택사항)
    if command -v gh &> /dev/null; then
        print_success "GitHub CLI 확인됨 (선택사항)"
    else
        print_info "GitHub CLI 미설치 (선택사항, private repo 접근 시 필요)"
    fi
}

create_claude_dir() {
    print_step ".claude 디렉토리 생성 중..."

    if [ -d "$CLAUDE_DIR" ]; then
        print_info ".claude 디렉토리가 이미 존재합니다"
    else
        mkdir -p "$CLAUDE_DIR"
        print_success ".claude 디렉토리 생성 완료"
    fi
}

# git index에 등록되어 있는지 확인
is_in_git_index() {
    local path=$1
    git ls-files --stage "$path" 2>/dev/null | grep -q . && return 0
    git config --file .gitmodules --get-regexp "submodule\..*\.path" 2>/dev/null | grep -q "$path" && return 0
    return 1
}

# 서브모듈 완전 삭제
remove_submodule() {
    local path=$1

    print_step "기존 서브모듈 삭제 중: $path"

    # 1. git submodule deinit으로 안전하게 해제
    git submodule deinit -f "$path" 2>/dev/null || true

    # 2. .gitmodules에서 삭제
    if [ -f ".gitmodules" ]; then
        git config --file .gitmodules --remove-section "submodule.$path" 2>/dev/null || true
        # .gitmodules가 비어있으면 삭제
        if [ ! -s ".gitmodules" ]; then
            rm -f ".gitmodules"
            git rm -f --cached .gitmodules 2>/dev/null || true
        else
            git add .gitmodules 2>/dev/null || true
        fi
    fi

    # 3. .git/config에서 삭제
    git config --remove-section "submodule.$path" 2>/dev/null || true

    # 4. git rm으로 index에서 삭제
    git rm -rf --cached "$path" 2>/dev/null || true

    # 5. 디렉토리 삭제
    rm -rf "$path"

    # 6. .git/modules에서 삭제
    rm -rf ".git/modules/$path" 2>/dev/null || true

    # 7. 최종 확인 - index에서 해당 경로의 모든 항목 강제 삭제
    git ls-files --stage "$path" 2>/dev/null | while read -r mode hash stage file; do
        git update-index --force-remove "$file" 2>/dev/null || true
    done

    # 8. 혹시 남아있는 160000 (gitlink) 엔트리 삭제
    git update-index --force-remove "$path" 2>/dev/null || true

    print_success "서브모듈 삭제 완료: $path"
}

handle_existing_installation() {
    local path=$1
    local name=$2

    if [ -d "$path" ] || is_in_git_index "$path"; then
        echo ""
        print_warning "$name 이(가) 이미 존재합니다: $path"

        if [ "$FORCE_MODE" = true ]; then
            print_info "강제 모드: 기존 설치를 삭제합니다..."
            remove_submodule "$path"
            return 0  # 새로 설치 진행
        elif [ "$UPDATE_MODE" = true ]; then
            print_info "업데이트 모드: 최신 버전으로 업데이트합니다..."
            if [ -d "$path" ]; then
                cd "$path"
                git fetch origin main
                git reset --hard origin/main
                cd - > /dev/null
                print_success "$name 업데이트 완료"
            fi
            return 1  # 설치 건너뜀
        else
            echo ""
            echo "  선택 옵션:"
            echo "    1) 업데이트 - 최신 버전으로 업데이트"
            echo "    2) 재설치 - 삭제 후 새로 설치 (클린)"
            echo "    3) 건너뛰기 - 기존 설치 유지"
            echo "    4) 취소 - 설치 중단"
            echo ""
            print_prompt "옵션을 선택하세요 [1-4]: "
            read -r choice

            case "$choice" in
                1)
                    print_step "$name 업데이트 중..."
                    if [ -d "$path" ]; then
                        cd "$path"
                        git fetch origin main
                        git reset --hard origin/main
                        cd - > /dev/null
                        print_success "$name 업데이트 완료"
                    else
                        print_warning "디렉토리가 없습니다. 재설치를 진행합니다"
                        remove_submodule "$path"
                        return 0
                    fi
                    return 1  # 새 설치 건너뜀
                    ;;
                2)
                    remove_submodule "$path"
                    return 0  # 새로 설치 진행
                    ;;
                3)
                    print_info "$name 설치를 건너뜁니다"
                    return 1  # 설치 건너뜀
                    ;;
                4|*)
                    print_error "설치가 취소되었습니다"
                    exit 1
                    ;;
            esac
        fi
    fi

    return 0  # 기존 설치 없음, 새로 설치 진행
}

install_sax_core() {
    print_step "sax-core 설치 중..."

    local core_path="$CLAUDE_DIR/sax-core"

    if handle_existing_installation "$core_path" "sax-core"; then
        # 서브모듈로 추가
        git submodule add "https://github.com/$SAX_GITHUB_ORG/$SAX_CORE_REPO.git" "$core_path"
        print_success "sax-core 서브모듈 설치 완료"
    fi
}

install_sax_package() {
    local package=$1
    local repo_name="sax-$package"
    local package_path="$CLAUDE_DIR/$repo_name"

    print_step "$repo_name 설치 중..."

    if handle_existing_installation "$package_path" "$repo_name"; then
        # 서브모듈로 추가
        git submodule add "https://github.com/$SAX_GITHUB_ORG/$repo_name.git" "$package_path"
        print_success "$repo_name 서브모듈 설치 완료"
    fi
}

setup_symlinks() {
    local package=$1
    local repo_name="sax-$package"
    local package_path="$CLAUDE_DIR/$repo_name"

    print_step "$repo_name 심링크 설정 중..."

    # CLAUDE.md 심링크
    if [ -f "$package_path/CLAUDE.md" ]; then
        local claude_md_link="$CLAUDE_DIR/CLAUDE.md"

        if [ -L "$claude_md_link" ]; then
            rm "$claude_md_link"
        elif [ -f "$claude_md_link" ]; then
            print_info "기존 CLAUDE.md를 CLAUDE.md.backup으로 백업합니다"
            mv "$claude_md_link" "$claude_md_link.backup"
        fi

        ln -s "$repo_name/CLAUDE.md" "$claude_md_link"
        print_success "심링크 생성: CLAUDE.md -> $repo_name/CLAUDE.md"
    fi

    # agents 심링크
    if [ -d "$package_path/agents" ]; then
        local agents_link="$CLAUDE_DIR/agents"

        if [ -L "$agents_link" ]; then
            rm "$agents_link"
        elif [ -d "$agents_link" ]; then
            print_info "기존 agents/를 agents.backup/으로 백업합니다"
            mv "$agents_link" "$agents_link.backup"
        fi

        ln -s "$repo_name/agents" "$agents_link"
        print_success "심링크 생성: agents/ -> $repo_name/agents/"
    fi

    # skills 심링크
    if [ -d "$package_path/skills" ]; then
        local skills_link="$CLAUDE_DIR/skills"

        if [ -L "$skills_link" ]; then
            rm "$skills_link"
        elif [ -d "$skills_link" ]; then
            print_info "기존 skills/를 skills.backup/으로 백업합니다"
            mv "$skills_link" "$skills_link.backup"
        fi

        ln -s "$repo_name/skills" "$skills_link"
        print_success "심링크 생성: skills/ -> $repo_name/skills/"
    fi

    # commands 심링크 (.claude/SAX/commands 로 생성)
    if [ -d "$package_path/commands" ]; then
        # SAX 디렉토리 생성
        local sax_dir="$CLAUDE_DIR/SAX"
        mkdir -p "$sax_dir"

        local commands_link="$sax_dir/commands"

        if [ -L "$commands_link" ]; then
            rm "$commands_link"
        elif [ -d "$commands_link" ]; then
            print_info "기존 SAX/commands/를 SAX/commands.backup/으로 백업합니다"
            mv "$commands_link" "$commands_link.backup"
        fi

        ln -s "../$repo_name/commands" "$commands_link"
        print_success "심링크 생성: SAX/commands/ -> $repo_name/commands/"
    fi
}

print_summary() {
    local package=$1

    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  설치 완료!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "설치된 구조:"
    echo ""
    echo "  .claude/"
    echo "  ├── CLAUDE.md -> sax-$package/CLAUDE.md"
    echo "  ├── agents/ -> sax-$package/agents/"
    echo "  ├── skills/ -> sax-$package/skills/"
    echo "  ├── SAX/"
    echo "  │   └── commands/ -> sax-$package/commands/"
    echo "  ├── sax-core/          (서브모듈)"
    echo "  └── sax-$package/      (서브모듈)"
    echo ""
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  다음 단계${NC}"
    echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "  이제 Claude Code를 실행하고 다음과 같이 말해보세요:"
    echo ""
    echo -e "    ${YELLOW}\"SAX init 커밋해줘\"${NC}"
    echo ""
    echo "  Claude가 자동으로 SAX 설치 커밋을 생성하고 푸시합니다."
    echo ""
    echo "나중에 SAX 패키지 업데이트:"
    echo "  git submodule update --remote"
    echo "  # 또는"
    echo "  ./install-sax.sh $package --update"
    echo ""
}

# 패키지 선택 메뉴
select_package() {
    echo ""
    echo "설치할 패키지를 선택하세요:"
    echo ""
    echo "  1) sax-po    - PO/기획자용"
    echo "                 기획 문서 작성, PRD 생성, 요구사항 정리"
    echo ""
    echo "  2) sax-next  - Next.js 개발자용"
    echo "                 Next.js 프로젝트 개발 지원"
    echo ""
    echo "  3) sax-meta  - SAX 패키지 관리자용"
    echo "                 SAX 패키지 개발 및 관리"
    echo ""
    echo "  q) 취소"
    echo ""
    print_prompt "선택 [1-3]: "
    read -r choice

    case "$choice" in
        1)
            PACKAGE="po"
            ;;
        2)
            PACKAGE="next"
            ;;
        3)
            PACKAGE="meta"
            ;;
        q|Q)
            print_info "설치를 취소합니다"
            exit 0
            ;;
        *)
            print_error "잘못된 선택입니다"
            exit 1
            ;;
    esac
}

# 인자 파싱
parse_args() {
    PACKAGE=""

    while [ $# -gt 0 ]; do
        case "$1" in
            --force|-f)
                FORCE_MODE=true
                shift
                ;;
            --update|-u)
                UPDATE_MODE=true
                shift
                ;;
            --help|-h)
                show_usage
                exit 0
                ;;
            po|next|meta)
                PACKAGE=$1
                shift
                ;;
            *)
                print_error "알 수 없는 옵션: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    # 패키지 미지정 시 선택 메뉴 표시
    if [ -z "$PACKAGE" ]; then
        select_package
    fi
}

# 메인 함수
main() {
    print_header

    parse_args "$@"

    print_info "선택된 패키지: sax-$PACKAGE"

    if [ "$FORCE_MODE" = true ]; then
        print_warning "강제 모드 활성화 - 기존 설치를 삭제합니다"
    fi

    if [ "$UPDATE_MODE" = true ]; then
        print_info "업데이트 모드 활성화 - 최신 버전으로 업데이트합니다"
    fi

    # 설치 단계 실행
    check_prerequisites
    create_claude_dir
    install_sax_core
    install_sax_package "$PACKAGE"
    setup_symlinks "$PACKAGE"
    print_summary "$PACKAGE"
}

main "$@"
