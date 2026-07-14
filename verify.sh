#!/bin/bash
# One-shot pre-deploy verification for epos-website-v1.5.
# Runs: backend syntax check -> flutter analyze -> frontend build.
# Usage (from Claude Code chat):  ! bash /d/epos-website-v1.5/verify.sh

PY="/c/Users/Jabran Ahmad Hanjra/AppData/Local/Programs/Python/Python312/python"
FLUTTER="/d/flutter_windows_3.44.4-stable/flutter/bin/flutter"
ROOT="/d/epos-website-v1.5"
FAIL=0

echo "=== 1/3 BACKEND (py_compile) ==="
cd "$ROOT/backend" || exit 1
if "$PY" -m py_compile server.py; then
  echo "BACKEND: OK"
else
  echo "BACKEND: FAILED"
  FAIL=1
fi

echo ""
echo "=== 2/3 APP (flutter analyze) ==="
cd "$ROOT/mobile" || exit 1
if "$FLUTTER" analyze; then
  echo "APP: OK"
else
  echo "APP: FAILED"
  FAIL=1
fi

echo ""
echo "=== 3/3 WEBSITE (yarn build) ==="
cd "$ROOT/frontend" || exit 1
if CI=false GENERATE_SOURCEMAP=false yarn build 2>&1 | tail -5; then
  echo "WEBSITE: OK"
else
  echo "WEBSITE: FAILED"
  FAIL=1
fi

echo ""
if [ "$FAIL" -eq 0 ]; then
  echo "########  ALL 3 CHECKS PASSED — SAFE TO DEPLOY  ########"
else
  echo "########  SOMETHING FAILED — paste this output to Claude  ########"
fi
