/**
 * 标准紧固件参数生成器
 * 根据不同紧固件类型生成默认几何参数和3D几何数据
 */

import { FastenerData, FastenerType, FastenerGeometryParams, FastenerAttributes } from './types';

/**
 * 生成标准紧固件的默认属性模板
 */
export function getDefaultAttributes(type: FastenerType): Partial<FastenerAttributes> {
  const base = {
    surfaceTreatment: '镀锌',
    unit: '件',
  };

  switch (type) {
    case FastenerType.BOLT:
      return { ...base, partName: '六角头螺栓', category: '紧固件/螺栓', materialGrade: '8.8' };
    case FastenerType.SCREW:
      return { ...base, partName: '内六角圆柱头螺钉', category: '紧固件/螺钉', materialGrade: '8.8' };
    case FastenerType.STUD:
      return { ...base, partName: '双头螺柱', category: '紧固件/螺柱', materialGrade: '8.8' };
    case FastenerType.NUT:
      return { ...base, partName: '六角螺母', category: '紧固件/螺母', materialGrade: '8' };
    case FastenerType.WASHER:
      return { ...base, partName: '平垫圈', category: '紧固件/垫圈', materialGrade: '200HV' };
    case FastenerType.RIVET:
      return { ...base, partName: '半圆头铆钉', category: '紧固件/铆钉', materialGrade: 'ML2' };
    case FastenerType.PIN:
      return { ...base, partName: '圆柱销', category: '紧固件/销', materialGrade: '45钢' };
    case FastenerType.RING:
      return { ...base, partName: '弹性挡圈', category: '紧固件/挡圈', materialGrade: '65Mn' };
    case FastenerType.BUSHING:
      return { ...base, partName: '螺纹衬套', category: '紧固件/衬套', materialGrade: '1Cr18Ni9Ti' };
    default:
      return { ...base, partName: '标准件', category: '紧固件' };
  }
}

/**
 * 根据标准号和螺纹规格生成规格描述
 */
export function generateSpecification(
  standardNo: string,
  type: FastenerType,
  nominalDiameter: number,
  length?: number
): string {
  const typeLabel: Record<FastenerType, string> = {
    [FastenerType.BOLT]: '螺栓',
    [FastenerType.SCREW]: '螺钉',
    [FastenerType.STUD]: '螺柱',
    [FastenerType.NUT]: '螺母',
    [FastenerType.WASHER]: '垫圈',
    [FastenerType.RIVET]: '铆钉',
    [FastenerType.PIN]: '销',
    [FastenerType.RING]: '挡圈',
    [FastenerType.BUSHING]: '衬套',
  };

  const base = `${standardNo} ${typeLabel[type]} M${nominalDiameter}`;
  return length ? `${base}×${length}` : base;
}

/**
 * 生成用于Three.js渲染的3D几何参数
 * 每个紧固件类型返回构造几何体所需的参数
 */
export function getModelGeometryParams(
  type: FastenerType,
  geometry: FastenerGeometryParams
): Record<string, number> {
  const d = geometry.nominalDiameter;

  switch (type) {
    case FastenerType.BOLT: {
      // 六角头螺栓 (GB/T 5782)
      const s = geometry.widthAcrossFlats || d * 1.5 + 2;  // 对边
      const k = geometry.headHeight || 0.7 * d;            // 头部高度
      const L = geometry.length || 6 * d;                  // 长度
      const dk = geometry.headDiameter || 1.5 * d + 2;     // 头部直径
      const b = geometry.threadLength || 2 * d + 6;        // 螺纹长度
      return { d, s, k, L, dk, b };
    }

    case FastenerType.NUT: {
      // 六角螺母 (GB/T 6170)
      const m = geometry.nutHeight || 0.8 * d;             // 螺母高度
      const s = geometry.nutWidth || d * 1.5 + 1;          // 对边
      const e = s * 1.08;                                   // 对角
      return { d, m, s, e };
    }

    case FastenerType.WASHER: {
      // 平垫圈 (GB/T 97.1)
      const d1 = geometry.innerDiameter || d + 0.5;        // 内径
      const d2 = geometry.outerDiameter || 2.2 * d + 2;    // 外径
      const h = geometry.washerThickness || 0.15 * d + 0.2; // 厚度
      return { d1, d2, h };
    }

    case FastenerType.SCREW: {
      // 内六角圆柱头螺钉 (GB/T 70.1)
      const dk = geometry.headDiameter || 1.4 * d + 1;     // 头部直径
      const k = geometry.headHeight || 0.7 * d;            // 头部高度
      const L = geometry.length || 4 * d;                  // 长度
      const b = geometry.threadLength || 2 * d;            // 螺纹长度
      const s = geometry.widthAcrossFlats || 0.7 * d + 0.2; // 内六角对边
      return { d, dk, k, L, b, s };
    }

    case FastenerType.STUD: {
      // 双头螺柱 (GB/T 897)
      const L = geometry.length || 6 * d;                  // 长度
      const b = geometry.threadLength || 2 * d + 6;        // 螺纹长度
      return { d, L, b };
    }

    case FastenerType.PIN: {
      // 圆柱销 (GB/T 119.1)
      const pinD = geometry.pinDiameter || d;
      const pinL = geometry.pinLength || 6 * d;
      return { d: pinD, L: pinL };
    }

    case FastenerType.RIVET: {
      // 半圆头铆钉 (GB/T 867)
      const dk = geometry.rivetHeadDiameter || 1.8 * d;    // 钉头直径
      const k = geometry.rivetHeadHeight || 0.6 * d;       // 钉头高度
      const L = geometry.rivetLength || 5 * d;             // 钉杆长度
      return { d, dk, k, L };
    }

    case FastenerType.RING:
      return { d, D: geometry.outerDiameter || 2.5 * d, h: geometry.washerThickness || 0.1 * d };

    case FastenerType.BUSHING:
      return { d, D: geometry.outerDiameter || 1.5 * d, L: geometry.length || 2 * d };

    default:
      return { d };
  }
}

/**
 * 获取紧固件的标准号建议
 */
export function getStandardNo(type: FastenerType): string {
  const standards: Record<FastenerType, string> = {
    [FastenerType.BOLT]: 'GB/T 5782-2016',
    [FastenerType.SCREW]: 'GB/T 70.1-2008',
    [FastenerType.STUD]: 'GB/T 897-1988',
    [FastenerType.NUT]: 'GB/T 6170-2015',
    [FastenerType.WASHER]: 'GB/T 97.1-2002',
    [FastenerType.RIVET]: 'GB/T 867-1986',
    [FastenerType.PIN]: 'GB/T 119.1-2000',
    [FastenerType.RING]: 'GB/T 893.1-1986',
    [FastenerType.BUSHING]: 'HB 5513-1996',
  };
  return standards[type];
}

/**
 * 预置示例数据，用于展示系统能力
 */
export function getSampleFastener(type: FastenerType): FastenerData {
  const defaults: Record<FastenerType, Partial<FastenerGeometryParams>> = {
    [FastenerType.BOLT]: { nominalDiameter: 10, length: 40, headHeight: 7, headDiameter: 18, widthAcrossFlats: 16, threadLength: 26, pitch: 1.5 },
    [FastenerType.SCREW]: { nominalDiameter: 8, length: 25, headHeight: 5, headDiameter: 13, threadLength: 16, pitch: 1.25 },
    [FastenerType.STUD]: { nominalDiameter: 12, length: 60, threadLength: 30, pitch: 1.75 },
    [FastenerType.NUT]: { nominalDiameter: 10, nutHeight: 8.4, nutWidth: 16, pitch: 1.5 },
    [FastenerType.WASHER]: { nominalDiameter: 10, innerDiameter: 10.5, outerDiameter: 24, washerThickness: 2.0 },
    [FastenerType.RIVET]: { nominalDiameter: 6, rivetHeadDiameter: 10.8, rivetHeadHeight: 3.6, rivetLength: 20 },
    [FastenerType.PIN]: { pinDiameter: 8, pinLength: 40 },
    [FastenerType.RING]: { nominalDiameter: 20, outerDiameter: 50, washerThickness: 2.5 },
    [FastenerType.BUSHING]: { nominalDiameter: 12, length: 24, outerDiameter: 18, pitch: 1.5 },
  };

  const attrs: Record<FastenerType, Partial<FastenerAttributes>> = {
    [FastenerType.BOLT]: { materialName: '45钢', standardNo: 'GB/T 5782-2016', materialGrade: '8.8' },
    [FastenerType.SCREW]: { materialName: '42CrMo', standardNo: 'GB/T 70.1-2008', materialGrade: '10.9' },
    [FastenerType.STUD]: { materialName: '35钢', standardNo: 'GB/T 897-1988', materialGrade: '8.8' },
    [FastenerType.NUT]: { materialName: '45钢', standardNo: 'GB/T 6170-2015', materialGrade: '8' },
    [FastenerType.WASHER]: { materialName: '65Mn', standardNo: 'GB/T 97.1-2002', materialGrade: '200HV' },
    [FastenerType.RIVET]: { materialName: 'ML2', standardNo: 'GB/T 867-1986' },
    [FastenerType.PIN]: { materialName: '45钢', standardNo: 'GB/T 119.1-2000' },
    [FastenerType.RING]: { materialName: '65Mn', standardNo: 'GB/T 893.1-1986' },
    [FastenerType.BUSHING]: { materialName: '1Cr18Ni9Ti', standardNo: 'HB 5513-1996' },
  };

  const defaultAttrs = getDefaultAttributes(type);
  const typeAttrs = attrs[type];
  const param = defaults[type];

  return {
    type,
    geometry: param as FastenerGeometryParams,
    attributes: {
      ...defaultAttrs,
      ...typeAttrs,
      partName: defaultAttrs.partName || '',
      category: defaultAttrs.category || '',
      specification: generateSpecification(
        typeAttrs?.standardNo || getStandardNo(type),
        type,
        param.nominalDiameter || 0,
        param.length || param.pinLength || param.rivetLength
      ),
    } as FastenerAttributes,
  };
}