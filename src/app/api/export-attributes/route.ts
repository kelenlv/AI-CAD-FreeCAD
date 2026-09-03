import { NextRequest, NextResponse } from 'next/server';
import { ExportAttributesRequest, ExportAttributesResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const body: ExportAttributesRequest = await request.json();
    const { fasteners, format = 'csv' } = body;

    if (!fasteners || fasteners.length === 0) {
      return NextResponse.json<ExportAttributesResponse>({
        success: false,
        error: '请提供至少一个紧固件数据',
      }, { status: 400 });
    }

    const typeLabels: Record<string, string> = {
      bolt: '螺栓', screw: '螺钉', stud: '螺柱',
      nut: '螺母', washer: '垫圈', rivet: '铆钉',
      pin: '销', ring: '挡圈', bushing: '衬套/镶嵌件',
    };

    if (format === 'json') {
      const content = JSON.stringify(fasteners, null, 2);
      return NextResponse.json<ExportAttributesResponse>({
        success: true,
        data: {
          content,
          filename: 'fastener-attributes.json',
          mimeType: 'application/json',
        },
      });
    }

    // CSV格式 - 匹配附件1标准件属性信息表
    const headers = [
      '序号', '物资名称', '标准号', '规格', '资源分类',
      '材料牌号', '性能等级', '表面处理', '公称直径(mm)',
      '长度(mm)', '螺纹类型', '螺距(mm)', '理论重量(g)', '计量单位'
    ];

    const rows = fasteners.map((f, idx) => {
      const g = f.geometry;
      const a = f.attributes;
      return [
        idx + 1,
        a.partName || '',
        a.standardNo || '',
        a.specification || '',
        a.category || `紧固件/${typeLabels[f.type] || f.type}`,
        a.materialName || '',
        a.materialGrade || '',
        a.surfaceTreatment || '',
        g.nominalDiameter?.toString() || '',
        (g.length || g.pinLength || g.rivetLength || '')?.toString() || '',
        a.threadType || '粗牙',
        g.pitch?.toString() || '',
        a.weight?.toString() || '',
        a.unit || '件',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    return NextResponse.json<ExportAttributesResponse>({
      success: true,
      data: {
        content: csvContent,
        filename: 'fastener-attributes.csv',
        mimeType: 'text/csv; charset=utf-8',
      },
    });

  } catch (error) {
    return NextResponse.json<ExportAttributesResponse>({
      success: false,
      error: `导出失败: ${error instanceof Error ? error.message : '未知错误'}`,
    }, { status: 500 });
  }
}