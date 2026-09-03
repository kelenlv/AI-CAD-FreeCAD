import { NextRequest, NextResponse } from 'next/server';
import { Config, LLMClient } from 'coze-coding-dev-sdk';
import { execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';


// Coze 平台模型白名单
const COZE_MODELS = [
  'doubao-seed-2-0-pro-260215',
  'doubao-seed-2-0-lite-260215',
  'doubao-seed-2-0-mini-260215',
  'doubao-seed-1-8-251228',
];

interface FastenerGeometry {
  nominalDiameter?: number;
  pitch?: number;
  length?: number;
  headDiameter?: number;
  headHeight?: number;
  widthAcrossFlats?: number;
  threadLength?: number;
  nutHeight?: number;
  innerDiameter?: number;
  outerDiameter?: number;
  thickness?: number;
  pinLength?: number;
  [key: string]: number | undefined;
}

interface FastenerAttributes {
  partName?: string;
  standardNo?: string;
  specification?: string;
  materialName?: string;
  materialGrade?: string;
  surfaceTreatment?: string;
  category?: string;
  unit?: string;
  [key: string]: string | undefined;
}

interface ParsedFastener {
  type: string;
  geometry: FastenerGeometry;
  attributes: FastenerAttributes;
}

interface ParsePDFResponse {
  success: boolean;
  data?: ParsedFastener[];
  error?: string;
}

// ---------- PDF文本提取（调用pdfminer.six） ----------
function extractPDFText(filePath: string): string {
  const scriptPath = join(process.cwd(), 'scripts', 'pdf_extract.py');

  // 检测可用的 Python 命令（Linux: python3, Windows: py -3 或 python）
  const pythonCmds = ['python3', 'python', 'py -3'];
  let pyCmd = '';

  for (const cmd of pythonCmds) {
    try {
      execSync(`${cmd} --version`, { encoding: 'utf-8', timeout: 3000 });
      pyCmd = cmd;
      break;
    } catch {
      continue;
    }
  }
  if (!pyCmd) throw new Error('未检测到 Python 环境，请安装 Python 3 并执行: pip install pdfminer.six');

  const stdout = execSync(
    `${pyCmd} "${scriptPath}" "${filePath}"`,
    { encoding: 'utf-8', timeout: 60000 } // 大PDF给60秒
  );
  if (!stdout || stdout.trim().length < 10) {
    console.error('[parse-pdf] 提取文本:', stdout?.substring(0, 100));
    throw new Error('PDF中未提取到有效文本（<10字符），请确认该PDF是文字型PDF而非扫描件，或尝试复制文本内容手动粘贴');
  }
  return stdout.trim();
}

/** 调用 Coze SDK 的 LLM 进行解析 */
async function callCozeLLM(documentText: string, modelId: string): Promise<string> {
  const config = new Config();
  const client = new LLMClient(config);

  const systemPrompt = `你是一名航天标准紧固件专家。从给定的国标文档文本中，提取所有紧固件的关键参数。

你必须返回一个 JSON 数组，每个元素包含：
{
  "type": "紧固件类型(bolt/nut/washer/rivet/pin/screw/stud)",
  "geometry": { 几何参数对象 },
  "attributes": { 属性参数对象 }
}

紧固件类型映射：
- bolt: 螺栓、螺钉 — 参数: nominalDiameter, pitch, length, headDiameter, headHeight, widthAcrossFlats, threadLength
- nut: 螺母 — 参数: nominalDiameter, pitch, widthAcrossFlats, nutHeight
- washer: 垫圈 — 参数: nominalDiameter(孔径), outerDiameter, thickness
- rivet: 铆钉 — 参数: nominalDiameter, length, headDiameter, headHeight
- pin: 销 — 参数: nominalDiameter, length (pinLength)
- screw: 螺钉 — 参数: nominalDiameter, length, headDiameter, headHeight
- stud: 螺柱 — 参数: nominalDiameter, length

属性字段：
- partName: 物资名称（如"六角头螺栓"）
- standardNo: 标准号（如"GB/T 5782-2016"）
- specification: 规格
- materialName: 材料牌号（如"45钢"）
- materialGrade: 性能等级（如"8.8"）
- surfaceTreatment: 表面处理（如"镀锌"）
- category: 资源分类（如"紧固件/螺栓"）
- unit: 计量单位（默认"件"）

务必返回严格的 JSON 格式，不要包含 markdown 代码块标记。`;

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `请解析以下国标文档文本，提取紧固件参数：\n\n${documentText}` }
  ];

  const stream = client.stream(messages as any, {
    model: modelId,
    temperature: 0.05,
  });

  let content = '';
  for await (const chunk of stream) {
    if (chunk.content) {
      content += chunk.content;
    }
  }
  return content;
}

/** 调用自建 API（兼容 OpenAI 格式） */
async function callCustomLLM(documentText: string, modelId: string): Promise<string> {
  const apiKey = process.env.CUSTOM_LLM_API_KEY;
  const baseUrl = process.env.CUSTOM_LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  if (!apiKey) {
    throw new Error('未配置 CUSTOM_LLM_API_KEY 环境变量');
  }

  const systemPrompt = `你是一名航天标准紧固件专家。从给定的国标文档文本中，提取所有紧固件的关键参数。

你必须返回一个 JSON 数组，每个元素包含：
{
  "type": "紧固件类型(bolt/nut/washer/rivet/pin/screw/stud)",
  "geometry": { 几何参数对象 },
  "attributes": { 属性参数对象 }
}

紧固件类型映射：
- bolt: 螺栓、螺钉 — 参数: nominalDiameter, pitch, length, headDiameter, headHeight, widthAcrossFlats, threadLength
- nut: 螺母 — 参数: nominalDiameter, pitch, widthAcrossFlats, nutHeight
- washer: 垫圈 — 参数: nominalDiameter(孔径), outerDiameter, thickness
- rivet: 铆钉 — 参数: nominalDiameter, length, headDiameter, headHeight
- pin: 销 — 参数: nominalDiameter, length (pinLength)
- screw: 螺钉 — 参数: nominalDiameter, length, headDiameter, headHeight
- stud: 螺柱 — 参数: nominalDiameter, length

属性字段：
- partName: 物资名称
- standardNo: 标准号
- specification: 规格
- materialName: 材料牌号
- materialGrade: 性能等级
- surfaceTreatment: 表面处理

务必返回严格的 JSON 格式，不要包含 markdown 代码块标记。`;

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `请解析以下国标文档文本，提取紧固件参数：\n\n${documentText}` },
      ],
      temperature: 0.05,
      max_tokens: 4096,
      stream: false,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`自建API请求失败 [${response.status}]: ${errText}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
}

export async function POST(request: NextRequest) {
  try {
    // 1. 解析 multipart form-data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const model = (formData.get('model') as string) || 'doubao-seed-2-0-pro-260215';

    if (!file) {
      return NextResponse.json<ParsePDFResponse>({
        success: false,
        error: '请上传一个PDF文件',
      }, { status: 400 });
    }

    // 2. 检查文件类型
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      return NextResponse.json<ParsePDFResponse>({
        success: false,
        error: '仅支持PDF格式文件',
      }, { status: 400 });
    }

    // 3. 保存到临时目录
    const tmpDir = '/tmp';
    const fileName = `pdf_${Date.now()}_${file.name}`;
    const filePath = join(tmpDir, fileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    writeFileSync(filePath, buffer);

    let pdfText: string;

    try {
      // 4. 先用 pdfminer.six 提取文本（支持中文PDF）
      pdfText = extractPDFText(filePath);
    } catch (e) {
      pdfText = '';
      console.error('PDF文本提取失败:', e);
    } finally {
      // 5. 清理临时文件
      try { unlinkSync(filePath); } catch {}
    }

    if (!pdfText || pdfText.length < 10) {
      return NextResponse.json<ParsePDFResponse>({
        success: false,
        error: '无法从PDF中提取有效文本，请确认文件内容是否可复制',
      }, { status: 400 });
    }

    console.log(`[parse-pdf] 提取文本长度=${pdfText.length}字, model=${model}`);

    // 6. 截断过长文本（防止token超限）
    const truncatedText = pdfText.length > 8000
      ? pdfText.slice(0, 8000) + '\n\n[...内容已截断，取前8000字]'
      : pdfText;

    // 7. 调用 LLM 解析
    const isCozeModel = COZE_MODELS.includes(model);
    let rawContent: string;

    if (isCozeModel) {
      rawContent = await callCozeLLM(truncatedText, model);
    } else {
      rawContent = await callCustomLLM(truncatedText, model);
    }

    // 清理返回的 JSON
    let cleanJson = rawContent.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    }

    // 8. 解析 JSON
    let parsedData: ParsedFastener[];
    try {
      parsedData = JSON.parse(cleanJson);

      // 统一转为数组
      if (!Array.isArray(parsedData)) {
        parsedData = [parsedData];
      }

      // 验证每个条目
      parsedData = parsedData.filter(item => item && item.type);
    } catch {
      // 如果直接解析失败，尝试从文本中提取 JSON
      const jsonMatch = cleanJson.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        parsedData = JSON.parse(jsonMatch[0]);
        if (!Array.isArray(parsedData)) {
          parsedData = [parsedData];
        }
        parsedData = parsedData.filter((item: any) => item && item.type);
      } else {
        throw new Error('LLM返回内容不是有效的JSON格式');
      }
    }

    console.log(`[parse-pdf] 解析结果: ${parsedData.length}个紧固件`);

    return NextResponse.json<ParsePDFResponse>({
      success: true,
      data: parsedData,
    });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : '未知错误';
    console.error('[parse-pdf] 失败:', errMsg);
    return NextResponse.json<ParsePDFResponse>({
      success: false,
      error: `PDF解析失败: ${errMsg}`,
    }, { status: 500 });
  }
}