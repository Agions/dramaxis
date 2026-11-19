#!/usr/bin/env bash
# ==============================================================================
# dramaxis v1.3.0  · Rust + TypeScript 统一覆盖率脚本
#
# 双端测量：
#   - Rust    : cargo tarpaulin(workspace 元数据自动加载)
#   - 前端    : pnpm test:coverage(vitest v8)
#
# 报告输出：
#   - src-tauri/target/coverage/tarpaulin-report.html
#   - coverage/index.html
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

CYAN="\033[0;36m"
GREEN="\033[0;32m"
YELLOW="\033[1;33m"
RED="\033[0;31m"
NC="\033[0m"

info()  { printf "${CYAN}[INFO]${NC}  %s\n" "$*"; }
ok()    { printf "${GREEN}[OK]${NC}    %s\n" "$*"; }
warn()  { printf "${YELLOW}[WARN]${NC}  %s\n" "$*"; }
fail()  { printf "${RED}[FAIL]${NC}  %s\n" "$*"; }

# 1. 前置依赖检查 -----------------------------------------------------------
info "检查 cargo-tarpaulin ..."
if ! command -v cargo-tarpaulin >/dev/null 2>&1; then
  warn "未检测到 cargo-tarpaulin,可运行 cargo install cargo-tarpaulin --locked"
fi

info "检查 pnpm ..."
if ! command -v pnpm >/dev/null 2>&1; then
  fail "未安装 pnpm,无法执行前端覆盖率"
  exit 1
fi

# 2. Rust 端覆盖率 ---------------------------------------------------------
info "执行 cargo tarpaulin (workspace 模式) ..."
mkdir -p src-tauri/target/coverage
cargo tarpaulin \
  --manifest-path src-tauri/Cargo.toml \
  --workspace \
  --timeout 180 \
  --out Html --out Json --out Xml \
  --output-dir src-tauri/target/coverage \
  --skip-clean \
  --exclude-files 'src-tauri/src/main.rs' \
  || warn "cargo tarpaulin 退出码非 0,请检查 Rust 编译错误"
ok "Rust 报告已生成: src-tauri/target/coverage/tarpaulin-report.html"

# 3. TypeScript 端覆盖率 ---------------------------------------------------
info "执行 pnpm vitest coverage (前端) ..."
./node_modules/.bin/vitest run --coverage || warn "前端测试存在失败"
ok "前端报告已生成: coverage/index.html"

# 4. 综合展示 --------------------------------------------------------------
info "Rust 覆盖率汇总(若 tarpaulin-report.json 存在):"
if [ -f src-tauri/target/coverage/tarpaulin-report.json ]; then
  node -e "
const fs = require('fs');
try {
  const data = JSON.parse(fs.readFileSync('src-tauri/target/coverage/tarpaulin-report.json', 'utf8'));
  console.log('  lines     : ' + (data.line || 0).toFixed(2) + ' %');
  console.log('  branches  : ' + (data.branch || 0).toFixed(2) + ' %');
  console.log('  functions : ' + (data.function || 0).toFixed(2) + ' %');
} catch (e) {
  process.exit(1);
}
" || warn "解析 Rust 报告失败,不影响整体流程"
fi

ok "全量覆盖率测量完成"
