#!/usr/bin/env python3
"""
生成最小烟雾测试 PDF（优先嵌入系统中日韩字体以便文本可抽取）。
若找不到 CJK 字体，则退化为英文长句（仍可通过 ingest 管道）。
"""
import os
import sys

from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# (路径, ttc_subfont_index 或 None 表示非 TTC / 默认)
FONT_CANDIDATES = [
    ("/System/Library/Fonts/PingFang.ttc", 0),
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", 0),
    ("/Library/Fonts/Arial Unicode.ttf", None),
    ("/System/Library/Fonts/Supplemental/Arial Unicode.ttf", None),
    ("C:\\Windows\\Fonts\\msyh.ttc", 0),
    ("C:\\Windows\\Fonts\\simhei.ttf", None),
    ("/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc", 0),
    ("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc", 0),
]


def try_register_cjk_font():
    for path, sub in FONT_CANDIDATES:
        if not os.path.isfile(path):
            continue
        try:
            if path.lower().endswith(".ttc") and sub is not None:
                pdfmetrics.registerFont(TTFont("SmokeCJK", path, subfontIndex=sub))
            else:
                pdfmetrics.registerFont(TTFont("SmokeCJK", path))
            return "SmokeCJK"
        except OSError:
            continue
        except Exception:
            continue
    return None


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: gen-smoke-pdf.py <output.pdf>", file=sys.stderr)
        sys.exit(2)
    out = sys.argv[1]
    font = try_register_cjk_font()
    c = canvas.Canvas(out, pagesize=A4)
    if font:
        c.setFont(font, 11)
        text = (
            "这是一份用于知识库入库验收的最小烟雾测试文档。"
            "Harness 要求可复现；若本段可被切分与嵌入，说明 PDF 文本层与管道末端正常。"
        )
    else:
        c.setFont("Helvetica", 11)
        text = (
            "Harness smoke-test PDF (no CJK system font found). "
            "Repeat sentence to exceed tokenizer smoke length. " * 4
        )
    c.drawString(72, 780, text)
    c.save()


if __name__ == "__main__":
    main()
