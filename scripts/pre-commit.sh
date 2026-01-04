#!/bin/bash

# pre-commit hook script
# Runs tests and type check in parallel for faster feedback

set -e

echo "Running pre-commit checks (parallel)..."

# Create temp files for output
TEMP_DIR=$(mktemp -d)
TEST_OUTPUT="$TEMP_DIR/test.log"
BUILD_OUTPUT="$TEMP_DIR/build.log"

# Cleanup on exit
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Run tests in background
(pnpm test:run > "$TEST_OUTPUT" 2>&1; echo $? > "$TEMP_DIR/test.exit") &
pid_test=$!

# Run type check in background
(pnpm build > "$BUILD_OUTPUT" 2>&1; echo $? > "$TEMP_DIR/build.exit") &
pid_build=$!

# Wait for both to complete
echo "  [test]  Running tests..."
echo "  [build] Running TypeScript type check..."
wait $pid_test $pid_build

# Get exit codes
test_exit=$(cat "$TEMP_DIR/test.exit")
build_exit=$(cat "$TEMP_DIR/build.exit")

# Show results
echo ""
echo "=== Test Results ==="
cat "$TEST_OUTPUT"

echo ""
echo "=== Build Results ==="
cat "$BUILD_OUTPUT"

# Check for failures
failed=0

if [ "$test_exit" -ne 0 ]; then
  echo ""
  echo "❌ Tests failed!"
  failed=1
fi

if [ "$build_exit" -ne 0 ]; then
  echo ""
  echo "❌ Type check failed!"
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo ""
  echo "Commit aborted due to errors."
  exit 1
fi

echo ""
echo "✅ All pre-commit checks passed!"
exit 0
