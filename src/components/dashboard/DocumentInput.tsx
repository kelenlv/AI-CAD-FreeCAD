'use client';

import { useState, useRef, useEffect } from 'react';
import { FastenerType, FastenerTypeLabels } from '@/lib/types';
import { getSampleFastener } from '@/lib/fastener-params';
import { Loader2, FileText, Beaker, Upload, FileUp, Brain, ChevronDown } from 'lucide-react';

interface DocumentInputProps {
  onFastenerParsed: (fasteners: any[]) => void;
  onSelectSample: (fastener: any) => void;
  isParsing: boolean;
  setIsParsing: (v: boolean) => void;
  selectedModel: string;
  onModelChange: (model: string) => void;
}

export default function DocumentInput({ onFastenerParsed, onSelectSample, isParsing, setIsParsing, selectedModel, onModelChange }: DocumentInputProps) {
  const [docText, setDocText] = useState('');
  const [selectedType, setSelectedType] = useState<FastenerType>(FastenerType.BOLT);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const modelPickerRef = useRef<HTMLDivElement>(null);
  const [activeInputMode, setActiveInputMode] = useState<'paste' | 'upload'>('paste');
  const [showModelPicker, setShowModelPicker] = useState(false);

  // 点击外部关闭模型选择器
  useEffect(() => {
    if (!showModelPicker) return;
    const handleClick = (e: MouseEvent) => {
      if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) {
        setShowModelPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showModelPicker]);

  // 模型分组：row 1 = Coze 平台托管, row 2 = 自建 API
  const COZE_MODELS = [
    { id: 'doubao-seed-2-0-pro-260215', label: '豆包 Seed 2.0 Pro', provider: '豆包' },
  ];

  const CUSTOM_API_MODELS = [
    { id: 'qwen-3-5-plus-260215',  label: '千问 Qwen 3.5 Plus',   provider: '阿里' },
    { id: 'deepseek-v3-2-251201',  label: 'DeepSeek V3',          provider: 'DeepSeek' },
    { id: 'kimi-k2-5-260127',      label: 'Kimi K2.5',            provider: '月之暗面' },
    { id: 'glm-5-0-260211',        label: 'GLM-5',                provider: '智谱' },
    { id: 'minimax-m2-5-260212',   label: 'MiniMax M2.5',         provider: 'MiniMax' },
    // ── 在此添加你的新模型（会自动走自建 API） ──
    // { id: 'qwen-3-6',           label: '千问 Qwen 3.6',        provider: '阿里' },
    // { id: 'your-model-id',      label: '显示名称',              provider: '厂商' },
    { id: 'qwen3.6-flash',           label: '千问 Qwen 3.6',        provider: '阿里' },
  ];

  // 合并两个列表，用于选择器等
  const ALL_MODELS = [...COZE_MODELS, ...CUSTOM_API_MODELS];

  const handleParse = async () => {
    if (!docText.trim()) {
      setError('请输入或粘贴国标文档内容');
      return;
    }
    setError('');
    setIsParsing(true);

    try {
      const res = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentText: docText, model: selectedModel }),
      });
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        onFastenerParsed(data.data);
        setFileName('');
      } else {
        setError(data.error || '解析失败，请检查文档内容');
      }
    } catch (e) {
      setError('网络请求失败，请重试');
    } finally {
      setIsParsing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileName_lower = file.name.toLowerCase();
    setFileName(file.name);
    setError('');
    setIsParsing(true);

    try {
      // PDF 文件走专门的 PDF 解析 API（FormData 上传）
      if (fileName_lower.endsWith('.pdf') || fileName_lower.endsWith('.doc') || fileName_lower.endsWith('.docx')) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('model', selectedModel);

        const res = await fetch('/api/parse-pdf', {
          method: 'POST',
          body: formData,
        });
        const data = await res.json();
        if (data.success && data.data?.length > 0) {
          onFastenerParsed(data.data);
          setFileName('');
        } else {
          setError(data.error || 'PDF解析失败，请检查文件内容');
        }
        return;
      }

      // TXT 文件走原有文本解析流程
      const text = await file.text();
      if (!text.trim()) {
        setError('文件内容为空，请检查文件');
        return;
      }
      setDocText(text);

      const res = await fetch('/api/parse-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentText: text, model: selectedModel }),
      });
      const data = await res.json();
      if (data.success && data.data?.length > 0) {
        onFastenerParsed(data.data);
      } else {
        setError(data.error || '解析失败，请检查文档内容');
      }
    } catch (e) {
      setError('文件读取失败，请确认文件格式正确');
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSampleSelect = () => {
    const sample = getSampleFastener(selectedType);
    onSelectSample(sample);
    // 填充示例文本到输入框
    const parts: string[] = [
      `${sample.attributes.standardNo || 'GB/T'} ${sample.attributes.partName}`,
      `螺纹规格 M${sample.geometry.nominalDiameter}`,
    ];
    if (sample.geometry.pitch) parts[1] += `×${sample.geometry.pitch}`;
    if (sample.geometry.length) parts.push(`公称长度 ${sample.geometry.length}mm`);
    if (sample.geometry.headHeight) parts.push(`头部高度 ${sample.geometry.headHeight}mm`);
    if (sample.geometry.headDiameter) parts.push(`头部直径 ${sample.geometry.headDiameter}mm`);
    if (sample.geometry.widthAcrossFlats) parts.push(`对边宽度 ${sample.geometry.widthAcrossFlats}mm`);
    if (sample.geometry.threadLength) parts.push(`螺纹长度 ${sample.geometry.threadLength}mm`);
    if (sample.attributes.materialName) parts.push(`材料 ${sample.attributes.materialName}`);
    if (sample.attributes.materialGrade) parts.push(`性能等级 ${sample.attributes.materialGrade}`);
    setDocText(parts.join('\n'));
    setFileName('');
  };

  return (
    <div className="space-y-3">
      {/* AI模型选择 */}
      <div className="relative">
        <label className="text-xs text-slate-400 mb-1.5 block">AI解析模型</label>
        <button
          onClick={() => setShowModelPicker(!showModelPicker)}
          className="w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 text-xs rounded-md border border-slate-700/50 bg-slate-800/50 text-slate-300 hover:border-slate-600 transition-colors"
        >
          <span className="flex items-center gap-1.5">
            <Brain className="w-3 h-3 text-cyan-400" />
            {ALL_MODELS.find(m => m.id === selectedModel)?.label || selectedModel}
            {(() => {
              const isCoze = COZE_MODELS.some(m => m.id === selectedModel);
              return <span className={`text-[10px] px-1 rounded ${isCoze ? 'text-yellow-400' : 'text-green-400'}`}>{isCoze ? 'Coze' : '自建API'}</span>;
            })()}
          </span>
          <ChevronDown className={`w-3 h-3 transition-transform ${showModelPicker ? 'rotate-180' : ''}`} />
        </button>
        {showModelPicker && (() => {
              const CozeIcon = () => <span className="text-[10px] text-yellow-500/70 ml-1">Coze</span>;
              const SelfIcon = () => <span className="text-[10px] text-green-500/70 ml-1">自建API</span>;
              return (
                <div ref={modelPickerRef} className="absolute z-10 top-full left-0 right-0 mt-1 bg-slate-800 border border-slate-700 rounded-md shadow-xl overflow-hidden max-h-64 overflow-y-auto">
                  {/* ── Coze 平台组 ── */}
                  <div className="px-3 pt-2 pb-1 text-[10px] text-slate-500 font-medium tracking-wide border-b border-slate-700/50">
                    ⚡ Coze 平台托管
                  </div>
                  {COZE_MODELS.map((m) => (
                    <button key={m.id} onClick={() => { onModelChange(m.id); setShowModelPicker(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-700/50 transition-colors ${selectedModel === m.id ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300'}`}
                    >
                      <span>{m.label} <CozeIcon /></span>
                      <span className="text-slate-500">{m.provider}</span>
                    </button>
                  ))}
                  {/* ── 自建 API 组 ── */}
                  <div className="px-3 pt-2 pb-1 text-[10px] text-slate-500 font-medium tracking-wide border-t border-slate-700/50 mt-1">
                    🔗 自建 API（需配置 CUSTOM_LLM_API_KEY）
                  </div>
                  {CUSTOM_API_MODELS.map((m) => (
                    <button key={m.id} onClick={() => { onModelChange(m.id); setShowModelPicker(false); }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-700/50 transition-colors ${selectedModel === m.id ? 'bg-blue-500/10 text-blue-400' : 'text-slate-300'}`}
                    >
                      <span>{m.label} <SelfIcon /></span>
                      <span className="text-slate-500">{m.provider}</span>
                    </button>
                  ))}
                  {/* ── 底部提示 ── */}
                  <div className="px-3 py-1.5 text-[10px] text-slate-600 border-t border-slate-700/50 text-center">
                    新模型在前端加一行，后端自动路由
                  </div>
                </div>
              );
            })()}
      </div>

      {/* 预置示例选择 */}
      <div>
        <label className="text-xs text-slate-400 mb-1.5 block">快速选择示例紧固件</label>
        <div className="flex gap-1.5 flex-wrap">
          {Object.entries(FastenerTypeLabels).slice(0, 7).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSelectedType(key as FastenerType)}
              className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                selectedType === key
                  ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                  : 'border-slate-700/50 text-slate-400 hover:border-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          onClick={handleSampleSelect}
          className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          <Beaker className="w-3.5 h-3.5" />
          加载示例 {FastenerTypeLabels[selectedType]}
        </button>
      </div>

      <div className="border-t border-slate-700/30 pt-3">
        {/* 输入模式切换 */}
        <div className="flex mb-2 rounded border border-slate-700/50 overflow-hidden text-xs">
          <button
            onClick={() => setActiveInputMode('paste')}
            className={`flex-1 py-1.5 flex items-center justify-center gap-1 transition-colors ${
              activeInputMode === 'paste'
                ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <FileText className="w-3 h-3" />
            粘贴文本
          </button>
          <button
            onClick={() => setActiveInputMode('upload')}
            className={`flex-1 py-1.5 flex items-center justify-center gap-1 transition-colors ${
              activeInputMode === 'upload'
                ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            <FileUp className="w-3 h-3" />
            上传文件
          </button>
        </div>

        {activeInputMode === 'paste' ? (
          <>
            <label className="text-xs text-slate-400 mb-1.5 block">粘贴国标文档文本进行智能解析</label>
            <textarea
              value={docText}
              onChange={(e) => { setDocText(e.target.value); setError(''); }}
              placeholder={`例如：\nGB/T 5782-2016 六角头螺栓\n螺纹规格 M10×1.5，公称长度 40mm\n螺纹长度 26mm，头部高度 7mm\n对边宽度 16mm，材料 45钢\n性能等级 8.8，表面处理 镀锌`}
              className="w-full h-24 bg-slate-800/50 border border-slate-700/50 rounded-md p-2.5 text-xs text-slate-300 placeholder-slate-600 resize-none focus:outline-none focus:border-blue-500/50 transition-colors"
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            <button
              onClick={handleParse}
              disabled={isParsing}
              className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20 disabled:opacity-50 transition-colors"
            >
              {isParsing ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> AI解析中...</>
              ) : (
                <><FileText className="w-3.5 h-3.5" /> AI智能解析文档</>
              )}
            </button>
          </>
        ) : (
          <>
            <label className="text-xs text-slate-400 mb-1.5 block">上传国标文档（支持 .txt / .pdf）</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className="w-full h-24 border-2 border-dashed border-slate-700/50 rounded-md flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-blue-500/30 hover:bg-blue-500/5 transition-colors"
            >
              <Upload className="w-5 h-5 text-slate-500" />
              <span className="text-xs text-slate-500">
                {fileName || '点击选择文件或拖拽到此处'}
              </span>
              {fileName && <span className="text-[10px] text-emerald-400/70">{fileName}</span>}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.pdf,.docx,.doc"
              onChange={handleFileUpload}
              className="hidden"
            />
            {error && <p className="text-red-400 text-xs mt-1">{error}</p>}
            {isParsing && (
              <div className="mt-2 flex items-center gap-1.5 text-xs text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                正在读取并解析文档...
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}