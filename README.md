# FastenerModel AI — 标准紧固件智能建模系统（FreeCAD 版）

航天发动机标准紧固件智能建模平台，面向工业设计师与工程师，提供「标准文档 → 三维模型 → 属性数据」的一键式自动化转换。

本仓库是原 ZWCAD（中望CAD）版本的**跨平台重构版**：将 Windows 专属的 ZWCAD COM/ActiveX
自动化层替换为 **FreeCAD Python API**，使 CAD 建模可在 macOS / Windows / Linux 上运行。

## 技术栈

| 层次 | 技术 | 说明 |
|------|------|------|
| Web 前端 | Next.js 16 + React 19 + TypeScript + Tailwind v4 | 三栏工作台 Dashboard |
| 3D 预览 | three.js | 参数化三维预览 |
| 文档解析 | LLM（豆包/千问/DeepSeek…）+ pdfminer / MinerU | 国标文档 → 参数 JSON |
| CAD 建模 | **FreeCAD (Part 模块, Python)** | 替代原 ZWCAD COM，跨平台，导出 STEP/STL |

## 快速开始

### 1. 启动 Web 服务

```bash
pnpm install
pnpm dev          # 或 pnpm next dev --port 5000
# 浏览器打开 http://localhost:5000
```

> 端口 5000 可能被 macOS「隔空播放接收器」占用：系统设置 → 通用 → 隔空投送与接力 → 关闭「隔空播放接收器」，
> 或换端口 `DEPLOY_RUN_PORT=5001 pnpm dev`。

> 文档解析依赖 LLM API Key，见 `.env.example`（复制为 `.env.local` 并填入）。

### 2. FreeCAD 建模（本地）

```bash
# 安装 FreeCAD（仅需一次）
brew install --cask freecad

# 单个紧固件（命令行参数）—— 推荐用 run_freecad.sh（自动定位 freecadcmd 并处理参数分隔）
./scripts/run_freecad.sh scripts/freecad_modeler.py -t bolt -d 10 -l 40

# 从参数 JSON 建模
./scripts/run_freecad.sh scripts/freecad_modeler.py -i params.json

# 蝶形螺母示例
./scripts/run_freecad.sh freecad_fastener_model.py

# 批量生成标准库（25 个样本）
node standard-library/generate-library.js
./scripts/run_freecad.sh standard-library/output/freecad_batch_model.py
```

> 直接用 `freecadcmd` 时需加 `--` 分隔参数（否则 `-d/-l/-t` 会被 FreeCAD 自身选项抢走）：
> `freecadcmd scripts/freecad_modeler.py -- -t bolt -d 10 -l 40`

输出文件位于 `output/` 目录（`.step` 通用交换格式 + `.stl` 3D 打印格式，可选 `.FCStd`）。

## 支持的紧固件类型

| 类型 | 名称 | 标准 |
|------|------|------|
| bolt | 六角头螺栓 | GB/T 5782-2016 |
| nut | 六角螺母 | GB/T 6170-2015 |
| washer | 平垫圈 | GB/T 97.1-2002 |
| screw | 内六角螺钉 | GB/T 70.1-2008 |
| rivet | 半圆头铆钉 | GB/T 867-1986 |
| pin | 圆柱销 | GB/T 119.1-2000 |
| stud | 双头螺柱 | GB/T 897-1988 |

## 目录结构

```
.
├── src/                         # Next.js 前端 + API 路由
│   ├── app/
│   │   ├── page.tsx             # 三栏工作台
│   │   └── api/
│   │       ├── parse-document/  # 文本 → 参数（LLM）
│   │       ├── parse-pdf/       # PDF → 参数（LLM）
│   │       ├── export-attributes/ # CSV/JSON 属性导出
│   │       └── export-freecad/  # FreeCAD 脚本 / 参数 JSON 导出
│   ├── components/
│   │   ├── dashboard/           # 工作台组件
│   │   └── three/               # three.js 参数化模型
│   └── lib/                     # 类型定义 + 参数生成
├── scripts/
│   ├── freecad_modeler.py       # ★ FreeCAD 建模脚本（7 类紧固件）
│   ├── run_freecad.sh           # 定位 freecadcmd 的运行助手
│   ├── pdf_extract.py           # PDF 文本提取（pdfminer）
│   ├── mineru_pdf_parser.py     # MinerU 复杂版面解析
│   ├── dev.sh / build.sh ...    # 服务脚本（已适配 macOS）
│   └── requirements.txt
├── freecad_fastener_model.py    # ★ 蝶形螺母建模示例
└── standard-library/            # 25 个标准件样本 + 批量生成脚本
```

## 与原 ZWCAD 版本的差异

- `zwcad_modeler.py`（pywin32/COM，仅 Windows）→ `scripts/freecad_modeler.py`（FreeCAD Part，跨平台）
- `zwcad_fastener.lsp`（AutoLISP）→ 移除（FreeCAD 宏为 Python）
- `export-zwcad` API → `export-freecad` API（生成 FreeCAD 脚本）
- `dev.sh` 的 Linux `ss` → macOS 兼容的 `lsof`
- 输出格式：`.dwg` → `.step` / `.stl` / `.FCStd`

> 螺纹为装饰性示意（螺旋扫掠），与原版的环纹近似一致；真实牙型可按需进一步细化。
