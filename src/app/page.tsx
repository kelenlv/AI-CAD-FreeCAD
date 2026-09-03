'use client';

import { useState, useCallback } from 'react';
import { FastenerData, FastenerType, FastenerTypeLabels } from '@/lib/types';
import { getSampleFastener, generateSpecification } from '@/lib/fastener-params';
import ModelViewer from '@/components/dashboard/ModelViewer';
import DocumentInput from '@/components/dashboard/DocumentInput';
import ParameterPanel from '@/components/dashboard/ParameterPanel';
import AttributeTable from '@/components/dashboard/AttributeTable';
import { Cog, Box, FileSpreadsheet, ChevronRight, Loader2 } from 'lucide-react';

export default function Home() {
  const [activeFastener, setActiveFastener] = useState<FastenerData | null>(null);
  const [fastenerList, setFastenerList] = useState<FastenerData[]>([]);
  const [activeTab, setActiveTab] = useState<'model' | 'params' | 'export'>('model');
  const [isParsing, setIsParsing] = useState(false);
  const [selectedModel, setSelectedModel] = useState('doubao-seed-2-0-pro-260215');

  const handleFastenerParsed = useCallback((data: FastenerData[]) => {
    setFastenerList(data);
    setActiveFastener(data[0]);
    setActiveTab('model');
  }, []);

  const handleSelectSample = useCallback((data: FastenerData) => {
    setActiveFastener(data);
    setFastenerList([data]);
    setActiveTab('model');
  }, []);

  const handleParamChange = useCallback((updated: FastenerData) => {
    setActiveFastener(updated);
    setFastenerList(prev => {
      const idx = prev.findIndex(f => 
        f.type === updated.type && 
        f.geometry.nominalDiameter === updated.geometry.nominalDiameter
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = updated;
        return next;
      }
      return [updated, ...prev];
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#0a0e1a] text-slate-300 flex flex-col">
      {/* 顶部导航 */}
      <header className="border-b border-slate-800/60 bg-[#0a0e1a]/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <Cog className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-slate-200">FastenerModel AI</h1>
              <p className="text-[10px] text-slate-500 -mt-0.5">标准紧固件智能建模系统</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="hidden sm:inline">航天赛题 · 基于AI的标准紧固件智能建模</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-emerald-400/70">系统就绪</span>
          </div>
        </div>
      </header>

      {/* 主工作区 */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-full">
          {/* 左侧：文档输入 */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4">
              <h3 className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                文档解析
              </h3>
              <DocumentInput
                onFastenerParsed={handleFastenerParsed}
                onSelectSample={handleSelectSample}
                isParsing={isParsing}
                setIsParsing={setIsParsing}
                selectedModel={selectedModel}
                onModelChange={setSelectedModel}
              />
            </div>

            {isParsing && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                  <span>AI 正在解析文档并提取参数...</span>
                </div>
              </div>
            )}

            {/* 工作流步骤 */}
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4">
              <h3 className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                工作流程
              </h3>
              <div className="space-y-2.5">
                {[
                  { label: '① 文档输入', desc: '粘贴国标文档或选择示例', active: true },
                  { label: '② AI智能解析', desc: '大模型提取几何参数', active: !!activeFastener },
                  { label: '③ 3D模型预览', desc: '参数化三维可视化', active: !!activeFastener },
                  { label: '④ 属性导出', desc: '结构化属性数据输出', active: fastenerList.length > 0 },
                ].map((step, i) => (
                  <div key={i} className={`flex items-start gap-2 ${step.active ? 'opacity-100' : 'opacity-40'}`}>
                    <ChevronRight className={`w-3 h-3 mt-0.5 ${step.active ? 'text-emerald-400' : 'text-slate-600'}`} />
                    <div>
                      <p className={`text-xs ${step.active ? 'text-slate-300' : 'text-slate-600'}`}>{step.label}</p>
                      <p className="text-[10px] text-slate-500">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 中间：3D模型预览 */}
          <div className="lg:col-span-2 flex flex-col">
            <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg flex-1 flex flex-col">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800/50">
                <h3 className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                  <Box className="w-3.5 h-3.5 text-cyan-400" />
                  三维模型预览
                </h3>
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <span>拖拽旋转 · 滚轮缩放</span>
                </div>
              </div>
              <div className="flex-1 min-h-0">
                <ModelViewer fastener={activeFastener} />
              </div>
            </div>
          </div>

          {/* 右侧：参数与属性 */}
          <div className="lg:col-span-1 space-y-4">
            {/* Tab 切换 */}
            <div className="flex rounded-lg border border-slate-800/50 overflow-hidden">
              {[
                { key: 'model' as const, label: '参数', icon: Cog },
                { key: 'export' as const, label: '属性', icon: FileSpreadsheet },
              ].map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs transition-colors ${
                    activeTab === key
                      ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            {/* 参数面板 */}
            {activeTab === 'model' && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4 max-h-[calc(100vh-220px)] overflow-y-auto">
                {activeFastener ? (
                  <ParameterPanel fastener={activeFastener} onChange={handleParamChange} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-40 text-slate-500 text-xs">
                    <Cog className="w-8 h-8 mb-2 opacity-30" />
                    选择紧固件后编辑参数
                  </div>
                )}
                {activeFastener && (
                  <button
                    onClick={() => {
                      setActiveTab('export');
                    }}
                    className="mt-4 w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-md bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border border-blue-500/30 text-blue-400 hover:from-blue-500/20 hover:to-cyan-500/20 transition-colors"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5" />
                    查看属性表单
                  </button>
                )}
              </div>
            )}

            {/* 属性导出面板 */}
            {activeTab === 'export' && (
              <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4">
                <h3 className="text-xs font-medium text-slate-400 mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  属性模板自动填充
                </h3>
                <AttributeTable fasteners={fastenerList} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 底部状态 */}
      <footer className="border-t border-slate-800/60 bg-[#0a0e1a]/80 py-2">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between text-[10px] text-slate-600">
          <span>标准紧固件智能建模系统 v1.0</span>
          <span>基于 MinerU + LLM 的国标文档智能解析</span>
        </div>
      </footer>
    </div>
  );
}