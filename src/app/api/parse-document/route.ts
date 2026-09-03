import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { FastenerType, ParseDocumentResponse, FastenerData } from '@/lib/types';
import { getDefaultAttributes, generateSpecification } from '@/lib/fastener-params';

// ==============================================================
// 模型路由配置
// ==============================================================
// Coze 平台托管的模型（走 coze-coding-dev-sdk）
const COZE_MODELS = [
  'doubao-seed-2-0-pro-260215',
  'doubao-seed-2-0-lite-260215',
  'doubao-seed-2-0-mini-260215',
  'doubao-seed-1-8-251228',
];

// 自建 API 的模型（直接 fetch OpenAI 兼容接口）
// 只要 COZE_MODELS 列表里没有的模型，默认走自建 API
// 你可以在前端任意添加新模型名，后端会自动路由

const SYSTEM_PROMPT = `你是一位航天标准紧固件专家，精通GB/T、HB、GJB等国军标标准。
你的任务是从标准文档文本中提取所有标准紧固件（螺栓、螺钉、螺柱、螺母、垫圈、铆钉、销、挡圈、衬套等）的关键参数。

【重点注意】标准文档中的尺寸参数通常以表格形式列出（如"螺纹规格×螺距"表、"尺寸表"等），
你必须仔细解析表格中的所有行数据，每一行代表一个规格的标准件，需要全部提取出来，不能遗漏。

对于每个紧固件，你需要提取以下信息并以JSON格式输出：

=== 几何参数（根据类型选择性提取）===
- nominalDiameter: 公称直径/螺纹规格 (mm)，如M10则为10
- pitch: 螺距 (mm)，螺纹类紧固件必填
- length: 公称长度 (mm)，螺栓/螺钉/螺柱/铆钉/销
- headDiameter: 头部直径 dk (mm)，螺栓/螺钉/铆钉
- headHeight: 头部高度 k (mm)，螺栓/螺钉/铆钉
- threadLength: 螺纹长度 b (mm)，螺栓/螺钉/螺柱
- widthAcrossFlats: 对边宽度 s (mm)，螺栓/螺母
- nutHeight: 螺母高度 m (mm)，螺母
- nutWidth: 对边宽度 (mm)，螺母
- innerDiameter: 内径 d1 (mm)，垫圈
- outerDiameter: 外径 d2 (mm)，垫圈
- washerThickness: 厚度 h (mm)，垫圈
- pinDiameter: 销直径 (mm)，销
- pinLength: 销长度 (mm)，销
- rivetHeadDiameter: 钉头直径 dk (mm)，铆钉
- rivetHeadHeight: 钉头高度 k (mm)，铆钉
- rivetLength: 钉杆长度 (mm)，铆钉

=== 非几何属性 ===
- standardNo: 标准号 (如 GB/T 5782-2016, GB/T 6170-2015)
- materialName: 材料/牌号 (如 45钢、30CrMnSiA、1Cr18Ni9Ti)
- materialGrade: 性能等级 (如 8.8、10.9、A2-70)
- surfaceTreatment: 表面处理 (如 镀锌、氧化、达克罗)
- threadType: 螺纹类型 ("粗牙" 或 "细牙")
- weight: 理论重量 (g，如有)

=== type字段取值（紧固件类型识别规则）===
- 六角头螺栓、全螺纹螺栓 → "bolt"
- 螺钉、内六角螺钉 → "screw"  
- 双头螺柱、螺柱 → "stud"
- 六角螺母、盖形螺母 → "nut"
- 平垫圈、弹簧垫圈 → "washer"
- 半圆头铆钉、沉头铆钉 → "rivet"
- 圆柱销、圆锥销 → "pin"
- 弹性挡圈、孔用挡圈 → "ring"
- 螺纹衬套、镶嵌件 → "bushing"

=== 特别要求 ===
1. 如果文档中有"尺寸表"或参数表格，请逐行提取每一行的规格数据，每一行独立的规格生成一个对象
2. 表格的列标题可能用中文（如"螺纹规格d"、"公称长度l"等），注意识别并匹配到对应字段
3. 对于"螺纹规格d"列，提取数值部分（如M10提取10）
4. 如果规格标注为"M10×1.5"格式，提取公称直径=10，螺距=1.5
5. 对于公称长度范围（如"25-50"），取中间值

请严格按照以下JSON格式输出数组（不要包含markdown代码块包裹）：
[
  {
    "type": "bolt",
    "geometry": { ... 几何参数字段 ... },
    "attributes": { standardNo, materialName, materialGrade, surfaceTreatment, threadType }
  }
]

如果文本中无法提取到任何紧固件信息，返回空数组 []。`;

// ==============================================================
// 自建 API — 调用 OpenAI 兼容接口（千问/DeepSeek/OpenAI 等）
// ==============================================================
async function callCustomLLM(documentText: string, modelId: string): Promise<string> {
  const apiKey = process.env.CUSTOM_LLM_API_KEY;
  const baseUrl = process.env.CUSTOM_LLM_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1';

  if (!apiKey) {
    throw new Error('自建 API 未配置: 请在 .env.local 中设置 CUSTOM_LLM_API_KEY');
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelId,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `请解析以下标准紧固件文档，提取所有标准件参数：\n\n${documentText}` },
      ],
      temperature: 0.1,
      stream: false,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => '');
    throw new Error(`自建 API 返回 ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('自建 API 返回内容为空');
  }

  return content;
}

// ==============================================================
// Coze 平台 — 调用 SDK 流式接口
// ==============================================================
async function callCozeLLM(documentText: string, modelId: string, request: NextRequest): Promise<string> {
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
  const config = new Config({ timeout: 120000 });
  const client = new LLMClient(config, customHeaders);

  const messages = [
    { role: 'system' as const, content: SYSTEM_PROMPT },
    { role: 'user' as const, content: `请解析以下标准紧固件文档，提取所有标准件参数：\n\n${documentText}` },
  ];

  const stream = client.stream(messages, {
    model: modelId,
    temperature: 0.1,
  });

  let fullContent = '';
  for await (const chunk of stream) {
    if (chunk.content) {
      fullContent += chunk.content.toString();
    }
  }

  if (!fullContent.trim()) {
    throw new Error('LLM返回内容为空');
  }

  return fullContent;
}

// ==============================================================
// 解析 LLM 返回的 JSON → FastenerData[]
// ==============================================================
function parseFasteners(rawContent: string): FastenerData[] {
  const jsonStr = rawContent.replace(/```(?:json)?\n?|\n?```/g, '').trim();

  let fasteners: FastenerData[] = [];
  const parsed = JSON.parse(jsonStr);
  fasteners = Array.isArray(parsed) ? parsed : [parsed];

  // 补充默认属性
  fasteners = fasteners.map(f => {
    const defaults = getDefaultAttributes(f.type as FastenerType);
    return {
      ...f,
      attributes: {
        ...defaults,
        ...(f.attributes || {}),
        specification: generateSpecification(
          f.attributes?.standardNo || '',
          f.type as FastenerType,
          f.geometry?.nominalDiameter || 0,
          f.geometry?.length || f.geometry?.pinLength
        ),
      },
    };
  });

  return fasteners;
}

// ==============================================================
// POST 主入口
// ==============================================================
export async function POST(request: NextRequest) {
  try {
    const { documentText, model } = await request.json();
    const selectedModel = model || 'doubao-seed-2-0-pro-260215';

    if (!documentText || documentText.trim().length === 0) {
      return NextResponse.json<ParseDocumentResponse>({
        success: false,
        error: '请输入文档内容',
      }, { status: 400 });
    }

    // ── 根据模型名选择调用方式 ──
    const isCozeModel = COZE_MODELS.includes(selectedModel);

    console.log(`[parse-document] model=${selectedModel} route=${isCozeModel ? 'Coze' : '自建API'}`);

    const rawContent = isCozeModel
      ? await callCozeLLM(documentText, selectedModel, request)
      : await callCustomLLM(documentText, selectedModel);

    // ── 解析结果 ──
    let fasteners: FastenerData[];
    try {
      fasteners = parseFasteners(rawContent);
    } catch {
      return NextResponse.json<ParseDocumentResponse>({
        success: false,
        error: 'LLM返回格式异常，请重试',
      }, { status: 500 });
    }

    return NextResponse.json<ParseDocumentResponse>({
      success: true,
      data: fasteners,
    });

  } catch (error) {
    const errMsg = error instanceof Error ? error.message : `未知错误: ${String(error || 'error is null/undefined')}`;
    console.error('文档解析失败:', errMsg);
    return NextResponse.json<ParseDocumentResponse>({
      success: false,
      error: `解析失败: ${errMsg}`,
    }, { status: 500 });
  }
}