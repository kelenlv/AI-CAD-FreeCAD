'use client';

import { useState } from 'react';
import { FastenerData } from '@/lib/types';
import { Download, Table, FileJson, FileCode, Boxes, FileText } from 'lucide-react';

interface AttributeTableProps {
  fasteners: FastenerData[];
}

export default function AttributeTable({ fasteners }: AttributeTableProps) {
  const [exporting, setExporting] = useState<'csv' | 'json' | 'python' | 'params' | null>(null);

  const typeLabels: Record<string, string> = {
    bolt: '螺栓', screw: '螺钉', stud: '螺柱',
    nut: '螺母', washer: '垫圈', rivet: '铆钉',
    pin: '销', ring: '挡圈', bushing: '衬套/镶嵌件',
  };

  const handleExport = async (format: 'csv' | 'json') => {
    setExporting(format);
    try {
      const res = await fetch('/api/export-attributes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fasteners, format }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const blob = new Blob([data.data.content], { type: data.data.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.data.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('导出失败:', e);
    } finally {
      setExporting(null);
    }
  };

  const handleFreecadExport = async (format: 'python' | 'params') => {
    setExporting(format);
    try {
      const res = await fetch('/api/export-freecad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fasteners, format }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        const blob = new Blob([data.data.content], { type: data.data.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = data.data.filename;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (e) {
      console.error('FreeCAD导出失败:', e);
    } finally {
      setExporting(null);
    }
  };

  if (fasteners.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-slate-500 text-xs">
        <Table className="w-4 h-4 mr-2" />
        请先解析文档或选择示例紧固件
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* 导出按钮区 */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-medium text-slate-400">属性列表 ({fasteners.length} 项)</h4>
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => handleExport('csv')}
            disabled={!!exporting}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50 transition-colors"
          >
            <Download className="w-3 h-3" />
            CSV
          </button>
          <button
            onClick={() => handleExport('json')}
            disabled={!!exporting}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
          >
            <FileJson className="w-3 h-3" />
            JSON
          </button>
        </div>
      </div>

      {/* FreeCAD 集成导出区 */}
      <details className="bg-sky-500/5 border border-sky-500/20 rounded-lg overflow-hidden">
        <summary className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-sky-500/5 text-xs text-sky-400/80">
          <span className="flex items-center gap-1.5">
            <Boxes className="w-3.5 h-3.5" />
            FreeCAD 自动化建模
          </span>
          <span className="text-[10px] text-slate-500">展开</span>
        </summary>
        <div className="px-3 pb-3 pt-1 text-[11px] space-y-2">
          <p className="text-slate-500 leading-relaxed">
            基于提取的尺寸规格参数，生成 FreeCAD Python 脚本，跨平台（macOS / Windows / Linux）
            自动生成三维实体模型并导出 STEP / STL。
          </p>
          <div className="flex gap-1.5">
            <button
              onClick={() => handleFreecadExport('python')}
              disabled={!!exporting}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-sky-500/10 border border-sky-500/30 text-sky-400 hover:bg-sky-500/20 disabled:opacity-50 transition-colors"
            >
              <FileCode className="w-3 h-3" />
              FreeCAD 脚本
            </button>
            <button
              onClick={() => handleFreecadExport('params')}
              disabled={!!exporting}
              className="flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-500/10 border border-slate-500/30 text-slate-400 hover:bg-slate-500/20 disabled:opacity-50 transition-colors"
            >
              <FileText className="w-3 h-3" />
              参数JSON
            </button>
          </div>
          <div className="text-[10px] text-slate-600 space-y-1 bg-slate-800/30 rounded p-2">
            <p className="font-medium text-slate-500">本地使用方式：</p>
            <p>1. 下载脚本 → 安装 FreeCAD：brew install --cask freecad</p>
            <p>2. 运行：freecadcmd freecad_fastener_model.py</p>
            <p>3. 下载参数JSON → 供 scripts/freecad_modeler.py 读取</p>
          </div>
        </div>
      </details>

      {/* 数据表格 */}
      <div className="overflow-x-auto max-h-60 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="text-left text-slate-500 font-medium py-1.5 px-2 whitespace-nowrap">序号</th>
              <th className="text-left text-slate-500 font-medium py-1.5 px-2 whitespace-nowrap">物资名称</th>
              <th className="text-left text-slate-500 font-medium py-1.5 px-2 whitespace-nowrap">标准号</th>
              <th className="text-left text-slate-500 font-medium py-1.5 px-2 whitespace-nowrap">规格</th>
              <th className="text-left text-slate-500 font-medium py-1.5 px-2 whitespace-nowrap">材料</th>
              <th className="text-left text-slate-500 font-medium py-1.5 px-2 whitespace-nowrap">等级</th>
              <th className="text-left text-slate-500 font-medium py-1.5 px-2 whitespace-nowrap">表面处理</th>
            </tr>
          </thead>
          <tbody>
            {fasteners.map((f, idx) => (
              <tr key={idx} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                <td className="py-1.5 px-2 text-slate-400">{idx + 1}</td>
                <td className="py-1.5 px-2 text-slate-300 font-medium">{f.attributes.partName || typeLabels[f.type]}</td>
                <td className="py-1.5 px-2 text-slate-400">{f.attributes.standardNo || '-'}</td>
                <td className="py-1.5 px-2 text-slate-300">{f.attributes.specification || '-'}</td>
                <td className="py-1.5 px-2 text-slate-400">{f.attributes.materialName || '-'}</td>
                <td className="py-1.5 px-2 text-slate-400">{f.attributes.materialGrade || '-'}</td>
                <td className="py-1.5 px-2 text-slate-400">{f.attributes.surfaceTreatment || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}