#!/usr/bin/env node

/**
 * 标准紧固件库批量生成脚本
 *
 * 功能：读取 standard-library/samples/ 目录下的所有样本参数文件，
 * 生成可导入 FreeCAD 的批量建模 Python 脚本。
 *
 * 用法：
 *   node standard-library/generate-library.js
 *
 * 输出：
 *   - standard-library/output/freecad_batch_model.py - FreeCAD 批量建模脚本
 *   - standard-library/output/library_attributes.csv  - 完整属性表
 *   - standard-library/output/library_manifest.json  - 库清单更新
 */

const fs = require('fs');
const path = require('path');

const SAMPLES_DIR = path.join(__dirname, 'samples');
const OUTPUT_DIR = path.join(__dirname, 'output');
const MANIFEST_PATH = path.join(__dirname, 'library-manifest.json');

// 确保输出目录存在
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

/** 读取所有样本文件 */
function loadAllSamples() {
  const categories = fs.readdirSync(SAMPLES_DIR);
  const allSamples = [];

  for (const category of categories) {
    const categoryPath = path.join(SAMPLES_DIR, category);
    if (!fs.statSync(categoryPath).isDirectory()) continue;

    const files = fs.readdirSync(categoryPath).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(content);
      allSamples.push({ ...data, _file: file, _category: category });
    }
  }

  return allSamples;
}

/** 生成 FreeCAD 批量建模 Python 脚本 */
function generateFreecadBatchScript(samples) {
  const samplesJson = samples.map(s => ({
    type: s.type,
    standardNo: s.standardNo || (s.attributes && s.attributes.standardNo) || '',
    partName: (s.attributes && s.attributes.partName) || s.type,
    specification: (s.attributes && s.attributes.specification) || '',
    geometry: s.geometry || {},
  }));

  const header = `#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# ================================================
# FreeCAD 标准紧固件批量建模脚本
# 由 FastenerModel AI 系统自动生成
# 生成时间: ${new Date().toLocaleString('zh-CN')}
# 样本数量: ${samples.length}
# ================================================
#
# 运行（需已安装 FreeCAD）:
#   freecadcmd freecad_batch_model.py
#
# 输出: output/fastener_library.step / output/fastener_library.stl
import os
import math
import FreeCAD as App
import Part
from FreeCAD import Base
V = Base.Vector


def make_cylinder(cx, cy, cz, r, h):
    return Part.makeCylinder(r, h, V(cx, cy, cz), V(0, 0, 1))


def make_hex_prism(cx, cy, z0, s, h, a=30.0):
    R = s / math.sqrt(3.0)
    pts = [V(cx + R * math.cos(math.radians(a + 60 * i)),
             cy + R * math.sin(math.radians(a + 60 * i)), z0) for i in range(6)]
    return Part.Face(Part.makePolygon(pts, True)).extrude(V(0, 0, h))


def add_thread(shape, d, pitch, length, z0):
    z = z0
    while z <= z0 + length + 1e-9:
        try:
            shape = shape.fuse(Part.makeTorus(d / 2, pitch * 0.15, V(0, 0, z), V(0, 0, 1)))
        except Exception:
            pass
        z += pitch
    return shape


def create_bolt(geo):
    d = geo.get('nominalDiameter', 10); L = geo.get('length', 40)
    k = geo.get('headHeight', 7); s = geo.get('widthAcrossFlats', 16)
    b = geo.get('threadLength', 26); pitch = geo.get('pitch', 1.5)
    shank = make_cylinder(0, 0, 0, d / 2, L)
    head = make_hex_prism(0, 0, L, s, k)
    return add_thread(head.fuse(shank), d, pitch, b, 0)


def create_nut(geo):
    d = geo.get('nominalDiameter', 10); m = geo.get('nutHeight', 8.4)
    s = geo.get('widthAcrossFlats', 16)
    body = make_hex_prism(0, 0, 0, s, m)
    hole = make_cylinder(0, 0, -1, d / 2, m + 2)
    return body.cut(hole)


def create_washer(geo):
    d1 = geo.get('innerDiameter', 10.5); d2 = geo.get('outerDiameter', 24)
    h = geo.get('washerThickness', 2)
    outer = make_cylinder(0, 0, 0, d2 / 2, h)
    inner = make_cylinder(0, 0, -1, d1 / 2, h + 2)
    return outer.cut(inner)


def create_rivet(geo):
    d = geo.get('nominalDiameter', 6); dk = geo.get('rivetHeadDiameter', 10.8)
    k = geo.get('rivetHeadHeight', 3.6); L = geo.get('rivetLength', 20)
    R = (dk * dk + 4 * k * k) / (8 * k)
    shank = make_cylinder(0, 0, 0, d / 2, L)
    cz = L - R + k
    head = Part.makeSphere(R, V(0, 0, cz))
    cutter = Part.makeBox(2 * R, 2 * R, R, V(-R, -R, L - R), V(0, 0, 1))
    return head.cut(cutter).fuse(shank)


def create_pin(geo):
    d = geo.get('pinDiameter', geo.get('nominalDiameter', 8))
    L = geo.get('pinLength', geo.get('length', 40))
    return make_cylinder(0, 0, 0, d / 2, L)


def create_screw(geo):
    d = geo.get('nominalDiameter', 8); L = geo.get('length', 25)
    dk = geo.get('headDiameter', 13); k = geo.get('headHeight', 5)
    s = geo.get('widthAcrossFlats', 6); b = geo.get('threadLength', 22)
    pitch = geo.get('pitch', 1.25)
    shank = make_cylinder(0, 0, 0, d / 2, L)
    head = make_cylinder(0, 0, L, dk / 2, k)
    socket = make_hex_prism(0, 0, L + k - k * 0.75, s, k * 0.75)
    return add_thread(head.cut(socket).fuse(shank), d, pitch, b, 0)


def create_stud(geo):
    d = geo.get('nominalDiameter', 12); L = geo.get('length', 60)
    b = geo.get('threadLength', 30); pitch = geo.get('pitch', 1.75)
    body = make_cylinder(0, 0, 0, d / 2, L)
    body = add_thread(body, d, pitch, b, 0)
    return add_thread(body, d, pitch, b, L - b)


FASTENER_BUILDERS = {
    'bolt': create_bolt, 'nut': create_nut, 'washer': create_washer,
    'rivet': create_rivet, 'pin': create_pin, 'screw': create_screw, 'stud': create_stud,
}
`;

  const samplesBlock = 'SAMPLES = ' + JSON.stringify(samplesJson, null, 2);

  const tail = `


def main():
    shapes = []
    spacing = 50.0
    cols = 5
    for i, s in enumerate(SAMPLES):
        ftype = s['type']
        spec = s['specification'] or ftype
        builder = FASTENER_BUILDERS.get(ftype)
        print(f"[{i + 1}/{len(SAMPLES)}] {spec} ...")
        if builder is None:
            print(f"  [WARN] 不支持的紧固件类型: {ftype}")
            continue
        try:
            shape = builder(s['geometry'])
            # 网格布局，避免各件重叠
            dx = (i % cols) * spacing
            dy = (i // cols) * spacing
            shape.translate(V(dx, dy, 0))
            shapes.append(shape)
            print(f"  [OK] {spec} 创建完成")
        except Exception as e:
            print(f"  [ERROR] {spec} 失败: {e}")

    combined = None
    for sh in shapes:
        combined = sh if combined is None else combined.fuse(sh)

    os.makedirs('output', exist_ok=True)
    combined.exportStep('output/fastener_library.step')
    import MeshPart
    mesh = MeshPart.meshFromShape(Shape=combined, LinearDeflection=0.1, AngularDeflection=0.5, Relative=False)
    mesh.write('output/fastener_library.stl')
    print("\\n批量建模完成!")
    print(f"成功: {len(shapes)}/{len(SAMPLES)}")
    print("输出: output/fastener_library.step / .stl")


# freecadcmd 下 __name__ 为脚本文件名，故直接调用 main()
main()
`;

  return header + '\n\n' + samplesBlock + '\n\n' + tail;
}

/** 生成 CSV 属性表 */
function generateCSV(samples) {
  const headers = [
    '序号', '物资名称', '标准号', '规格', '资源分类',
    '材料牌号', '性能等级', '表面处理',
    '公称直径(mm)', '长度(mm)', '螺纹类型', '螺距(mm)',
    '理论重量(g)', '计量单位'
  ];

  const rows = [headers.map(h => `"${h}"`).join(',')];

  samples.forEach((s, i) => {
    const g = s.geometry;
    const a = s.attributes || {};
    const row = [
      i + 1,
      a.partName || '',
      s.standardNo || a.standardNo || '',
      a.specification || '',
      a.category || '',
      a.materialName || '',
      a.materialGrade || '',
      a.surfaceTreatment || '',
      g.nominalDiameter || '',
      g.length || g.pinLength || g.rivetLength || '',
      '粗牙',
      g.pitch || '',
      a.weight !== undefined ? a.weight.toFixed(1) : '',
      '件'
    ];
    rows.push(row.map(v => `"${v}"`).join(','));
  });

  return rows.join('\n');
}

/** 主流程 */
function main() {
  console.log('📦 标准紧固件库生成工具');
  console.log('='.repeat(50));

  // 1. 加载所有样本
  const samples = loadAllSamples();
  console.log(`✅ 加载了 ${samples.length} 个样本`);

  // 2. 统计类型分布
  const typeCount = {};
  for (const s of samples) {
    typeCount[s.type] = (typeCount[s.type] || 0) + 1;
  }
  console.log('📊 类型分布:');
  for (const [type, count] of Object.entries(typeCount)) {
    console.log(`   ${type}: ${count}个`);
  }

  // 3. 生成 FreeCAD 批量建模脚本
  const pythonScript = generateFreecadBatchScript(samples);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'freecad_batch_model.py'), pythonScript, 'utf-8');
  console.log('✅ FreeCAD 批量建模脚本已生成:', path.join(OUTPUT_DIR, 'freecad_batch_model.py'));

  // 4. 生成属性表 CSV
  const csvContent = generateCSV(samples);
  fs.writeFileSync(path.join(OUTPUT_DIR, 'library_attributes.csv'), '﻿' + csvContent, 'utf-8');
  console.log('✅ 属性表 CSV 已生成:', path.join(OUTPUT_DIR, 'library_attributes.csv'));

  // 5. 验证完整性
  const expectedTypes = ['bolt', 'nut', 'washer', 'rivet', 'pin'];
  const missingTypes = expectedTypes.filter(t => !typeCount[t]);
  if (missingTypes.length > 0) {
    console.log(`⚠️ 缺少以下类型: ${missingTypes.join(', ')}`);
  } else {
    console.log('✅ 覆盖全部 5 类必需紧固件类型');
  }

  console.log('='.repeat(50));
  console.log('📂 输出目录:', OUTPUT_DIR);
  console.log('='.repeat(50));
}

main();
