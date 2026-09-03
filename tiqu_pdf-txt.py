import os
from openai import OpenAI

def extract_pdf_by_llm_vision(pdf_path, output_txt_path):
    # ==========================================
    # 步骤 1: 初始化客户端
    # ==========================================
    client = OpenAI(
        api_key="sk-XXXXXXXXXXXXXXXXX",
        base_url="https://dashscope.aliyuncs.com/compatible-mode/v1"
    )

    print(f"正在上传 PDF 文件到通义千问云端: {pdf_path}...")
    try:
        # 1. 先将 PDF 文件上传到百炼的临时存储空间
        file_object = client.files.create(
            file=open(pdf_path, "rb"),
            purpose="file-extract"
        )
    except Exception as e:
        print(f"文件上传失败: {e}")
        return

    # ==========================================
    # 步骤 2: 构造包含文件 ID 的消息
    # ==========================================
    # 注意：这里改用支持长文本和文件解析的 qwen-long 模型
    prompt = """
你是一个专业的文档分析助手。请你直接读取我上传的这个 PDF 文件。
请利用你的 OCR 视觉识别能力，将 PDF 中的文本和表格数据进行完整的提取、清洗与整合。如果碰到有合并单元格的情况，就补充到每一行。
严格按照原意，整理成一份结构清晰、排版整洁的纯文本（TXT）文档，绝对不要出现乱码。
对于其中的表格，请使用清晰的空格或对齐方式展示。
"""

    print("正在请求大模型（云端 OCR 视觉模式）解析并提取文本...")
    try:
        completion = client.chat.completions.create(
            model="qwen-long",  # 必须要用 qwen-long 或支持文件输入的模型
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                # 传入刚刚上传的文件 ID
                {"role": "system", "content": f"fileid://{file_object.id}"},
                {"role": "user", "content": prompt}
            ],
            temperature=0.1
        )

        extracted_text = completion.choices[0].message.content

        # ==========================================
        # 步骤 3: 保存到 TXT 文件
        # ==========================================
        output_dir = os.path.dirname(output_txt_path)
        if output_dir and not os.path.exists(output_dir):
            os.makedirs(output_dir)

        with open(output_txt_path, "w", encoding="utf-8") as f:
            f.write(extracted_text)

        print(f"🎉 视觉转换成功！真正无乱码的文件已保存至: {output_txt_path}")

        # 善后工作：删除云端临时文件
        client.files.delete(file_object.id)

    except Exception as e:
        print(f"调用大模型过程中发生错误: {e}")

if __name__ == "__main__":
    pdf_file = r"./62_4-2004-gbt-e-300.pdf"
    output_file = r"./62_4-2004-gbt-e-300.txt"

    extract_pdf_by_llm_vision(pdf_file, output_file)