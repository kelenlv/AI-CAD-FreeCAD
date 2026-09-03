'use client';

import { FastenerData, FastenerType, FastenerTypeLabels, FastenerGeometryParams } from '@/lib/types';

interface ParameterPanelProps {
  fastener: FastenerData;
  onChange: (fastener: FastenerData) => void;
}

export default function ParameterPanel({ fastener, onChange }: ParameterPanelProps) {
  const updateGeometry = (key: keyof FastenerGeometryParams, value: number) => {
    onChange({
      ...fastener,
      geometry: { ...fastener.geometry, [key]: value },
    });
  };

  const updateAttribute = (key: string, value: string) => {
    onChange({
      ...fastener,
      attributes: { ...fastener.attributes, [key]: value },
    });
  };

  // 根据紧固件类型显示对应的参数
  const geometryFields: { key: keyof FastenerGeometryParams; label: string; step?: number }[] = [
    { key: 'nominalDiameter', label: '公称直径 (mm)', step: 0.5 },
  ];

  // 按类型添加额外参数
  switch (fastener.type) {
    case FastenerType.BOLT:
      geometryFields.push(
        { key: 'length', label: '长度 L (mm)' },
        { key: 'headDiameter', label: '头部直径 dk (mm)', step: 0.5 },
        { key: 'headHeight', label: '头部高度 k (mm)', step: 0.1 },
        { key: 'widthAcrossFlats', label: '对边宽度 s (mm)', step: 0.5 },
        { key: 'threadLength', label: '螺纹长度 b (mm)' },
        { key: 'pitch', label: '螺距 P (mm)', step: 0.05 },
      );
      break;
    case FastenerType.NUT:
      geometryFields.push(
        { key: 'nutHeight', label: '螺母高度 m (mm)', step: 0.1 },
        { key: 'nutWidth', label: '对边宽度 s (mm)', step: 0.5 },
        { key: 'pitch', label: '螺距 P (mm)', step: 0.05 },
      );
      break;
    case FastenerType.WASHER:
      geometryFields.push(
        { key: 'innerDiameter', label: '内径 d1 (mm)', step: 0.5 },
        { key: 'outerDiameter', label: '外径 d2 (mm)', step: 0.5 },
        { key: 'washerThickness', label: '厚度 h (mm)', step: 0.1 },
      );
      break;
    case FastenerType.SCREW:
      geometryFields.push(
        { key: 'length', label: '长度 L (mm)' },
        { key: 'headDiameter', label: '头部直径 dk (mm)', step: 0.5 },
        { key: 'headHeight', label: '头部高度 k (mm)', step: 0.1 },
        { key: 'pitch', label: '螺距 P (mm)', step: 0.05 },
      );
      break;
    case FastenerType.RIVET:
      geometryFields.push(
        { key: 'rivetHeadDiameter', label: '钉头直径 dk (mm)', step: 0.5 },
        { key: 'rivetHeadHeight', label: '钉头高度 k (mm)', step: 0.1 },
        { key: 'rivetLength', label: '钉杆长度 L (mm)' },
      );
      break;
    case FastenerType.PIN:
      geometryFields.push(
        { key: 'pinDiameter', label: '销直径 d (mm)', step: 0.5 },
        { key: 'pinLength', label: '销长度 l (mm)' },
      );
      break;
    case FastenerType.STUD:
      geometryFields.push(
        { key: 'length', label: '长度 L (mm)' },
        { key: 'threadLength', label: '螺纹长度 b (mm)' },
        { key: 'pitch', label: '螺距 P (mm)', step: 0.05 },
      );
      break;
  }

  return (
    <div className="space-y-4">
      {/* 基本信息 */}
      <div>
        <h4 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">基本信息</h4>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-slate-500">类型</span>
            <span className="text-slate-300 font-medium">{FastenerTypeLabels[fastener.type]}</span>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">物资名称</label>
            <input
              value={fastener.attributes.partName || ''}
              onChange={(e) => updateAttribute('partName', e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">标准号</label>
            <input
              value={fastener.attributes.standardNo || ''}
              onChange={(e) => updateAttribute('standardNo', e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-slate-500">规格</label>
            <input
              value={fastener.attributes.specification || ''}
              onChange={(e) => updateAttribute('specification', e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>
      </div>

      {/* 几何参数 */}
      <div>
        <h4 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">几何参数</h4>
        <div className="space-y-2">
          {geometryFields.map(({ key, label, step }) => (
            <div key={key} className="space-y-0.5">
              <label className="text-xs text-slate-500">{label}</label>
              <input
                type="number"
                step={step || 1}
                value={fastener.geometry[key] || ''}
                onChange={(e) => updateGeometry(key, parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 font-mono focus:outline-none focus:border-cyan-500/50"
              />
            </div>
          ))}
        </div>
      </div>

      {/* 材料属性 */}
      <div>
        <h4 className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider">材料属性</h4>
        <div className="space-y-2">
          <div className="space-y-0.5">
            <label className="text-xs text-slate-500">材料牌号</label>
            <input
              value={fastener.attributes.materialName || ''}
              onChange={(e) => updateAttribute('materialName', e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-xs text-slate-500">性能等级</label>
            <input
              value={fastener.attributes.materialGrade || ''}
              onChange={(e) => updateAttribute('materialGrade', e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
            />
          </div>
          <div className="space-y-0.5">
            <label className="text-xs text-slate-500">表面处理</label>
            <input
              value={fastener.attributes.surfaceTreatment || ''}
              onChange={(e) => updateAttribute('surfaceTreatment', e.target.value)}
              className="w-full bg-slate-800/50 border border-slate-700/50 rounded px-2 py-1 text-xs text-slate-300 focus:outline-none focus:border-blue-500/50"
            />
          </div>
        </div>
      </div>
    </div>
  );
}