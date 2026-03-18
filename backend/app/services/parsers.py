from __future__ import annotations
import io
import csv
from pathlib import Path


def parse_pdf(content: bytes) -> tuple[str, dict]:
    from PyPDF2 import PdfReader
    reader = PdfReader(io.BytesIO(content))
    pages: list[str] = []
    page_map: dict[int, tuple[int, int]] = {}
    offset = 0

    for i, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        start = offset
        offset += len(text)
        page_map[i + 1] = (start, offset)
        pages.append(text)

    full_text = "\n\n".join(pages)
    metadata = {
        "page_count": len(reader.pages),
        "page_map": {str(k): list(v) for k, v in page_map.items()},
    }
    return full_text, metadata


def parse_docx(content: bytes) -> tuple[str, dict]:
    import docx
    doc = docx.Document(io.BytesIO(content))
    paragraphs: list[str] = []
    para_map: dict[int, tuple[int, int]] = {}
    offset = 0

    for i, para in enumerate(doc.paragraphs):
        text = para.text
        if text.strip():
            start = offset
            offset += len(text)
            para_map[i + 1] = (start, offset)
            paragraphs.append(text)

    full_text = "\n\n".join(paragraphs)
    metadata = {
        "paragraph_count": len(paragraphs),
        "para_map": {str(k): list(v) for k, v in para_map.items()},
    }
    return full_text, metadata


def parse_csv(content: bytes) -> tuple[str, dict]:
    text = content.decode("utf-8", errors="replace")
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)
    if not rows:
        return "", {"row_count": 0, "col_count": 0}

    headers = rows[0]
    output_parts: list[str] = []
    for i, row in enumerate(rows[1:], 1):
        row_text_parts = []
        for j, val in enumerate(row):
            header = headers[j] if j < len(headers) else f"col_{j}"
            row_text_parts.append(f"{header}: {val}")
        output_parts.append(f"Row {i}: " + ", ".join(row_text_parts))

    full_text = "\n".join(output_parts)
    metadata = {"row_count": len(rows) - 1, "col_count": len(headers), "headers": headers}
    return full_text, metadata


def parse_html(content: bytes) -> tuple[str, dict]:
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(content, "html.parser")
    for script_or_style in soup(["script", "style"]):
        script_or_style.decompose()

    text = soup.get_text(separator="\n")
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    full_text = "\n".join(lines)

    title = soup.title.string if soup.title else None
    metadata = {"title": title}
    return full_text, metadata


def parse_markdown(content: bytes) -> tuple[str, dict]:
    import markdown
    from bs4 import BeautifulSoup

    md_text = content.decode("utf-8", errors="replace")
    html = markdown.markdown(md_text)
    soup = BeautifulSoup(html, "html.parser")
    plain = soup.get_text(separator="\n")

    headings = [h.get_text() for h in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6"])]
    metadata = {"headings": headings}
    return plain, metadata


def parse_document(filename: str, content: bytes) -> tuple[str, dict]:
    ext = Path(filename).suffix.lower()
    parsers = {
        ".pdf": parse_pdf,
        ".docx": parse_docx,
        ".csv": parse_csv,
        ".html": parse_html,
        ".htm": parse_html,
        ".md": parse_markdown,
        ".markdown": parse_markdown,
        ".txt": lambda c: (c.decode("utf-8", errors="replace"), {}),
    }

    parser = parsers.get(ext)
    if not parser:
        raise ValueError(f"Unsupported file type: {ext}")

    return parser(content)


def get_page_for_offset(offset: int, page_map: dict) -> int | None:
    for page_str, (start, end) in page_map.items():
        if start <= offset < end:
            return int(page_str)
    return None


def get_paragraph_for_offset(offset: int, para_map: dict) -> int | None:
    for para_str, (start, end) in para_map.items():
        if start <= offset < end:
            return int(para_str)
    return None
