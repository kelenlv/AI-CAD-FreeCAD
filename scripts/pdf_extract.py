#!/usr/bin/env python3
"""PDF文本提取工具 - 由FastenerModel AI内部调用"""
import sys
from pdfminer.high_level import extract_text

if len(sys.argv) < 2:
    print("[ERROR] 请指定PDF文件路径", file=sys.stderr)
    sys.exit(1)

filepath = sys.argv[1]
try:
    text = extract_text(filepath)
    if text:
        # 只输出前50000字符
        print(text[:50000])
    else:
        print("", end="")
except Exception as e:
    print(f"[ERROR] {e}", file=sys.stderr)
    sys.exit(1)