#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
FreeCAD 标准紧固件智能建模脚本
================================
基于国标文档提取的紧固件参数，驱动 FreeCAD Python API (Part 模块) 自动生成三维实体模型。

这是 zwcad_modeler.py 的跨平台重构版本：
  - 原版依赖 Windows 的 ZWCAD COM/ActiveX (pywin32)，无法在 macOS/Linux 运行
  - 本版改用 FreeCAD 内置的 Part 工作台，跨平台（macOS / Windows / Linux）

运行环境：已安装 FreeCAD（macOS: `brew install --cask freecad`）

用法（无界面 / headless，推荐）：
  freecadcmd scripts/freecad_modeler.py -t bolt -d 10 -l 40
  freecadcmd scripts/freecad_modeler.py -i params.json
  freecadcmd scripts/freecad_modeler.py --batch batch.json
  freecadcmd scripts/freecad_modeler.py --export-template bolt      # 仅导出参数模板

  也可在 FreeCAD GUI 的 Python 控制台 / 宏中 import 本模块调用。

输出：output/ 目录下的 .step（通用交换格式）+ .stl（3D打印/预览），可选 .FCStd。

依赖：无额外 pip 依赖，仅需 FreeCAD 自带模块。
"""

import argparse
import json
import math
import os
import sys
from typing import Optional, Dict, Any, List, Tuple

# ---- FreeCAD 模块（由 freecadcmd / FreeCAD 提供）----
try:
    import FreeCAD as App
    import Part
    from FreeCAD import Base
    V = Base.Vector
    _HAS_FREECAD = True
except ImportError:
    # 允许在普通 python3 下 import 本模块做纯参数/模板导出（不建模）
    App = None
    Part = None
    V = None
    _HAS_FREECAD = False


def _require_freecad():
    if not _HAS_FREECAD:
        print("[ERROR] 未检测到 FreeCAD。请安装后使用 freecadcmd 运行本脚本：")
        print("        macOS:   brew install --cask freecad")
        print("        Windows: https://www.freecad.org 下载安装")
        print("        然后:    freecadcmd scripts/freecad_modeler.py ...")
        sys.exit(1)


# ============================================================
# 1. 基础几何体（包装 FreeCAD Part API）
# ============================================================

def make_cylinder(cx, cy, cz, radius, height):
    """创建圆柱体。cz 为底面圆心，height 沿 +Z 延伸。"""
    return Part.makeCylinder(radius, height, V(cx, cy, cz), V(0, 0, 1))


def make_box(cx, cy, cz, lx, ly, lz):
    """创建长方体。pnt 为底面左下角，尺寸沿 +X/+Y/+Z。"""
    return Part.makeBox(lx, ly, lz, V(cx, cy, cz), V(0, 0, 1))


def make_cone(cx, cy, cz, r1, r2, height):
    """创建圆锥/圆台。r1 为底面半径，r2 为顶面半径。"""
    return Part.makeCone(r1, r2, height, V(cx, cy, cz), V(0, 0, 1))


def make_sphere(cx, cy, cz, radius):
    """创建球体。"""
    return Part.makeSphere(radius, V(cx, cy, cz))


def make_hex_prism(cx, cy, z0, s, height, angle_deg=30.0):
    """
    创建正六棱柱（对边宽度 s）。

    通过正六边形面沿 +Z 拉伸得到。angle_deg 控制六边形相对 X 轴的旋转角度，
    默认 30° 使一对边与 X 轴平行（工程图常用方位）。
    """
    R = s / math.sqrt(3.0)  # 正六边形外接圆半径（对边宽 s）
    pts = []
    for i in range(6):
        a = math.radians(angle_deg + 60.0 * i)
        pts.append(V(cx + R * math.cos(a), cy + R * math.sin(a), z0))
    wire = Part.makePolygon(pts, True)
    face = Part.Face(wire)
    return face.extrude(V(0, 0, height))


def fuse_all(shapes: List) -> Any:
    """布尔并集：合并多个实体（就地返回合并结果）。"""
    result = None
    for s in shapes:
        result = s if result is None else result.fuse(s)
    return result


def cut_many(target, tools: List) -> Any:
    """布尔差集：从 target 中依次减去 tools。"""
    result = target
    for t in tools:
        result = result.cut(t)
    return result


# ============================================================
# 2. 螺纹与倒角辅助
# ============================================================

def add_external_thread(shape, d, pitch, length, z0):
    """
    在杆件 [z0, z0+length] 段附加装饰性螺纹环。

    用一系列圆环（torus）沿轴向堆叠近似螺纹，与原 ZWCAD 版的环纹做法一致，
    且比螺旋扫掠更稳健（makePipe 对螺旋线可能返回空几何甚至崩溃）。
    """
    if pitch <= 0 or length <= 0:
        return shape
    z = z0
    while z <= z0 + length + 1e-9:
        try:
            shape = shape.fuse(Part.makeTorus(d / 2, pitch * 0.15, V(0, 0, z), V(0, 0, 1)))
        except Exception:
            pass
        z += pitch
    return shape


def chamfer_top(shape, r, c, z_top):
    """对圆柱顶面边缘做 45° 倒角（宽度 c）。"""
    if c <= 0:
        return shape
    frustum = make_cone(0, 0, z_top - c, r, r - c, c)
    return shape.cut(frustum)


def chamfer_bottom(shape, r, c, z_bottom):
    """对圆柱底面边缘做 45° 倒角（宽度 c）。"""
    if c <= 0:
        return shape
    frustum = make_cone(0, 0, z_bottom, r - c, r, c)
    return shape.cut(frustum)


# ============================================================
# 3. 各紧固件类型的参数化建模函数
# ============================================================

def create_bolt(params: Dict[str, float]):
    """
    创建六角头螺栓（轴向沿 +Z，杆尖在 z=0，头部在顶端）。

    几何：六角头 + 螺杆圆柱 + 头部倒角 + 螺纹示意。
    """
    d = params.get("d", 10)
    L = params.get("L", 40)
    k = params.get("k", 7)
    s = params.get("s", 16)
    b = params.get("b", 26)
    pitch = params.get("pitch", 1.5)
    c = params.get("c", 0.6)

    # 螺杆（z=0 到 z=L）
    shank = make_cylinder(0, 0, 0, d / 2, L)

    # 头部（六棱柱，z=L 到 z=L+k）
    head = make_hex_prism(0, 0, L, s, k)

    # 头部顶面倒角
    head = chamfer_top(head, s / math.sqrt(3.0), c, L + k)

    body = head.fuse(shank)

    # 螺纹示意（杆下部 b 段）
    if b > 0:
        body = add_external_thread(body, d, pitch, b, 0)

    print(f"[OK] 六角头螺栓 3D 模型创建完成: M{d}×{L}")
    return body


def create_nut(params: Dict[str, float]):
    """
    创建六角螺母（轴向沿 +Z）。

    几何：六角本体 + 内螺纹孔 + 两端倒角。
    """
    d = params.get("d", 10)
    m = params.get("nutHeight", params.get("m", 8.4))
    s = params.get("s", 16)

    body = make_hex_prism(0, 0, 0, s, m)

    # 内孔（简化：孔径取公称直径；真实内螺纹小径约 0.8d）
    hole = make_cylinder(0, 0, -1, d / 2, m + 2)
    body = body.cut(hole)

    # 两端倒角
    body = chamfer_top(body, s / math.sqrt(3.0), 0.5, m)
    body = chamfer_bottom(body, s / math.sqrt(3.0), 0.5, 0)

    print(f"[OK] 六角螺母 3D 模型创建完成: M{d}")
    return body


def create_washer(params: Dict[str, float]):
    """创建平垫圈（环形扁圆柱，外圆柱减内圆柱）。"""
    d1 = params.get("innerDiameter", params.get("d1", 10.5))
    d2 = params.get("outerDiameter", params.get("d2", 24))
    h = params.get("washerThickness", params.get("h", 2))

    outer = make_cylinder(0, 0, 0, d2 / 2, h)
    inner = make_cylinder(0, 0, -1, d1 / 2, h + 2)
    washer = outer.cut(inner)

    print(f"[OK] 平垫圈 3D 模型创建完成: Φ{d1}×Φ{d2}×{h}")
    return washer


def create_screw(params: Dict[str, float]):
    """
    创建内六角圆柱头螺钉（轴向沿 +Z）。

    几何：圆柱头 + 内六角沉孔 + 螺杆 + 螺纹示意。
    """
    d = params.get("d", 8)
    L = params.get("L", 25)
    dk = params.get("headDiameter", params.get("dk", 13))
    k = params.get("headHeight", params.get("k", 5))
    s = params.get("s", 6)  # 内六角对边
    b = params.get("threadLength", params.get("b", 22))
    pitch = params.get("pitch", 1.25)

    shank = make_cylinder(0, 0, 0, d / 2, L)
    head = make_cylinder(0, 0, L, dk / 2, k)

    # 内六角沉孔（六棱柱差集）
    socket = make_hex_prism(0, 0, L + k - k * 0.75, s, k * 0.75)
    head = head.cut(socket)

    body = head.fuse(shank)
    if b > 0:
        body = add_external_thread(body, d, pitch, b, 0)

    print(f"[OK] 内六角螺钉 3D 模型创建完成: M{d}×{L}")
    return body


def create_rivet(params: Dict[str, float]):
    """
    创建半圆头铆钉（轴向沿 +Z，钉杆在 z=0..L，半球头在顶端）。

    球冠半径由公式 R=(dk²+4k²)/(8k) 求得，保证冠高为 k。
    """
    d = params.get("d", 6)
    dk = params.get("rivetHeadDiameter", params.get("dk", 10.8))
    k = params.get("rivetHeadHeight", params.get("k", 3.6))
    L = params.get("rivetLength", params.get("L", 20))

    shank = make_cylinder(0, 0, 0, d / 2, L)

    # 球冠头：球心在 z = L - R + k，切除 z < L 的下半部分保留冠
    R = (dk * dk + 4 * k * k) / (8 * k)
    cz = L - R + k
    head = make_sphere(0, 0, cz, R)
    cutter = make_box(-R, -R, L - R, 2 * R, 2 * R, R)  # 覆盖 z in [L-R, L]
    head = head.cut(cutter)

    body = head.fuse(shank)
    print(f"[OK] 半圆头铆钉 3D 模型创建完成: Φ{d}×{L}")
    return body


def create_pin(params: Dict[str, float]):
    """创建圆柱销（圆柱 + 两端 45° 倒角）。"""
    d = params.get("pinDiameter", params.get("d", 8))
    L = params.get("pinLength", params.get("L", 40))
    c = params.get("c", 0.6)

    pin = make_cylinder(0, 0, 0, d / 2, L)
    pin = chamfer_top(pin, d / 2, c, L)
    pin = chamfer_bottom(pin, d / 2, c, 0)

    print(f"[OK] 圆柱销 3D 模型创建完成: Φ{d}×{L}")
    return pin


def create_stud(params: Dict[str, float]):
    """创建双头螺柱（中部光杆 + 两端螺纹段）。"""
    d = params.get("d", 12)
    L = params.get("L", 60)
    b = params.get("threadLength", params.get("b", 30))
    pitch = params.get("pitch", 1.75)

    body = make_cylinder(0, 0, 0, d / 2, L)
    if b > 0:
        body = add_external_thread(body, d, pitch, b, 0)          # 下端螺纹
        body = add_external_thread(body, d, pitch, b, L - b)      # 上端螺纹

    print(f"[OK] 双头螺柱 3D 模型创建完成: M{d}×{L}")
    return body


# ============================================================
# 4. 紧固件类型映射表
# ============================================================

FASTENER_CREATORS = {
    "bolt": create_bolt,
    "nut": create_nut,
    "washer": create_washer,
    "screw": create_screw,
    "rivet": create_rivet,
    "pin": create_pin,
    "stud": create_stud,
}

FASTENER_NAMES = {
    "bolt": "六角头螺栓",
    "nut": "六角螺母",
    "washer": "平垫圈",
    "screw": "内六角螺钉",
    "rivet": "半圆头铆钉",
    "pin": "圆柱销",
    "stud": "双头螺柱",
}


# ============================================================
# 5. 输出保存
# ============================================================

def save_model(shape, output_dir: str, filename: str, save_fcstd: bool = False):
    """将实体保存为 STEP + STL（可选 FCStd）。"""
    os.makedirs(output_dir, exist_ok=True)

    step_path = os.path.join(output_dir, f"{filename}.step")
    stl_path = os.path.join(output_dir, f"{filename}.stl")

    shape.exportStep(step_path)
    print(f"[OK] STEP 已保存: {step_path}")

    import MeshPart
    mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=0.1, AngularDeflection=0.5, Relative=False)
    mesh.write(stl_path)
    print(f"[OK] STL 已保存: {stl_path}")

    if save_fcstd:
        doc = App.newDocument(filename)
        obj = doc.addObject("Part::Feature", filename)
        obj.Shape = shape
        doc.recompute()
        fcstd_path = os.path.join(output_dir, f"{filename}.FCStd")
        doc.saveAs(fcstd_path)
        print(f"[OK] FreeCAD 文档已保存: {fcstd_path}")
        App.closeDocument(doc.Name)


def build_single_fastener(fastener_type: str, params: Dict[str, float],
                          output_dir: Optional[str] = None,
                          filename: Optional[str] = None,
                          save_fcstd: bool = False):
    """构建单个紧固件模型，并（可选）保存文件。"""
    _require_freecad()

    creator = FASTENER_CREATORS.get(fastener_type)
    if not creator:
        print(f"[ERROR] 不支持的紧固件类型: {fastener_type}")
        print(f"        支持的类型: {', '.join(FASTENER_CREATORS.keys())}")
        return None

    try:
        shape = creator(params)
        print(f"[OK] {FASTENER_NAMES.get(fastener_type, fastener_type)} 建模成功")

        if output_dir and filename:
            save_model(shape, output_dir, filename, save_fcstd)

        return shape
    except Exception as e:
        print(f"[ERROR] 建模失败: {e}")
        import traceback
        traceback.print_exc()
        return None


def batch_build_from_json(json_path: str, output_dir: str = "output",
                          save_fcstd: bool = False):
    """
    从 JSON 文件批量读取参数并建模。

    JSON 格式：
    {
        "fasteners": [
            { "type": "bolt", "params": { "d": 10, "L": 40, ... }, "position": [0,0,0] },
            ...
        ]
    }
    """
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    fasteners = data.get("fasteners", [])
    if not fasteners:
        print("[WARN] JSON 文件中没有找到紧固件数据")
        return

    print(f"[INFO] 开始批量建模，共 {len(fasteners)} 个紧固件...")

    for i, item in enumerate(fasteners):
        ftype = item.get("type", "")
        params = item.get("params", item.get("geometry", {}))
        # 兼容「标准库样本」的字段命名（geometry.xxx → d/L 等）
        params = _normalize_sample_params(ftype, params)
        pos = item.get("position", [0, 0, 0])
        name = f"{ftype}_{params.get('d', '')}x{params.get('L', '')}"
        print(f"\n[{i+1}/{len(fasteners)}] {FASTENER_NAMES.get(ftype, ftype)} ({name})")
        build_single_fastener(ftype, params, output_dir, name, save_fcstd)


def _normalize_sample_params(ftype: str, geom: Dict[str, Any]) -> Dict[str, float]:
    """
    将「标准库样本 JSON」的长字段名映射为建模函数使用的短字段名。

    样本使用 nominalDiameter/length/headDiameter/... 命名，建模函数使用 d/L/dk/...，
    这里做一层兼容转换，使本脚本可直接消费 standard-library/samples/ 下的文件。
    """
    p = dict(geom)

    if "nominalDiameter" in p and "d" not in p:
        p["d"] = p["nominalDiameter"]
    if "length" in p and "L" not in p:
        p["L"] = p["length"]
    if "headDiameter" in p and "dk" not in p:
        p["dk"] = p["headDiameter"]
    if "headHeight" in p and "k" not in p:
        p["k"] = p["headHeight"]
    if "widthAcrossFlats" in p and "s" not in p:
        p["s"] = p["widthAcrossFlats"]
    if "threadLength" in p and "b" not in p:
        p["b"] = p["threadLength"]
    if "nutHeight" in p and "m" not in p:
        p["m"] = p["nutHeight"]
    if "innerDiameter" in p and "d1" not in p:
        p["d1"] = p["innerDiameter"]
    if "outerDiameter" in p and "d2" not in p:
        p["d2"] = p["outerDiameter"]
    if "washerThickness" in p and "h" not in p:
        p["h"] = p["washerThickness"]
    if "pinDiameter" in p and "d" not in p:
        p["d"] = p["pinDiameter"]
    if "pinLength" in p and "L" not in p:
        p["L"] = p["pinLength"]
    if "rivetHeadDiameter" in p and "dk" not in p:
        p["dk"] = p["rivetHeadDiameter"]
    if "rivetHeadHeight" in p and "k" not in p:
        p["k"] = p["rivetHeadHeight"]
    if "rivetLength" in p and "L" not in p:
        p["L"] = p["rivetLength"]

    return p


# ============================================================
# 6. 命令行入口
# ============================================================

def parse_cli_args(argv=None):
    parser = argparse.ArgumentParser(
        description="FreeCAD 标准紧固件智能建模工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  freecadcmd scripts/freecad_modeler.py -i params.json
  freecadcmd scripts/freecad_modeler.py -t bolt -d 10 -l 40 -k 7 --dk 18 -s 16
  freecadcmd scripts/freecad_modeler.py --batch batch.json
  freecadcmd scripts/freecad_modeler.py --interactive
  freecadcmd scripts/freecad_modeler.py --export-template bolt
        """,
    )
    parser.add_argument("-i", "--input", help="输入JSON文件路径")
    parser.add_argument("-t", "--type", choices=list(FASTENER_CREATORS.keys()),
                        help="紧固件类型")
    parser.add_argument("-d", "--diameter", type=float, help="公称直径 (mm)")
    parser.add_argument("-l", "--length", type=float, help="长度 (mm)")
    parser.add_argument("-k", "--head-height", type=float, help="头部高度 (mm)")
    parser.add_argument("--dk", type=float, help="头部直径 (mm)")
    parser.add_argument("-s", "--wrench-size", type=float, help="对边宽度 (mm)")
    parser.add_argument("--pitch", type=float, help="螺距 (mm)")
    parser.add_argument("-b", "--thread-length", type=float, help="螺纹长度 (mm)")
    parser.add_argument("--batch", help="批量建模JSON文件路径")
    parser.add_argument("--interactive", action="store_true", help="交互式模式")
    parser.add_argument("--export-template", metavar="TYPE",
                        help=f"导出参数模板（类型: {', '.join(FASTENER_CREATORS.keys())}）")
    parser.add_argument("--output", default="output", help="输出目录")
    parser.add_argument("--fcstd", action="store_true", help="额外保存 .FCStd 文档")
    return parser.parse_args(argv)


def export_template(fastener_type: str):
    """导出指定类型的参数模板 JSON（无需 FreeCAD 即可运行）。"""
    templates = {
        "bolt": {"type": "bolt", "params": {"d": 10, "L": 40, "dk": 18, "k": 7, "s": 16, "b": 26, "pitch": 1.5, "c": 0.6},
                 "attributes": {"standardNo": "GB/T 5782-2016", "materialName": "45钢", "materialGrade": "8.8"}},
        "nut": {"type": "nut", "params": {"d": 10, "nutHeight": 8.4, "s": 16, "pitch": 1.5},
                "attributes": {"standardNo": "GB/T 6170-2015", "materialName": "45钢", "materialGrade": "8"}},
        "washer": {"type": "washer", "params": {"d": 10, "innerDiameter": 10.5, "outerDiameter": 24, "washerThickness": 2},
                   "attributes": {"standardNo": "GB/T 97.1-2002", "materialName": "65Mn"}},
        "screw": {"type": "screw", "params": {"d": 8, "L": 25, "dk": 13, "k": 5, "s": 6, "b": 22, "pitch": 1.25},
                  "attributes": {"standardNo": "GB/T 70.1-2008", "materialName": "45钢", "materialGrade": "8.8"}},
        "rivet": {"type": "rivet", "params": {"d": 6, "rivetHeadDiameter": 10.8, "rivetHeadHeight": 3.6, "rivetLength": 20},
                  "attributes": {"standardNo": "GB/T 867-1986", "materialName": "Q235"}},
        "pin": {"type": "pin", "params": {"pinDiameter": 8, "pinLength": 40, "c": 0.6},
                "attributes": {"standardNo": "GB/T 119.1-2000", "materialName": "45钢"}},
        "stud": {"type": "stud", "params": {"d": 12, "L": 60, "threadLength": 30, "pitch": 1.75},
                 "attributes": {"standardNo": "GB/T 897-1988", "materialName": "45钢", "materialGrade": "8.8"}},
    }

    template = templates.get(fastener_type)
    if not template:
        print(f"[ERROR] 未知类型: {fastener_type}")
        print(f"        支持的类型: {', '.join(templates.keys())}")
        return

    filename = f"template_{fastener_type}.json"
    with open(filename, "w", encoding="utf-8") as f:
        json.dump(template, f, ensure_ascii=False, indent=2)
    print(f"[OK] 参数模板已导出: {filename}")
    print(f"    类型: {FASTENER_NAMES.get(fastener_type)}")
    print("")
    print("使用方法:")
    print(f"  freecadcmd scripts/freecad_modeler.py -i {filename}")


def interactive_mode():
    """交互式建模模式。"""
    _require_freecad()
    print("\n=== FreeCAD 交互式建模模式 ===\n")
    print("支持的紧固件类型:")
    for key, name in FASTENER_NAMES.items():
        print(f"  {key}: {name}")

    param_prompts = {
        "bolt": [("d", "公称直径", 10), ("L", "长度", 40), ("dk", "头部直径", 18),
                 ("k", "头部高度", 7), ("s", "对边宽度", 16)],
        "nut": [("d", "公称直径", 10), ("m", "螺母高度", 8.4), ("s", "对边宽度", 16)],
        "washer": [("d1", "内径", 10.5), ("d2", "外径", 24), ("h", "厚度", 2)],
        "screw": [("d", "公称直径", 8), ("L", "长度", 25), ("dk", "头部直径", 13), ("k", "头部高度", 5)],
        "rivet": [("d", "公称直径", 6), ("dk", "钉头直径", 10.8), ("k", "钉头高度", 3.6), ("L", "钉杆长度", 20)],
        "pin": [("d", "销直径", 8), ("L", "长度", 40)],
        "stud": [("d", "公称直径", 12), ("L", "长度", 60), ("b", "螺纹长度", 30)],
    }

    while True:
        ftype = input("\n请输入紧固件类型 (或输入 q 退出): ").strip().lower()
        if ftype == "q":
            break
        if ftype not in FASTENER_CREATORS:
            print(f"[ERROR] 不支持的类型。请从以下选择: {', '.join(FASTENER_CREATORS.keys())}")
            continue

        params = {}
        print(f"\n请输入 {FASTENER_NAMES[ftype]} 的参数（直接回车使用默认值）:")
        for key, name, default in param_prompts.get(ftype, []):
            val = input(f"  {name} ({key}) [{default}]: ").strip()
            params[key] = float(val) if val else default

        build_single_fastener(ftype, params, "output", f"{ftype}_{params.get('d','')}x{params.get('L','')}")
        print("\n" + "=" * 40)


def _normalize_argv():
    """
    统一不同运行方式下的 sys.argv 布局。

    普通 python 下： sys.argv = [script.py, -t, bolt, ...]
    freecadcmd 下： sys.argv = [freecadcmd, script.py, --, -t, bolt, ...]
    统一为：       [-t, bolt, ...]
    """
    args = list(sys.argv[1:])
    # freecadcmd 会把脚本名放在 argv[1]
    if args and args[0].endswith('.py'):
        args = args[1:]
    # 去掉 freecadcmd 的参数分隔符 '--'
    args = [a for a in args if a != '--']
    return args


def main():
    args = parse_cli_args(_normalize_argv())

    # 仅导出模板模式（无需 FreeCAD）
    if args.export_template:
        export_template(args.export_template)
        return

    # 构建参数
    if args.input:
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)
        fastener_type = data.get("type", data.get("fastener_type", "bolt"))
        params = data.get("params", data.get("geometry", data))
        if "nominalDiameter" in params:
            params = _normalize_sample_params(fastener_type, params)
    elif args.type:
        fastener_type = args.type
        params = {
            "d": args.diameter or 10,
            "L": args.length or 40,
        }
        if args.head_height:
            params["k"] = args.head_height
        if args.dk:
            params["dk"] = args.dk
        if args.wrench_size:
            params["s"] = args.wrench_size
        if args.pitch:
            params["pitch"] = args.pitch
        if args.thread_length:
            params["b"] = args.thread_length
    else:
        print("[ERROR] 请指定输入文件或参数。使用 -h 查看帮助。")
        return

    _require_freecad()

    if args.batch:
        batch_build_from_json(args.batch, args.output, args.fcstd)
    elif args.interactive:
        interactive_mode()
    else:
        build_single_fastener(
            fastener_type, params,
            args.output,
            f"{fastener_type}_{params.get('d', '')}x{params.get('L', '')}",
            args.fcstd,
        )

    print("\n[INFO] 模型已保存到 output/ 目录（STEP + STL）。")
    print("[INFO] 可在 FreeCAD GUI 中打开 .FCStd 或导入 .step 查看。")
    print("[INFO] Web 端预览: http://localhost:5000")


# freecadcmd 运行脚本时会把 __name__ 设为脚本文件名（而非 "__main__"），
# 导致 __main__ 守卫不触发。这里直接调用 main()，保证 freecadcmd 与普通 python 下都能执行。
main()
