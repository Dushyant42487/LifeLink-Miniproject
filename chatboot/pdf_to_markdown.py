"""
Convert PDF documents to clean, well-formatted Markdown (.md).
Primary engine: unstructured library (partition_pdf).
Fallback engine: PyMuPDF (fitz) with structural heuristic formatting.
"""

import sys
import os
import json

def convert_pdf_with_unstructured(pdf_path):
    try:
        from unstructured.partition.pdf import partition_pdf
        elements = partition_pdf(
            filename=pdf_path,
            strategy="fast",
            infer_table_structure=True
        )
        md_lines = []
        for el in elements:
            category = getattr(el, "category", "") or el.__class__.__name__
            text = str(el).strip()
            if not text:
                continue

            if category in ("Title",):
                md_lines.append(f"# {text}\n")
            elif category in ("Header", "Subheadline", "Section"):
                md_lines.append(f"## {text}\n")
            elif category in ("ListItem",):
                md_lines.append(f"- {text}")
            elif category in ("Table",):
                # Check for table metadata
                table_html = getattr(getattr(el, "metadata", None), "text_as_html", None)
                if table_html:
                    md_lines.append(f"\n{text}\n")
                else:
                    md_lines.append(f"\n{text}\n")
            else:
                md_lines.append(f"{text}\n")

        return "\n".join(md_lines), "unstructured"
    except Exception as e:
        return None, f"unstructured failed: {e}"

def convert_pdf_with_pymupdf(pdf_path):
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)
    md_lines = []
    
    for page_num in range(len(doc)):
        page = doc[page_num]
        blocks = page.get_text("blocks")  # (x0, y0, x1, y1, text, block_no, block_type)
        
        if len(doc) > 1:
            md_lines.append(f"\n<!-- Page {page_num + 1} -->\n")
            
        for b in blocks:
            if b[6] == 0:  # text block
                text = b[4].strip()
                if not text:
                    continue
                
                # Check if it looks like a heading
                lines = text.split("\n")
                first_line = lines[0].strip()
                
                # Simple heuristics for heading vs body
                if len(lines) <= 2 and len(first_line) < 80 and not first_line.endswith("."):
                    if first_line.isupper() or len(lines) == 1 and len(first_line) < 50:
                        md_lines.append(f"### {text}\n")
                    else:
                        md_lines.append(f"## {text}\n")
                elif first_line.startswith(("•", "-", "*", "1.", "2.", "3.", "4.", "5.")):
                    md_lines.append(text)
                else:
                    md_lines.append(f"{text}\n")
                    
    doc.close()
    return "\n".join(md_lines), "pymupdf_structured"

def convert(pdf_path, output_md_path):
    if not os.path.exists(pdf_path):
        return {"success": False, "error": f"File not found: {pdf_path}"}
    
    # Try unstructured first
    content, engine = convert_pdf_with_unstructured(pdf_path)
    
    # Fallback to PyMuPDF if unstructured is unavailable
    if not content:
        content, engine = convert_pdf_with_pymupdf(pdf_path)
        
    os.makedirs(os.path.dirname(os.path.abspath(output_md_path)), exist_ok=True)
    with open(output_md_path, "w", encoding="utf-8") as f:
        f.write(content)
        
    return {
        "success": True,
        "engine": engine,
        "outputPath": output_md_path,
        "charCount": len(content)
    }

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: python pdf_to_markdown.py <pdf_path> <output_md_path>"}))
        sys.exit(1)
        
    pdf_in = sys.argv[1]
    md_out = sys.argv[2]
    result = convert(pdf_in, md_out)
    print(json.dumps(result))
