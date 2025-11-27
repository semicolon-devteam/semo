#!/bin/bash

# SAX Package Installer
# Usage: ./install-sax.sh [package] [options]
# Packages: po, next, meta
# Options: --force, --update
# Example: ./install-sax.sh po
#          ./install-sax.sh po --force

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SAX_GITHUB_ORG="semicolon-devteam"
SAX_CORE_REPO="sax-core"
CLAUDE_DIR=".claude"
FORCE_MODE=false
UPDATE_MODE=false

# Functions
print_header() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  SAX Package Installer${NC}"
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
    echo -e "${CYAN}? $1${NC}"
}

show_usage() {
    echo "Usage: $0 [package] [options]"
    echo ""
    echo "Available packages:"
    echo "  po      - SAX-PO (PO/기획자용)"
    echo "  next    - SAX-Next (Next.js 개발자용)"
    echo "  meta    - SAX-Meta (SAX 패키지 관리자용)"
    echo ""
    echo "Options:"
    echo "  --force   - Remove existing installation and reinstall"
    echo "  --update  - Update existing installation to latest version"
    echo ""
    echo "Examples:"
    echo "  $0 po              # Install sax-po package"
    echo "  $0 next --force    # Force reinstall sax-next"
    echo "  $0 meta --update   # Update sax-meta to latest"
    echo ""
}

ask_user() {
    local prompt=$1
    local default=${2:-n}

    if [ "$default" = "y" ]; then
        prompt="$prompt [Y/n]: "
    else
        prompt="$prompt [y/N]: "
    fi

    print_prompt "$prompt"
    read -r answer

    if [ -z "$answer" ]; then
        answer=$default
    fi

    case "$answer" in
        [Yy]|[Yy][Ee][Ss]) return 0 ;;
        *) return 1 ;;
    esac
}

check_prerequisites() {
    print_step "Checking prerequisites..."

    # Check git
    if ! command -v git &> /dev/null; then
        print_error "git is not installed. Please install git first."
        exit 1
    fi
    print_success "git found"

    # Check if in git repository
    if ! git rev-parse --is-inside-work-tree &> /dev/null; then
        print_error "Not in a git repository. Please initialize git first: git init"
        exit 1
    fi
    print_success "git repository detected"

    # Check GitHub CLI (optional but recommended)
    if command -v gh &> /dev/null; then
        print_success "GitHub CLI found (optional)"
    else
        print_info "GitHub CLI not found (optional, but recommended for private repos)"
    fi
}

create_claude_dir() {
    print_step "Creating .claude directory..."

    if [ -d "$CLAUDE_DIR" ]; then
        print_info ".claude directory already exists"
    else
        mkdir -p "$CLAUDE_DIR"
        print_success "Created .claude directory"
    fi
}

# Check if path is registered in git index (submodule or tracked)
is_in_git_index() {
    local path=$1
    git ls-files --stage "$path" 2>/dev/null | grep -q . && return 0
    git config --file .gitmodules --get-regexp "submodule\..*\.path" 2>/dev/null | grep -q "$path" && return 0
    return 1
}

# Remove submodule completely
remove_submodule() {
    local path=$1
    local name=$(basename "$path")

    print_step "Removing existing submodule: $path"

    # Remove from .gitmodules
    if [ -f ".gitmodules" ]; then
        git config --file .gitmodules --remove-section "submodule.$path" 2>/dev/null || true
        git add .gitmodules 2>/dev/null || true
    fi

    # Remove from .git/config
    git config --remove-section "submodule.$path" 2>/dev/null || true

    # Remove from index
    git rm --cached "$path" 2>/dev/null || true

    # Remove directory
    rm -rf "$path"

    # Remove from .git/modules
    rm -rf ".git/modules/$path" 2>/dev/null || true

    print_success "Removed submodule: $path"
}

handle_existing_installation() {
    local path=$1
    local name=$2

    if [ -d "$path" ] || is_in_git_index "$path"; then
        echo ""
        print_warning "$name already exists at $path"

        if [ "$FORCE_MODE" = true ]; then
            print_info "Force mode: removing existing installation..."
            remove_submodule "$path"
            return 0  # Proceed with fresh install
        elif [ "$UPDATE_MODE" = true ]; then
            print_info "Update mode: updating existing installation..."
            if [ -d "$path" ]; then
                cd "$path"
                git fetch origin main
                git reset --hard origin/main
                cd - > /dev/null
                print_success "$name updated to latest version"
            fi
            return 1  # Skip install, already updated
        else
            echo ""
            echo "  Options:"
            echo "    1) Update - Pull latest changes"
            echo "    2) Reinstall - Remove and reinstall (clean)"
            echo "    3) Skip - Keep existing installation"
            echo "    4) Abort - Cancel installation"
            echo ""
            print_prompt "Choose an option [1-4]: "
            read -r choice

            case "$choice" in
                1)
                    print_step "Updating $name..."
                    if [ -d "$path" ]; then
                        cd "$path"
                        git fetch origin main
                        git reset --hard origin/main
                        cd - > /dev/null
                        print_success "$name updated"
                    else
                        print_warning "Directory not found, will reinstall"
                        remove_submodule "$path"
                        return 0
                    fi
                    return 1  # Skip fresh install
                    ;;
                2)
                    remove_submodule "$path"
                    return 0  # Proceed with fresh install
                    ;;
                3)
                    print_info "Skipping $name installation"
                    return 1  # Skip install
                    ;;
                4|*)
                    print_error "Installation aborted"
                    exit 1
                    ;;
            esac
        fi
    fi

    return 0  # No existing installation, proceed
}

install_sax_core() {
    print_step "Installing sax-core..."

    local core_path="$CLAUDE_DIR/sax-core"

    if handle_existing_installation "$core_path" "sax-core"; then
        # Add as submodule
        git submodule add "https://github.com/$SAX_GITHUB_ORG/$SAX_CORE_REPO.git" "$core_path"
        print_success "sax-core installed as submodule"
    fi
}

install_sax_package() {
    local package=$1
    local repo_name="sax-$package"
    local package_path="$CLAUDE_DIR/$repo_name"

    print_step "Installing $repo_name..."

    if handle_existing_installation "$package_path" "$repo_name"; then
        # Add as submodule
        git submodule add "https://github.com/$SAX_GITHUB_ORG/$repo_name.git" "$package_path"
        print_success "$repo_name installed as submodule"
    fi
}

setup_symlinks() {
    local package=$1
    local repo_name="sax-$package"
    local package_path="$CLAUDE_DIR/$repo_name"

    print_step "Setting up symlinks for $repo_name..."

    # CLAUDE.md symlink
    if [ -f "$package_path/CLAUDE.md" ]; then
        local claude_md_link="$CLAUDE_DIR/CLAUDE.md"

        if [ -L "$claude_md_link" ]; then
            rm "$claude_md_link"
        elif [ -f "$claude_md_link" ]; then
            print_info "Backing up existing CLAUDE.md to CLAUDE.md.backup"
            mv "$claude_md_link" "$claude_md_link.backup"
        fi

        ln -s "$repo_name/CLAUDE.md" "$claude_md_link"
        print_success "Created symlink: CLAUDE.md -> $repo_name/CLAUDE.md"
    fi

    # agents symlink
    if [ -d "$package_path/agents" ]; then
        local agents_link="$CLAUDE_DIR/agents"

        if [ -L "$agents_link" ]; then
            rm "$agents_link"
        elif [ -d "$agents_link" ]; then
            print_info "Backing up existing agents/ to agents.backup/"
            mv "$agents_link" "$agents_link.backup"
        fi

        ln -s "$repo_name/agents" "$agents_link"
        print_success "Created symlink: agents/ -> $repo_name/agents/"
    fi

    # skills symlink
    if [ -d "$package_path/skills" ]; then
        local skills_link="$CLAUDE_DIR/skills"

        if [ -L "$skills_link" ]; then
            rm "$skills_link"
        elif [ -d "$skills_link" ]; then
            print_info "Backing up existing skills/ to skills.backup/"
            mv "$skills_link" "$skills_link.backup"
        fi

        ln -s "$repo_name/skills" "$skills_link"
        print_success "Created symlink: skills/ -> $repo_name/skills/"
    fi

    # commands symlink
    if [ -d "$package_path/commands" ]; then
        local commands_link="$CLAUDE_DIR/commands"

        if [ -L "$commands_link" ]; then
            rm "$commands_link"
        elif [ -d "$commands_link" ]; then
            print_info "Backing up existing commands/ to commands.backup/"
            mv "$commands_link" "$commands_link.backup"
        fi

        ln -s "$repo_name/commands" "$commands_link"
        print_success "Created symlink: commands/ -> $repo_name/commands/"
    fi
}

print_summary() {
    local package=$1

    echo ""
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo -e "${GREEN}  Installation Complete!${NC}"
    echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
    echo ""
    echo "Installed structure:"
    echo ""
    echo "  .claude/"
    echo "  ├── CLAUDE.md -> sax-$package/CLAUDE.md"
    echo "  ├── agents/ -> sax-$package/agents/"
    echo "  ├── skills/ -> sax-$package/skills/"
    echo "  ├── sax-core/          (submodule)"
    echo "  └── sax-$package/      (submodule)"
    echo ""
    echo "Next steps:"
    echo "  1. Commit the changes: git add . && git commit -m 'Install SAX packages'"
    echo "  2. Push to remote: git push"
    echo ""
    echo "To update SAX packages later:"
    echo "  git submodule update --remote"
    echo "  # or"
    echo "  ./install-sax.sh $package --update"
    echo ""
}

# Parse arguments
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
                print_error "Unknown option: $1"
                show_usage
                exit 1
                ;;
        esac
    done

    if [ -z "$PACKAGE" ]; then
        print_error "Package name is required"
        show_usage
        exit 1
    fi
}

# Main
main() {
    print_header

    parse_args "$@"

    print_info "Selected package: sax-$PACKAGE"

    if [ "$FORCE_MODE" = true ]; then
        print_warning "Force mode enabled - will remove existing installations"
    fi

    if [ "$UPDATE_MODE" = true ]; then
        print_info "Update mode enabled - will update existing installations"
    fi

    # Run installation steps
    check_prerequisites
    create_claude_dir
    install_sax_core
    install_sax_package "$PACKAGE"
    setup_symlinks "$PACKAGE"
    print_summary "$PACKAGE"
}

main "$@"
