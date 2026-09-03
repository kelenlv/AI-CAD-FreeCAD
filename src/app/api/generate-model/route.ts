import { NextRequest, NextResponse } from 'next/server';
import { GenerateModelRequest, GenerateModelResponse } from '@/lib/types';
import { getModelGeometryParams } from '@/lib/fastener-params';

export async function POST(request: NextRequest) {
  try {
    const body: GenerateModelRequest = await request.json();
    const { fastener } = body;

    if (!fastener || !fastener.type || !fastener.geometry) {
      return NextResponse.json<GenerateModelResponse>({
        success: false,
        error: '请提供有效的紧固件参数',
      }, { status: 400 });
    }

    const params = getModelGeometryParams(fastener.type, fastener.geometry);
    const d = fastener.geometry.nominalDiameter;

    // 计算 bounding box
    let boundingBox = { width: 0, height: 0, depth: 0 };
    switch (fastener.type) {
      case 'bolt':
        boundingBox = { width: params.dk || params.s * 1.2, height: params.L, depth: params.dk || params.s * 1.2 };
        break;
      case 'nut':
        boundingBox = { width: params.e || params.s * 1.2, height: params.m, depth: params.e || params.s * 1.2 };
        break;
      case 'washer':
        boundingBox = { width: params.d2, height: params.h, depth: params.d2 };
        break;
      case 'screw':
        boundingBox = { width: params.dk, height: params.L + params.k, depth: params.dk };
        break;
      case 'rivet':
        boundingBox = { width: params.dk, height: params.L + params.k, depth: params.dk };
        break;
      case 'pin':
        boundingBox = { width: d, height: params.L, depth: d };
        break;
      default:
        boundingBox = { width: d * 2, height: d * 4, depth: d * 2 };
    }

    return NextResponse.json<GenerateModelResponse>({
      success: true,
      data: {
        geometryType: fastener.type,
        parameters: params,
        boundingBox,
      },
    });

  } catch (error) {
    return NextResponse.json<GenerateModelResponse>({
      success: false,
      error: `模型生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
    }, { status: 500 });
  }
}