#!/usr/bin/env python3
"""
=============================================================================
 MinerU PDF 解析器 — 标准紧固件国标文档智能解析
=============================================================================
 使用说明:
   1. 安装 MinerU:  pip install "magic-pdf[full]"
   2. 运行本脚本:   python mineru_pdf_parser.py <PDF文件路径> [--output <输出目录>]

 功能:
   - 调用 MinerU 解析 PDF 文档（表格、图文混排等复杂布局）
   - 提取纯文本内容，保存为 .txt
   - 提取结构化 Markdown 输出
   - 可对接 Web 系统的 /api/parse-pdf 接口

 参考资料:
   MinerU GitHub: https://github.com/opendatalab/MinerU
   MinerU 文档:   https://mineru.readthedocs.io
=============================================================================
"""

import os
import sys
import json
import argparse
from pathlib import Path


def check_mineru():
    """检查 MinerU 是否已安装"""
    try:
        import magic_pdf
        return True
    except ImportError:
        print("[WARNING] MinerU (magic-pdf) 未安装")
        print("  安装命令: pip install 'magic-pdf[full]'")
        print("  或轻量版: pip install 'magic-pdf[simple]'")
        print("  更多信息: https://github.com/opendatalab/MinerU")
        return False


def parse_pdf_mineru(pdf_path: str, output_dir: str) -> dict:
    """
    使用 MinerU 解析 PDF 文档

    返回: {
        "success": bool,
        "text": str,           # 提取的纯文本
        "markdown": str,       # Markdown 结构化输出
        "pages": int,          # 总页数
        "file_size": int,      # 文件大小(bytes)
        "mineru_version": str, # MinerU 版本
    }
    """
    if not check_mineru():
        print("[ERROR] MinerU 不可用，请先安装")
        return {"success": False, "error": "MinerU not installed"}

    try:
        from magic_pdf.pipe import UNIPipe
        from magic_pdf.config import ConfigParser
        from magic_pdf.utils.system_utils import get_system_info

        pdf_path_obj = Path(pdf_path)
        if not pdf_path_obj.exists():
            return {"success": False, "error": f"文件不存在: {pdf_path}"}

        file_size = pdf_path_obj.stat().st_size
        print(f"[INFO] 开始解析: {pdf_path_obj.name} ({file_size/1024:.1f} KB)")

        # --- MinerU 核心解析 ---
        config = ConfigParser()
        pipe = UNIPipe(pdf_path, config)
        pipe.pipe_classify()
        pipe.pipe_parse()

        # 提取 Markdown 内容
        md_content = pipe.get_markdown()

        # 提取纯文本
        import re
        text_content = re.sub(r'[#*_~`>\-|]', '', md_content)  # 去除 Markdown 标记
        text_content = re.sub(r'\n{3,}', '\n\n', text_content)  # 合并多余空行
        text_content = text_content.strip()

        # 获取 MinerU 版本
        try:
            import magic_pdf
            mineru_version = getattr(magic_pdf, '__version__', 'unknown')
        except:
            mineru_version = 'unknown'

        result = {
            "success": True,
            "text": text_content,
            "markdown": md_content,
            "pages": pipe.total_page,
            "file_size": file_size,
            "mineru_version": mineru_version,
        }

        # --- 保存输出 ---
        os.makedirs(output_dir, exist_ok=True)
        base_name = pdf_path_obj.stem

        # 保存纯文本
        txt_path = os.path.join(output_dir, f"{base_name}_mineru.txt")
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.write(text_content)
        print(f"[INFO] 文本已保存: {txt_path} ({len(text_content)} 字符)")

        # 保存 Markdown
        md_path = os.path.join(output_dir, f"{base_name}_mineru.md")
        with open(md_path, 'w', encoding='utf-8') as f:
            f.write(md_content)
        print(f"[INFO] Markdown已保存: {md_path}")

        # 保存 JSON 报告
        json_path = os.path.join(output_dir, f"{base_name}_mineru_report.json")
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"[INFO] 报告已保存: {json_path}")

        print(f"\n[SUCCESS] 解析完成: {pipe.total_page} 页, {len(text_content)} 字符")
        return result

    except ImportError as e:
        print(f"[ERROR] MinerU 模块导入失败: {e}")
        return {"success": False, "error": str(e)}
    except Exception as e:
        print(f"[ERROR] MinerU 解析异常: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "error": str(e)}


def main():
    parser = argparse.ArgumentParser(
        description='MinerU PDF 解析工具 — 标准紧固件国标文档智能解析',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  # 解析单个 PDF
  python mineru_pdf_parser.py GB-T5782-2016.pdf

  # 指定输出目录
  python mineru_pdf_parser.py GB-T5782-2016.pdf --output ./extracted

  # 批量解析目录下所有 PDF
  python mineru_pdf_parser.py ./pdfs/ --output ./extracted

  # 将提取的文本传给 FastenerModel API
  python mineru_pdf_parser.py bolt.pdf --output ./extracted
  # 然后把 extracted/bolt_mineru.txt 传到 Web 端解析
        """
    )
    parser.add_argument('input', help='PDF文件路径或包含PDF的目录')
    parser.add_argument('--output', '-o', default='./mineru_output',
                        help='输出目录（默认: ./mineru_output）')

    args = parser.parse_args()

    input_path = Path(args.input)
    output_dir = args.output

    if input_path.is_file():
        # 单个文件
        if input_path.suffix.lower() not in ('.pdf',):
            print(f"[ERROR] 仅支持 PDF 文件: {input_path}")
            sys.exit(1)
        parse_pdf_mineru(str(input_path), output_dir)

    elif input_path.is_dir():
        # 目录下所有 PDF
        pdf_files = list(input_path.glob('*.pdf')) + list(input_path.glob('*.PDF'))
        if not pdf_files:
            print(f"[ERROR] 目录中没有 PDF 文件: {input_path}")
            sys.exit(1)
        print(f"[INFO] 发现 {len(pdf_files)} 个 PDF 文件")
        for pdf_file in pdf_files:
            print(f"\n{'='*60}")
            parse_pdf_mineru(str(pdf_file), output_dir)
    else:
        print(f"[ERROR] 无效路径: {input_path}")
        sys.exit(1)


if __name__ == '__main__':
    main()