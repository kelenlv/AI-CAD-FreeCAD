import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fasteners, format = 'python' } = body;

    if (!fasteners || !Array.isArray(fasteners) || fasteners.length === 0) {
      return NextResponse.json(
        { success: false, error: '请提供紧固件数据列表' },
        { status: 400 }
      );
    }

    if (format === 'python') {
      // 生成 FreeCAD Python 脚本 (.py)
      const script = generateFreecadScript(fasteners);
      return NextResponse.json({
        success: true,
        data: {
          content: script,
          filename: 'freecad_fastener_model.py',
          mimeType: 'text/x-python; charset=utf-8',
        },
      });
    } else if (format === 'params') {
      // 生成参数 JSON 文件（供 FreeCAD 脚本读取）
      const paramsJson = generateParamsJson(fasteners);
      return NextResponse.json({
        success: true,
        data: {
          content: paramsJson,
          filename: 'fastener_params.json',
          mimeType: 'application/json; charset=utf-8',
        },
      });
    }

    return NextResponse.json(
      { success: false, error: `不支持的格式: ${format}` },
      { status: 400 }
    );
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { success: false, error: `导出失败: ${errMsg}` },
      { status: 500 }
    );
  }
}

/** 生成 FreeCAD Python 建模脚本 */
function generateFreecadScript(fasteners: any[]): string {
  const lines: string[] = [];
  lines.push('#!/usr/bin/env python3');
  lines.push('# -*- coding: utf-8 -*-');
  lines.push('# ================================================');
  lines.push('# FreeCAD 标准紧固件建模脚本 — 由FastenerModel AI生成');
  lines.push('# ================================================');
  lines.push(`# 生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`# 紧固件数量: ${fasteners.length}`);
  lines.push('#');
  lines.push('# 运行（需已安装 FreeCAD）：');
  lines.push('#   freecadcmd freecad_fastener_model.py');
  lines.push('#');
  lines.push('# 输出：output/fasteners.step + output/fasteners.stl');
  lines.push('');
  lines.push('import math');
  lines.push('import os');
  lines.push('import FreeCAD as App');
  lines.push('import Part');
  lines.push('from FreeCAD import Base');
  lines.push('V = Base.Vector');
  lines.push('');
  lines.push('def make_cylinder(cx, cy, cz, r, h):');
  lines.push('    return Part.makeCylinder(r, h, V(cx, cy, cz), V(0, 0, 1))');
  lines.push('');
  lines.push('def make_hex_prism(cx, cy, z0, s, h, a=30.0):');
  lines.push('    R = s / math.sqrt(3.0)');
  lines.push('    pts = [V(cx + R * math.cos(math.radians(a + 60 * i)),');
  lines.push('             cy + R * math.sin(math.radians(a + 60 * i)), z0) for i in range(6)]');
  lines.push('    return Part.Face(Part.makePolygon(pts, True)).extrude(V(0, 0, h))');
  lines.push('');
  lines.push('def fuse_all(shapes):');
  lines.push('    r = None');
  lines.push('    for s in shapes:');
  lines.push('        r = s if r is None else r.fuse(s)');
  lines.push('    return r');
  lines.push('');
  lines.push('def add_thread(shape, d, pitch, length, z0):');
  lines.push('    z = z0');
  lines.push('    while z <= z0 + length + 1e-9:');
  lines.push('        try:');
  lines.push('            shape = shape.fuse(Part.makeTorus(d / 2, pitch * 0.15, V(0, 0, z), V(0, 0, 1)))');
  lines.push('        except Exception:');
  lines.push('            pass');
  lines.push('        z += pitch');
  lines.push('    return shape');
  lines.push('');
  lines.push('shapes = []');
  lines.push('');

  // 逐件生成建模代码
  let index = 0;
  const spacing = 50;

  for (const f of fasteners) {
    const type = f.type || 'bolt';
    const geom = f.geometry || {};
    const attrs = f.attributes || {};
    const posX = index * spacing;
    const partName = attrs.partName || type;
    const stdNo = attrs.standardNo || 'GB/T';

    lines.push(`# ------ ${partName} (${stdNo}) ------`);
    lines.push(`print("[${index + 1}/${fasteners.length}] 正在生成 ${partName}...")`);

    switch (type) {
      case 'bolt': {
        const d = geom.nominalDiameter || 10;
        const L = geom.length || 40;
        const k = geom.headHeight || 7;
        const s = geom.widthAcrossFlats || 16;
        const b = geom.threadLength || 26;
        const pitch = geom.pitch || 1.5;
        lines.push(`d, L, k, s, b, pitch = ${d}, ${L}, ${k}, ${s}, ${b}, ${pitch}`);
        lines.push(`shank = make_cylinder(${posX}, 0, 0, d / 2, L)`);
        lines.push(`head = make_hex_prism(${posX}, 0, L, s, k)`);
        lines.push(`body = head.fuse(shank)`);
        lines.push(`body = add_thread(body, d, pitch, b, 0)`);
        lines.push(`shapes.append(body)`);
        break;
      }
      case 'nut': {
        const d = geom.nominalDiameter || 10;
        const m = geom.nutHeight || 8.4;
        const s = geom.widthAcrossFlats || 16;
        lines.push(`d, m, s = ${d}, ${m}, ${s}`);
        lines.push(`body = make_hex_prism(${posX}, 0, 0, s, m)`);
        lines.push(`hole = make_cylinder(${posX}, 0, -1, d / 2, m + 2)`);
        lines.push(`shapes.append(body.cut(hole))`);
        break;
      }
      case 'washer': {
        const d1 = geom.innerDiameter || 10.5;
        const d2 = geom.outerDiameter || 24;
        const h = geom.washerThickness || 2;
        lines.push(`d1, d2, h = ${d1}, ${d2}, ${h}`);
        lines.push(`outer = make_cylinder(${posX}, 0, 0, d2 / 2, h)`);
        lines.push(`inner = make_cylinder(${posX}, 0, -1, d1 / 2, h + 2)`);
        lines.push(`shapes.append(outer.cut(inner))`);
        break;
      }
      case 'rivet': {
        const d = geom.nominalDiameter || 6;
        const dk = geom.rivetHeadDiameter || 10.8;
        const k = geom.rivetHeadHeight || 3.6;
        const L = geom.rivetLength || 20;
        lines.push(`d, dk, k, L = ${d}, ${dk}, ${k}, ${L}`);
        lines.push(`R = (dk * dk + 4 * k * k) / (8 * k)`);
        lines.push(`shank = make_cylinder(${posX}, 0, 0, d / 2, L)`);
        lines.push(`cz = L - R + k`);
        lines.push(`head = Part.makeSphere(R, V(${posX}, 0, cz))`);
        lines.push(`cutter = Part.makeBox(2 * R, 2 * R, R, V(${posX} - R, -R, L - R), V(0, 0, 1))`);
        lines.push(`shapes.append(head.cut(cutter).fuse(shank))`);
        break;
      }
      case 'pin': {
        const d = geom.pinDiameter || geom.nominalDiameter || 8;
        const L = geom.pinLength || geom.length || 40;
        lines.push(`d, L = ${d}, ${L}`);
        lines.push(`shapes.append(make_cylinder(${posX}, 0, 0, d / 2, L))`);
        break;
      }
      case 'screw': {
        const d = geom.nominalDiameter || 8;
        const L = geom.length || 25;
        const dk = geom.headDiameter || 13;
        const k = geom.headHeight || 5;
        const s = geom.widthAcrossFlats || 6;
        const b = geom.threadLength || 22;
        const pitch = geom.pitch || 1.25;
        lines.push(`d, L, dk, k, s, b, pitch = ${d}, ${L}, ${dk}, ${k}, ${s}, ${b}, ${pitch}`);
        lines.push(`shank = make_cylinder(${posX}, 0, 0, d / 2, L)`);
        lines.push(`head = make_cylinder(${posX}, 0, L, dk / 2, k)`);
        lines.push(`socket = make_hex_prism(${posX}, 0, L + k - k * 0.75, s, k * 0.75)`);
        lines.push(`body = head.cut(socket).fuse(shank)`);
        lines.push(`shapes.append(add_thread(body, d, pitch, b, 0))`);
        break;
      }
      case 'stud': {
        const d = geom.nominalDiameter || 12;
        const L = geom.length || 60;
        const b = geom.threadLength || 30;
        const pitch = geom.pitch || 1.75;
        lines.push(`d, L, b, pitch = ${d}, ${L}, ${b}, ${pitch}`);
        lines.push(`body = make_cylinder(${posX}, 0, 0, d / 2, L)`);
        lines.push(`body = add_thread(body, d, pitch, b, 0)`);
        lines.push(`body = add_thread(body, d, pitch, b, L - b)`);
        lines.push(`shapes.append(body)`);
        break;
      }
      default: {
        const d = geom.nominalDiameter || 10;
        lines.push(`# 未支持的紧固件类型，生成占位圆柱`);
        lines.push(`shapes.append(make_cylinder(${posX}, 0, 0, ${d} / 2, ${d} * 2))`);
      }
    }

    lines.push(`print(f"  OK ${partName} 生成完成")`);
    lines.push('');
    index++;
  }

  // 保存输出
  lines.push('# ===== 保存输出 =====');
  lines.push('combined = fuse_all(shapes)');
  lines.push('os.makedirs("output", exist_ok=True)');
  lines.push('combined.exportStep("output/fasteners.step")');
  lines.push('import MeshPart');
  lines.push('mesh = MeshPart.meshFromShape(Shape=combined, LinearDeflection=0.1, AngularDeflection=0.5, Relative=False)');
  lines.push('mesh.write("output/fasteners.stl")');
  lines.push('print("\\n[OK] 已保存: output/fasteners.step / output/fasteners.stl")');
  lines.push('print("[INFO] 可在 FreeCAD GUI 中打开查看，或导入 .step 到其它 CAD 软件。")');

  return lines.join('\n');
}

/** 生成参数 JSON 文件（供 FreeCAD 脚本读取） */
function generateParamsJson(fasteners: any[]): string {
  const output: any[] = fasteners.map((f, i) => {
    const type = f.type || 'bolt';
    const geom = f.geometry || {};
    const attrs = f.attributes || {};

    const params: Record<string, any> = {};

    switch (type) {
      case 'bolt':
        params.d = geom.nominalDiameter;
        params.L = geom.length;
        params.dk = geom.headDiameter;
        params.k = geom.headHeight;
        params.s = geom.widthAcrossFlats;
        params.b = geom.threadLength;
        params.pitch = geom.pitch;
        break;
      case 'nut':
        params.d = geom.nominalDiameter;
        params.m = geom.nutHeight;
        params.s = geom.widthAcrossFlats;
        break;
      case 'washer':
        params.d = geom.nominalDiameter;
        params.d1 = geom.innerDiameter;
        params.d2 = geom.outerDiameter;
        params.h = geom.washerThickness;
        break;
      case 'rivet':
        params.d = geom.nominalDiameter;
        params.dk = geom.rivetHeadDiameter;
        params.k = geom.rivetHeadHeight;
        params.L = geom.rivetLength;
        break;
      case 'pin':
        params.d = geom.pinDiameter || geom.nominalDiameter;
        params.L = geom.pinLength || geom.length;
        break;
      case 'screw':
        params.d = geom.nominalDiameter;
        params.L = geom.length;
        params.dk = geom.headDiameter;
        params.k = geom.headHeight;
        params.s = geom.widthAcrossFlats;
        break;
      case 'stud':
        params.d = geom.nominalDiameter;
        params.L = geom.length;
        params.b = geom.threadLength;
        break;
    }

    return {
      index: i + 1,
      type,
      partName: attrs.partName || '',
      standardNo: attrs.standardNo || '',
      params,
      attributes: {
        materialName: attrs.materialName || '',
        materialGrade: attrs.materialGrade || '',
        surfaceTreatment: attrs.surfaceTreatment || '',
        weight: attrs.weight || '',
        unit: attrs.unit || '件',
      },
    };
  });

  return JSON.stringify(
    {
      version: '1.0',
      generator: 'FastenerModel AI',
      generatedAt: new Date().toISOString(),
      description: '标准紧固件智能建模参数文件 — 供 FreeCAD 脚本使用',
      fasteners: output,
    },
    null,
    2
  );
}
