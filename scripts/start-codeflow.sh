#!/bin/bash

# CodeFlow - One Command Startup Script
# Usage: ./scripts/start-codeflow.sh [dev|start|build]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check Node.js version
check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js 18+"
        exit 1
    fi

    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        log_error "Node.js 18+ required. Current: $(node --version)"
        exit 1
    fi
    log_success "Node.js $(node --version)"
}

# Check if node_modules exists
check_deps() {
    if [ ! -d "node_modules" ]; then
        log_warn "node_modules not found. Installing dependencies..."
        npm install
        log_success "Dependencies installed"
    else
        log_info "Dependencies already installed"
    fi
}

# Type check
type_check() {
    log_info "Running TypeScript type check..."
    if npm run check 2>&1 | grep -q "error"; then
        log_error "Type check failed"
        exit 1
    fi
    log_success "Type check passed"
}

# Run tests
test_run() {
    log_info "Running tests..."
    if ! npm test -- --run; then
        log_warn "Some tests failed (continuing anyway)"
    else
        log_success "Tests passed"
    fi
}

# Main start function
start_dev() {
    log_info "🚀 Starting CodeFlow in DEV mode..."
    log_info "================================"

    check_node
    check_deps
    type_check

    log_info "Starting Next.js dev server..."
    log_info "API: http://localhost:3000/api"
    log_info "App: http://localhost:3000"
    log_info "Press Ctrl+C to stop"
    log_info "================================"

    npm run dev
}

start_prod() {
    log_info "🏭 Starting CodeFlow in PRODUCTION mode..."
    log_info "================================"

    check_node
    check_deps

    if [ ! -d ".next" ]; then
        log_info "Building production bundle..."
        npm run build
    fi

    log_info "Starting production server..."
    npm run start
}

# Command routing
case "${1:-dev}" in
    dev)
        start_dev
        ;;
    start)
        start_prod
        ;;
    build)
        check_node
        check_deps
        log_info "Building production bundle..."
        npm run build
        log_success "Build complete"
        ;;
    test)
        check_node
        check_deps
        test_run
        ;;
    check)
        check_node
        check_deps
        type_check
        ;;
    *)
        echo "Usage: $0 [dev|start|build|test|check]"
        echo "  dev   - Start development server (default)"
        echo "  start - Start production server"
        echo "  build - Build production bundle"
        echo "  test  - Run tests"
        echo "  check - Run type check"
        exit 1
        ;;
esac
