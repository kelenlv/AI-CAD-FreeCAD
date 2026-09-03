# 标准紧固件智能建模系统 — 标准库样本

## 概述

本目录包含利用 FastenerModel AI 系统生成的 5 类典型航天发动机标准紧固件的三维模型参数样本。每个样本包含完整的几何参数和属性数据，可直接用于 FreeCAD 建模或 Web 端预览。

## 样本清单

| 编号 | 紧固件类型 | 国标标准 | 样本数量 | 规格范围 |
|------|-----------|----------|----------|----------|
| 1 | **螺栓 (Bolt)** | GB/T 5782-2016 | 6 | M6×20 ~ M24×100 |
| 2 | **螺母 (Nut)** | GB/T 6170-2015 | 6 | M6 ~ M24 |
| 3 | **垫圈 (Washer)** | GB/T 97.1-2002 | 5 | 6mm ~ 24mm |
| 4 | **铆钉 (Rivet)** | GB/T 867-1986 | 4 | 3×8 ~ 8×30 |
| 5 | **销 (Pin)** | GB/T 119.1-2000 | 4 | 4×20 ~ 16×60 |

**合计**：25 个标准件样本

## 文件结构

```
standard-library/
├── README.md                   # 本说明文件
├── library-manifest.json       # 库清单（所有样本元数据）
├── samples/
│   ├── bolt/                   # 螺栓样本
│   │   ├── bolt_m6x20.json
│   │   ├── bolt_m8x30.json
│   │   ├── bolt_m10x40.json
│   │   ├── bolt_m12x50.json
│   │   ├── bolt_m16x60.json
│   │   └── bolt_m24x100.json
│   ├── nut/                    # 螺母样本
│   │   ├── nut_m6.json
│   │   ├── nut_m8.json
│   │   ├── nut_m10.json
│   │   ├── nut_m12.json
│   │   ├── nut_m16.json
│   │   └── nut_m24.json
│   ├── washer/                 # 垫圈样本
│   │   ├── washer_d6.json
│   │   ├── washer_d8.json
│   │   ├── washer_d10.json
│   │   ├── washer_d12.json
│   │   └── washer_d16.json
│   ├── rivet/                  # 铆钉样本
│   │   ├── rivet_3x8.json
│   │   ├── rivet_5x15.json
│   │   ├── rivet_6x20.json
│   │   └── rivet_8x30.json
│   └── pin/                    # 销样本
│       ├── pin_d4x20.json
│       ├── pin_d8x30.json
│       ├── pin_d12x50.json
│       └── pin_d16x60.json
└── generate-library.js         # 库生成脚本（用于批量导入系统）
```

## 数据格式

每个样本文件使用统一的 FastenerData JSON 格式：

```json
{
  "type": "fastener_type",
  "geometry": {
    // 几何参数，按类型不同
  },
  "attributes": {
    "standardNo": "GB/T XXXX-XXXX",
    "partName": "零件中文名称",
    "materialName": "材料牌号",
    "materialGrade": "性能等级",
    "surfaceTreatment": "表面处理",
    "specification": "规格描述"
  }
}
```

## 使用方式

### Web 端加载

1. 打开系统 Dashboard
2. 在左侧文档输入区，点击「加载标准库样本」
3. 选择需要的样本类型和规格
4. 系统自动填充参数并显示 3D 预览

### FreeCAD 建模

1. 导出选定样本的 FreeCAD Python 脚本
2. 在已安装 FreeCAD 的机器上执行脚本（macOS / Windows / Linux 均可）
3. 脚本自动生成三维实体模型并导出 STEP / STL

```bash
freecadcmd freecad_batch_model.py
```

### 批量入库

使用 `generate-library.js` 脚本批量导入所有样本到系统中：

```bash
node standard-library/generate-library.js
```