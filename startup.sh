#!/usr/bin/env bash
# ══════════════════════════════════════════════════════════════════════
#  Probability Education Platform — Agent Startup Script
#  Run this first: bash startup.sh
#  This script verifies the environment, shows project status,
#  and gives the agent its first task.
# ══════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── Colors ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
warn() { echo -e "  ${YELLOW}⚠${NC}  $1"; }
fail() { echo -e "  ${RED}✗${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }
h1()   { echo -e "\n${BOLD}${BLUE}$1${NC}"; echo -e "${BLUE}$(echo "$1" | sed 's/./─/g')${NC}"; }
h2()   { echo -e "\n${BOLD}$1${NC}"; }

# ── Header ────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${BLUE}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}${BLUE}║  Probability Education Platform — Agent Startup    ║${NC}"
echo -e "${BOLD}${BLUE}║  timothyhartzog/Probability-education              ║${NC}"
echo -e "${BOLD}${BLUE}╚════════════════════════════════════════════════════╝${NC}"

# ── Environment Checks ────────────────────────────────────────────────
h1 "1. Environment Verification"

# Node.js
if command -v node &>/dev/null; then
  NODE_VER=$(node --version)
  ok "Node.js $NODE_VER"
else
  fail "Node.js not found. Install Node.js 18+ before proceeding."
  exit 1
fi

# npm
if command -v npm &>/dev/null; then
  NPM_VER=$(npm --version)
  ok "npm $NPM_VER"
else
  fail "npm not found."
  exit 1
fi

# Git
if command -v git &>/dev/null; then
  GIT_VER=$(git --version | cut -d' ' -f3)
  ok "git $GIT_VER"
  REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null || echo "NOT_A_REPO")
  if [ "$REPO_ROOT" = "NOT_A_REPO" ]; then
    fail "Not inside a git repository. Navigate to the Probability-education repo root."
    exit 1
  fi
  ok "In git repo: $REPO_ROOT"
else
  fail "git not found."
  exit 1
fi

# Verify we're in the right repo
if [ ! -f "$REPO_ROOT/CLAUDE.md" ]; then
  fail "CLAUDE.md not found at repo root. Are you in the right repository?"
  exit 1
fi
ok "CLAUDE.md found (project config)"

if [ ! -d "$REPO_ROOT/app" ]; then
  fail "app/ directory not found. The SvelteKit v2 app is missing."
  exit 1
fi
ok "app/ directory found (SvelteKit v2 app)"

# ── SvelteKit App Status ───────────────────────────────────────────────
h1 "2. SvelteKit App Status"

APP_DIR="$REPO_ROOT/app"
cd "$APP_DIR"

# Dependencies
if [ -d "node_modules" ]; then
  ok "node_modules present"
else
  warn "node_modules missing — installing now..."
  npm install --legacy-peer-deps --silent
  ok "Dependencies installed"
fi

# .svelte-kit sync
if [ ! -f ".svelte-kit/ambient.d.ts" ]; then
  info "Running svelte-kit sync..."
  npx svelte-kit sync --quiet 2>/dev/null || true
  ok "svelte-kit sync complete"
else
  ok ".svelte-kit types present"
fi

# Build verification
echo ""
info "Running build check (this takes ~15 seconds)..."
if npm run build --silent 2>/dev/null; then
  ok "Build passes — zero errors ✓"
else
  fail "BUILD FAILED. Fix errors before adding new code."
  echo ""
  echo "  Run: cd app && npm run build"
  echo "  to see the full error output."
  exit 1
fi

# ── Chapter Completion Status ──────────────────────────────────────────
h1 "3. Chapter Page Status"

cd "$REPO_ROOT/app/src/routes"

TOTAL=0; DONE=0; STUB=0

echo "  Part I — Foundations (high-school / early college)"
for ch in 1 2 3 4 5 6; do
  file="part-1/chapter-$ch/+page.svelte"
  lines=$(wc -l < "$file" 2>/dev/null || echo 0)
  if [ "$lines" -gt 100 ]; then
    ok "  Ch $ch: $lines lines — ✅ has content"
    DONE=$((DONE+1))
  else
    warn "Ch $ch: $lines lines — 🚧 STUB (needs real content)"
    STUB=$((STUB+1))
  fi
  TOTAL=$((TOTAL+1))
done

echo "  Part II — Intermediate (undergrad)"
for ch in 7 8 9 10 11; do
  file="part-2/chapter-$ch/+page.svelte"
  lines=$(wc -l < "$file" 2>/dev/null || echo 0)
  if [ "$lines" -gt 100 ]; then
    ok "  Ch $ch: $lines lines — ✅ has content"
    DONE=$((DONE+1))
  else
    info "Ch $ch: $lines lines — 📊 legacy module wrapper"
    DONE=$((DONE+1))  # counts as done for now
  fi
  TOTAL=$((TOTAL+1))
done

echo "  Parts III-V — Graduate / Research"
for part in 3 4 5; do
  case $part in
    3) chs="12 13 14 15" ;;
    4) chs="16 17 18 19 20 21 22" ;;
    5) chs="23 24 25 26 27 28" ;;
  esac
  for ch in $chs; do
    file="part-$part/chapter-$ch/+page.svelte"
    lines=$(wc -l < "$file" 2>/dev/null || echo 0)
    if [ "$lines" -gt 100 ]; then
      ok "  Ch $ch: $lines lines — ✅ has content"
      DONE=$((DONE+1))
    else
      info "Ch $ch: $lines lines — 📊 legacy wrapper or stub"
      DONE=$((DONE+1))
    fi
    TOTAL=$((TOTAL+1))
  done
done

echo ""
echo -e "  ${BOLD}Summary: $TOTAL chapters total | $STUB need full content (Part I chapters 4-6 are highest priority)${NC}"

# ── Task Queue ────────────────────────────────────────────────────────
h1 "4. Agent Task Queue"

if [ -f "$REPO_ROOT/agent-tasks.json" ]; then
  ok "agent-tasks.json found"
  echo ""
  echo "  Priority task list (from agent-tasks.json):"
  python3 -c "
import json, sys
with open('$REPO_ROOT/agent-tasks.json') as f:
    data = json.load(f)
tasks = sorted(data['tasks'], key=lambda t: t['priority'])
for t in tasks[:8]:
    status_icon = '✅' if t['status']=='done' else ('🚧' if t['status']=='in_progress' else '⬜')
    print(f\"  {status_icon} [{t['id']}] P{t['priority']} — {t['title']}\")
    print(f\"      File: {t['file']}\")
if len(tasks) > 8:
    print(f'  ... and {len(tasks)-8} more tasks')
" 2>/dev/null || info "Install python3 to see task summary"
fi

# ── Next Action ───────────────────────────────────────────────────────
h1 "5. Your First Task"

echo ""
echo -e "  ${BOLD}READ FIRST:${NC}"
echo -e "  ${CYAN}cat $REPO_ROOT/CLAUDE.md${NC}"
echo ""
echo -e "  ${BOLD}THEN BUILD:${NC}"
echo -e "  ${CYAN}# Chapter 4 — Discrete Random Variables (highest priority)${NC}"
echo -e "  ${CYAN}# File: app/src/routes/part-1/chapter-4/+page.svelte${NC}"
echo -e "  ${CYAN}# See task T01 in agent-tasks.json for full specification${NC}"
echo ""
echo -e "  ${BOLD}WORKFLOW:${NC}"
echo -e "  1. Read CLAUDE.md and task T01 in agent-tasks.json"
echo -e "  2. Edit app/src/routes/part-1/chapter-4/+page.svelte"
echo -e "  3. Test: ${CYAN}cd app && npm run build${NC}"
echo -e "  4. Preview: ${CYAN}cd app && npm run dev${NC}"
echo -e "  5. Commit: ${CYAN}git add app/ && git commit -m 'feat(ch-4): ...' && git push origin main${NC}"
echo -e "  6. Move to task T02 (Chapter 5)"
echo ""

# ── Dev Server ────────────────────────────────────────────────────────
h1 "6. Quick Commands"

echo ""
echo -e "  ${CYAN}cd app && npm run dev${NC}         → Dev server at http://localhost:5174"
echo -e "  ${CYAN}cd app && npm run build${NC}        → Production build (must pass before commit)"
echo -e "  ${CYAN}cd app && npm run check${NC}        → TypeScript type check"
echo -e "  ${CYAN}cd app && npm run preview${NC}      → Preview production build"
echo -e "  ${CYAN}git add app/ && git commit${NC}     → Commit from REPO ROOT (not app/)"
echo ""

# ── Warning ───────────────────────────────────────────────────────────
echo -e "  ${RED}${BOLD}⚠ NEVER MODIFY:${NC} src/  index.html  vite.config.js  package.json (root)  css/  js/"
echo -e "  ${GREEN}${BOLD}✓ ALL YOUR WORK goes in:${NC} app/"
echo ""

echo -e "${GREEN}${BOLD}✓ Environment ready. Begin with CLAUDE.md.${NC}"
echo ""
