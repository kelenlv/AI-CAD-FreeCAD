// 标准紧固件类型定义

/** 紧固件类型枚举 */
export enum FastenerType {
  BOLT = 'bolt',           // 螺栓
  SCREW = 'screw',         // 螺钉
  STUD = 'stud',           // 螺柱
  NUT = 'nut',             // 螺母
  WASHER = 'washer',       // 垫圈
  RIVET = 'rivet',         // 铆钉
  PIN = 'pin',             // 销
  RING = 'ring',           // 挡圈
  BUSHING = 'bushing',     // 螺纹衬套/镶嵌件
}

export const FastenerTypeLabels: Record<FastenerType, string> = {
  [FastenerType.BOLT]: '螺栓',
  [FastenerType.SCREW]: '螺钉',
  [FastenerType.STUD]: '螺柱',
  [FastenerType.NUT]: '螺母',
  [FastenerType.WASHER]: '垫圈',
  [FastenerType.RIVET]: '铆钉',
  [FastenerType.PIN]: '销',
  [FastenerType.RING]: '挡圈',
  [FastenerType.BUSHING]: '衬套/镶嵌件',
};

/** 紧固件几何参数 */
export interface FastenerGeometryParams {
  // 通用参数
  nominalDiameter: number;       // 公称直径 d (mm)
  pitch?: number;                // 螺距 P (mm)
  
  // 螺栓/螺钉/螺柱参数
  length?: number;               // 长度 L (mm)
  headDiameter?: number;         // 头部直径 dk (mm)
  headHeight?: number;           // 头部高度 k (mm)
  threadLength?: number;         // 螺纹长度 b/lg (mm)
  
  // 螺栓特有 (六角头)
  widthAcrossFlats?: number;     // 对边宽度 s (mm)
  
  // 螺母参数
  nutHeight?: number;            // 螺母高度 m (mm)
  nutWidth?: number;             // 对边宽度 e/s (mm)
  
  // 垫圈参数
  innerDiameter?: number;        // 内径 d1 (mm)
  outerDiameter?: number;        // 外径 d2 (mm)
  washerThickness?: number;      // 厚度 h (mm)
  
  // 销参数
  pinDiameter?: number;          // 销直径 d (mm)
  pinLength?: number;            // 销长度 l (mm)
  
  // 铆钉参数
  rivetHeadDiameter?: number;    // 钉头直径 dk (mm)
  rivetHeadHeight?: number;      // 钉头高度 k (mm)
  rivetLength?: number;          // 钉杆长度 L (mm)
}

/** 紧固件非几何属性 */
export interface FastenerAttributes {
  // 基础信息
  standardNo: string;            // 标准号 (如 GB/T 5782-2016)
  materialName: string;          // 材料名称/牌号 (如 45钢, 30CrMnSiA)
  materialGrade?: string;        // 材料性能等级 (如 8.8, 10.9)
  surfaceTreatment?: string;     // 表面处理 (如 镀锌, 磷化, 达克罗)
  threadType?: string;           // 螺纹类型 (如 粗牙, 细牙)
  
  // 物资信息
  partName: string;              // 物资名称/零件名称
  category: string;              // 资源分类
  specification: string;         // 规格描述
  weight?: number;               // 理论重量 (g)
  unit?: string;                 // 计量单位 (默认: 件)
}

/** 完整的紧固件参数 */
export interface FastenerData {
  type: FastenerType;
  geometry: FastenerGeometryParams;
  attributes: FastenerAttributes;
}

/** 文档解析请求 */
export interface ParseDocumentRequest {
  documentText: string;
  docType?: 'text' | 'pdf' | 'docx';
  model?: string;  // AI模型选择
}

/** 文档解析响应 */
export interface ParseDocumentResponse {
  success: boolean;
  data?: FastenerData[];
  error?: string;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

/** 模型生成请求 */
export interface GenerateModelRequest {
  fastener: FastenerData;
  precision?: number; // 精度，默认 ±0.01mm
}

/** 模型生成响应 */
export interface GenerateModelResponse {
  success: boolean;
  data?: {
    /** Three.js 场景序列化数据或参数 */
    geometryType: string;
    parameters: Record<string, number>;
    /** 模型 bounding box */
    boundingBox: { width: number; height: number; depth: number };
  };
  error?: string;
}

/** 属性导出请求 */
export interface ExportAttributesRequest {
  fasteners: FastenerData[];
  format: 'csv' | 'json' | 'excel';
}

/** 属性导出响应 */
export interface ExportAttributesResponse {
  success: boolean;
  data?: {
    content: string;       // CSV/JSON content
    filename: string;
    mimeType: string;
  };
  error?: string;
}