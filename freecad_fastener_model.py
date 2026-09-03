#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FreeCAD 蝶形螺母（翼型螺母）建模示例
======================================
这是 zwcad_fastener_model修改.py 的跨平台重构版本。

原版通过 ZWCAD COM (win32com) 先绘制 Polyline、转 Region、再 Extrude、再打孔；
本版改用 FreeCAD Part 工作台：正多边形 → 面 → 拉伸 → 布尔差集，逻辑一一对应。

运行（无界面 headless）：
  freecadcmd freecad_fastener_model.py

输出：
  output/wing_nut.step / output/wing_nut.stl
"""

import math
import os

try:
    import FreeCAD as App
    import Part
    from FreeCAD import Base
    V = Base.Vector
except ImportError:
    print("[ERROR] 未检测到 FreeCAD。请先安装：brew install --cask freecad")
    print("        然后用 freecadcmd 运行本脚本。")
    raise SystemExit(1)


def create_wing_nut(x0, p):
    """创建单个蝶形螺母。x0 为沿 X 轴偏移，p 为参数 dict。"""
    D = p["D"]      # 螺纹孔直径
    d = p["d"]      # 本体宽度
    L = p["L"]      # 两翼总长
    k = p["k"]      # 螺母高度（厚度）

    print(f"\n生成 M{D}")

    body_r = d / 2.0
    wing_len = (L - d) / 2.0
    wing_h = d * 0.8

    # 1. 蝶形截面轮廓（XY 平面，与原版 Polyline 顶点一致）
    pts = [
        V(x0 - body_r - wing_len, -wing_h / 2, 0),
        V(x0 - body_r, -wing_h / 2, 0),
        V(x0 - body_r, -body_r, 0),
        V(x0 + body_r, -body_r, 0),
        V(x0 + body_r, -wing_h / 2, 0),
        V(x0 + body_r + wing_len, -wing_h / 2, 0),
        V(x0 + body_r + wing_len, wing_h / 2, 0),
        V(x0 + body_r, wing_h / 2, 0),
        V(x0 + body_r, body_r, 0),
        V(x0 - body_r, body_r, 0),
        V(x0 - body_r, wing_h / 2, 0),
        V(x0 - body_r - wing_len, wing_h / 2, 0),
    ]
    wire = Part.makePolygon(pts, True)
    face = Part.Face(wire)

    # 2. 拉伸成实体（对应原版 EXTRUDE）
    solid = face.extrude(V(0, 0, k))

    # 3. 中心螺纹孔（对应原版 CYLINDER + SUBTRACT）
    hole = Part.makeCylinder(D / 2, k + 2, V(x0, 0, -1), V(0, 0, 1))
    solid = solid.cut(hole)

    print("蝶形螺母完成")
    return solid


# =========================================================
# 参数
# =========================================================

NUT_DATA = [
    {"D": 3, "d": 4, "L": 16, "k": 8.5}
    # 可在此追加更多规格，如 {"D": 4, "d": 6, "L": 21, "k": 11}
]


def main():
    spacing = 40.0
    solids = []
    for i, p in enumerate(NUT_DATA):
        solids.append(create_wing_nut(i * spacing, p))

    combined = solids[0]
    for s in solids[1:]:
        combined = combined.fuse(s)

    os.makedirs("output", exist_ok=True)
    step_path = os.path.join("output", "wing_nut.step")
    stl_path = os.path.join("output", "wing_nut.stl")

    combined.exportStep(step_path)
    import MeshPart
    mesh = MeshPart.meshFromShape(Shape=combined, LinearDeflection=0.1, AngularDeflection=0.5, Relative=False)
    mesh.write(stl_path)

    print("\n全部完成")
    print(f"[OK] STEP 已保存: {step_path}")
    print(f"[OK] STL  已保存: {stl_path}")


# freecadcmd 下 __name__ 为脚本文件名（非 "__main__"），故直接调用 main()。
main()
