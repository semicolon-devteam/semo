#!/bin/bash

# SAX 패키지 설치 스크립트
# 사용법: ./install-sax.sh [패키지] [옵션]
# 패키지: po, next, qa, meta
# 옵션: --force, --update
# 예시: ./install-sax.sh po
#       ./install-sax.sh qa --force

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
OS_TYPE=""

# OS 감지 함수
# Windows는 MSYS, MinGW, Cygwin, Git Bash 등으로 실행됨
detect_os() {
    case "$(uname -s)" in
        Linux*)     OS_TYPE="Linux";;
        Darwin*)    OS_TYPE="macOS";;
        CYGWIN*)    OS_TYPE="Windows";;
        MINGW*)     OS_TYPE="Windows";;
        MSYS*)      OS_TYPE="Windows";;
        *)          OS_TYPE="Unknown";;
    esac
}

# 심링크 또는 복사 수행
# Windows에서는 심링크 대신 복사 사용 (관리자 권한/개발자 모드 불필요)
create_link_or_copy() {
    local source=$1
    local target=$2
    local display_source=$3  # 출력용 상대 경로

    if [ "$OS_TYPE" = "Windows" ]; then
        # Windows: 복사 사용
        if [ -d "$source" ]; then
            cp -r "$source" "$target"
        else
            cp "$source" "$target"
        fi
        print_success "복사 완료: $target (Windows 모드)"
    else
        # Linux/macOS: 심링크 사용
        ln -s "$display_source" "$target"
        print_success "심링크 생성: $target -> $display_source"
    fi
}

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
    echo "  qa      - SAX-QA (QA 테스터용)"
    echo "  meta    - SAX-Meta (SAX 패키지 관리자용)"
    echo "  pm      - SAX-PM (PM/프로젝트 매니저용)"
    echo "  backend - SAX-Backend (백엔드 개발자용)"
    echo "  infra   - SAX-Infra (인프라/DevOps용)"
    echo ""
    echo "옵션:"
    echo "  --force, -f   - 기존 설치 삭제 후 재설치"
    echo "  --update, -u  - 기존 설치를 최신 버전으로 업데이트"
    echo "  --help, -h    - 도움말 표시"
    echo ""
    echo "예시:"
    echo "  $0 po              # sax-po 설치"
    echo "  $0 qa --force      # sax-qa 강제 재설치"
    echo "  $0 next --force    # sax-next 강제 재설치"
    echo "  $0 meta --update   # sax-meta 최신 버전 업데이트"
    echo "  $0 pm              # sax-pm 설치"
    echo "  $0 backend         # sax-backend 설치"
    echo "  $0 infra           # sax-infra 설치"
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
    local core_path="$CLAUDE_DIR/sax-core"

    if [ "$OS_TYPE" = "Windows" ]; then
        print_step "$repo_name 병합 설정 중... (Windows 모드)"
    else
        print_step "$repo_name + sax-core 병합 심링크 설정 중..."
    fi

    # CLAUDE.md 심링크/복사 (패키지 것 사용)
    if [ -f "$package_path/CLAUDE.md" ]; then
        local claude_md_link="$CLAUDE_DIR/CLAUDE.md"

        if [ -L "$claude_md_link" ]; then
            rm "$claude_md_link"
        elif [ -f "$claude_md_link" ]; then
            print_info "기존 CLAUDE.md를 CLAUDE.md.backup으로 백업합니다"
            mv "$claude_md_link" "$claude_md_link.backup"
        fi

        create_link_or_copy "$package_path/CLAUDE.md" "$claude_md_link" "$repo_name/CLAUDE.md"
    fi

    # agents 병합 (실제 디렉토리 생성 후 개별 심링크)
    setup_merged_dir "agents" "$package" "$core_path" "$package_path"

    # skills 병합 (실제 디렉토리 생성 후 개별 심링크)
    setup_merged_dir "skills" "$package" "$core_path" "$package_path"

    # commands/SAX 병합 (sax-core 기본 + 패키지 우선)
    setup_merged_commands "$package" "$core_path" "$package_path"
}

# 병합 commands/SAX 설정 (sax-core 기본 + 패키지 우선)
setup_merged_commands() {
    local package=$1
    local core_path=$2
    local package_path=$3

    local commands_dir="$CLAUDE_DIR/commands"
    local target_dir="$commands_dir/SAX"

    # commands 상위 디렉토리 생성
    mkdir -p "$commands_dir"

    # 기존 심링크 또는 디렉토리 처리
    if [ -L "$target_dir" ]; then
        rm "$target_dir"
    elif [ -d "$target_dir" ]; then
        # 기존 병합 디렉토리면 내부 심링크/파일만 삭제
        if [ -f "$target_dir/.merged" ]; then
            find "$target_dir" -maxdepth 1 -type l -delete
            find "$target_dir" -maxdepth 1 -type f ! -name ".merged" -delete
        else
            print_info "기존 commands/SAX/를 commands/SAX.backup/으로 백업합니다"
            mv "$target_dir" "$target_dir.backup"
        fi
    fi

    # 병합 디렉토리 생성
    mkdir -p "$target_dir"
    touch "$target_dir/.merged"

    # 1. sax-core commands 심링크 (기본)
    if [ -d "$core_path/commands/SAX" ]; then
        for item in "$core_path/commands/SAX/"*.md; do
            if [ -f "$item" ]; then
                local name=$(basename "$item")
                local item_link="$target_dir/$name"

                if [ "$OS_TYPE" = "Windows" ]; then
                    cp "$item" "$item_link"
                    print_success "  [core] $name 복사됨"
                else
                    ln -s "../../sax-core/commands/SAX/$name" "$item_link"
                    print_success "  [core] $name -> sax-core/commands/SAX/$name"
                fi
            fi
        done
    fi

    # 2. 패키지 commands 심링크 (덮어쓰기)
    if [ -d "$package_path/commands/SAX" ]; then
        for item in "$package_path/commands/SAX/"*.md; do
            if [ -f "$item" ]; then
                local name=$(basename "$item")
                local item_link="$target_dir/$name"

                # core 것이 있으면 삭제 (패키지 우선)
                if [ -L "$item_link" ] || [ -f "$item_link" ]; then
                    rm -f "$item_link"
                fi

                if [ "$OS_TYPE" = "Windows" ]; then
                    cp "$item" "$item_link"
                    print_success "  [pkg] $name 복사됨 (우선)"
                else
                    ln -s "../../sax-$package/commands/SAX/$name" "$item_link"
                    print_success "  [pkg] $name -> sax-$package/commands/SAX/$name"
                fi
            fi
        done
    fi
}

# 병합 디렉토리 설정 (sax-core 기본 + 패키지 우선)
setup_merged_dir() {
    local dir_type=$1    # "agents" or "skills"
    local package=$2
    local core_path=$3
    local package_path=$4

    local target_dir="$CLAUDE_DIR/$dir_type"

    # 기존 심링크 또는 디렉토리 처리
    if [ -L "$target_dir" ]; then
        rm "$target_dir"
    elif [ -d "$target_dir" ]; then
        # 기존 병합 디렉토리면 내부 심링크만 삭제
        if [ -f "$target_dir/.merged" ]; then
            find "$target_dir" -maxdepth 1 -type l -delete
        else
            print_info "기존 $dir_type/를 $dir_type.backup/으로 백업합니다"
            mv "$target_dir" "$target_dir.backup"
        fi
    fi

    # 병합 디렉토리 생성
    mkdir -p "$target_dir"
    touch "$target_dir/.merged"

    # 1. sax-core 컴포넌트 심링크 (기본)
    if [ -d "$core_path/$dir_type" ]; then
        for item in "$core_path/$dir_type/"*/; do
            if [ -d "$item" ]; then
                local name=$(basename "$item")
                local item_link="$target_dir/$name"

                if [ "$OS_TYPE" = "Windows" ]; then
                    cp -r "$item" "$item_link"
                    print_success "  [core] $name 복사됨"
                else
                    ln -s "../sax-core/$dir_type/$name" "$item_link"
                    print_success "  [core] $name -> sax-core/$dir_type/$name"
                fi
            fi
        done
    fi

    # 2. 패키지 컴포넌트 심링크 (덮어쓰기)
    if [ -d "$package_path/$dir_type" ]; then
        for item in "$package_path/$dir_type/"*/; do
            if [ -d "$item" ]; then
                local name=$(basename "$item")
                local item_link="$target_dir/$name"

                # core 것이 있으면 삭제 (패키지 우선)
                if [ -L "$item_link" ] || [ -d "$item_link" ]; then
                    rm -rf "$item_link"
                fi

                if [ "$OS_TYPE" = "Windows" ]; then
                    cp -r "$item" "$item_link"
                    print_success "  [pkg] $name 복사됨 (우선)"
                else
                    ln -s "../sax-$package/$dir_type/$name" "$item_link"
                    print_success "  [pkg] $name -> sax-$package/$dir_type/$name"
                fi
            fi
        done
    fi
}

print_summary() {
    local package=$1

    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  설치 완료!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "설치된 구조 (병합 모드):"
    echo ""

    if [ "$OS_TYPE" = "Windows" ]; then
        # Windows: 복사 모드
        echo "  .claude/"
        echo "  ├── CLAUDE.md              (패키지 복사)"
        echo "  ├── agents/                (병합 디렉토리)"
        echo "  │   ├── orchestrator/      [pkg] sax-$package"
        echo "  │   ├── compliance-checker/[core] sax-core"
        echo "  │   └── .../"
        echo "  ├── skills/                (병합 디렉토리)"
        echo "  │   ├── version-updater/   [core] sax-core"
        echo "  │   └── .../"
        echo "  ├── commands/SAX/          (병합 디렉토리)"
        echo "  │   ├── help.md            [core] sax-core"
        echo "  │   ├── slack.md           [core] sax-core"
        echo "  │   └── .../"
        echo "  ├── sax-core/              (서브모듈)"
        echo "  └── sax-$package/          (서브모듈)"
        echo ""
        echo -e "${YELLOW}⚠ Windows 모드 주의사항:${NC}"
        echo "  - 원본 업데이트 후 복사본도 갱신이 필요합니다"
        echo "  - 업데이트: ./install-sax.sh $package --update"
    else
        # Linux/macOS: 심링크 병합 모드
        echo "  .claude/"
        echo "  ├── CLAUDE.md -> sax-$package/CLAUDE.md"
        echo "  ├── agents/                    (병합 디렉토리)"
        echo "  │   ├── orchestrator/          -> sax-$package/agents/..."
        echo "  │   ├── compliance-checker/    -> sax-core/agents/..."
        echo "  │   └── {패키지별 agent}/      -> sax-$package/agents/..."
        echo "  ├── skills/                    (병합 디렉토리)"
        echo "  │   ├── version-updater/       -> sax-core/skills/..."
        echo "  │   └── {패키지별 skill}/      -> sax-$package/skills/..."
        echo "  ├── commands/SAX/              (병합 디렉토리)"
        echo "  │   ├── help.md                -> sax-core/commands/SAX/..."
        echo "  │   ├── slack.md               -> sax-core/commands/SAX/..."
        echo "  │   └── {패키지별 command}/    -> sax-$package/commands/SAX/..."
        echo "  ├── sax-core/                  (서브모듈, 공통)"
        echo "  └── sax-$package/              (서브모듈, 패키지)"
    fi

    echo ""
    echo -e "${BLUE}병합 규칙:${NC}"
    echo "  - [core] sax-core의 공통 컴포넌트 (compliance-checker, version-updater)"
    echo "  - [pkg]  sax-$package의 패키지별 컴포넌트 (우선 적용)"
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
    echo "  1) sax-po      - PO/기획자용"
    echo "                   기획 문서 작성, PRD 생성, 요구사항 정리"
    echo ""
    echo "  2) sax-next    - Next.js 개발자용"
    echo "                   Next.js 프로젝트 개발 지원"
    echo ""
    echo "  3) sax-qa      - QA 테스터용"
    echo "                   QA 테스트 워크플로우, 이슈 상태 관리"
    echo ""
    echo "  4) sax-meta    - SAX 패키지 관리자용"
    echo "                   SAX 패키지 개발 및 관리"
    echo ""
    echo "  5) sax-pm      - PM/프로젝트 매니저용"
    echo "                   Sprint 관리, 진행도 추적, Roadmap"
    echo ""
    echo "  6) sax-backend - 백엔드 개발자용"
    echo "                   백엔드 API 개발 지원"
    echo ""
    echo "  7) sax-infra   - 인프라/DevOps용"
    echo "                   인프라 구성 및 배포 관리"
    echo ""
    echo "  q) 취소"
    echo ""
    print_prompt "선택 [1-7]: "
    read -r choice

    case "$choice" in
        1)
            PACKAGE="po"
            ;;
        2)
            PACKAGE="next"
            ;;
        3)
            PACKAGE="qa"
            ;;
        4)
            PACKAGE="meta"
            ;;
        5)
            PACKAGE="pm"
            ;;
        6)
            PACKAGE="backend"
            ;;
        7)
            PACKAGE="infra"
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
            po|next|qa|meta|pm|backend|infra)
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

    # OS 감지
    detect_os

    parse_args "$@"

    print_info "선택된 패키지: sax-$PACKAGE"
    print_info "감지된 OS: $OS_TYPE"

    if [ "$OS_TYPE" = "Windows" ]; then
        print_warning "Windows 환경 감지 - 심링크 대신 복사 모드로 설치합니다"
    fi

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
