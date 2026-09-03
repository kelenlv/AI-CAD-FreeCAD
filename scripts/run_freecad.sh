#!/bin/bash
# =============================================================
# FreeCAD 无界面运行助手
# 定位 freecadcmd 并以 headless 模式执行指定的 Python 脚本。
#
# 用法：
#   ./scripts/run_freecad.sh scripts/freecad_modeler.py -t bolt -d 10 -l 40
#   ./scripts/run_freecad.sh freecad_fastener_model.py
# =============================================================
set -Eeuo pipefail

SCRIPT="${1:-}"
if [[ -z "${SCRIPT}" ]]; then
  echo "用法: $0 <python脚本> [参数...]"
  echo "示例: $0 scripts/freecad_modeler.py -t bolt -d 10 -l 40"
  exit 1
fi
shift

# 1. 优先使用 PATH 中的 freecadcmd
if command -v freecadcmd >/dev/null 2>&1; then
  exec freecadcmd "${SCRIPT}" -- "$@"
fi

# 2. macOS Homebrew Cask 安装位置
#    freecadcmd 位于 app bundle 的 Resources/bin 下（非 Contents/MacOS）
FREECAD_CMD="/Applications/FreeCAD.app/Contents/Resources/bin/freecadcmd"
if [[ -x "${FREECAD_CMD}" ]]; then
  exec "${FREECAD_CMD}" "${SCRIPT}" -- "$@"
fi

# 3. 常见 Homebrew Cask 版本名
FREECAD_CMD="/Applications/FreeCAD 1.0.app/Contents/Resources/bin/freecadcmd"
if [[ -x "${FREECAD_CMD}" ]]; then
  exec "${FREECAD_CMD}" "${SCRIPT}" -- "$@"
fi

echo "[ERROR] 未找到 freecadcmd。请先安装 FreeCAD："
echo "        brew install --cask freecad"
exit 1
