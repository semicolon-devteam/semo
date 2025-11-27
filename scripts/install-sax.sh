#!/bin/bash

# SAX Package Installer
# Usage: ./install-sax.sh [package]
# Packages: po, next, meta
# Example: ./install-sax.sh po

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SAX_GITHUB_ORG="semicolon-devteam"
SAX_CORE_REPO="sax-core"
CLAUDE_DIR=".claude"

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

show_usage() {
    echo "Usage: $0 [package]"
    echo ""
    echo "Available packages:"
    echo "  po      - SAX-PO (PO/기획자용)"
    echo "  next    - SAX-Next (Next.js 개발자용)"
    echo "  meta    - SAX-Meta (SAX 패키지 관리자용)"
    echo ""
    echo "Examples:"
    echo "  $0 po       # Install sax-po package"
    echo "  $0 next     # Install sax-next package"
    echo "  $0 meta     # Install sax-meta package"
    echo ""
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

install_sax_core() {
    print_step "Installing sax-core..."

    local core_path="$CLAUDE_DIR/sax-core"

    if [ -d "$core_path" ]; then
        print_info "sax-core already installed at $core_path"

        # Update existing submodule
        print_step "Updating sax-core to latest version..."
        cd "$core_path"
        git pull origin main
        cd - > /dev/null
        print_success "sax-core updated"
    else
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

    if [ -d "$package_path" ]; then
        print_info "$repo_name already installed at $package_path"

        # Update existing submodule
        print_step "Updating $repo_name to latest version..."
        cd "$package_path"
        git pull origin main
        cd - > /dev/null
        print_success "$repo_name updated"
    else
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
    echo ""
}

# Main
main() {
    print_header

    # Check arguments
    if [ $# -eq 0 ]; then
        show_usage
        exit 1
    fi

    local package=$1

    # Validate package name
    case $package in
        po|next|meta)
            print_info "Selected package: sax-$package"
            ;;
        *)
            print_error "Invalid package: $package"
            show_usage
            exit 1
            ;;
    esac

    # Run installation steps
    check_prerequisites
    create_claude_dir
    install_sax_core
    install_sax_package "$package"
    setup_symlinks "$package"
    print_summary "$package"
}

main "$@"
