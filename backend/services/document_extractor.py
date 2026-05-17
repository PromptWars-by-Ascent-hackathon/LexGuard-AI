"""Document text extraction service — handles PDF, DOCX, TXT."""
import io
import aiofiles

async def extract_text(file_bytes: bytes, filename: str) -> str:
    """Extract plain text from uploaded document based on file type."""
    ext = filename.lower().rsplit(".", 1)[-1]

    if ext == "txt":
        return file_bytes.decode("utf-8", errors="ignore")

    elif ext == "pdf":
        return _extract_pdf(file_bytes)

    elif ext in ("docx", "doc"):
        return _extract_docx(file_bytes)

    else:
        return file_bytes.decode("utf-8", errors="ignore")


def _extract_pdf(file_bytes: bytes) -> str:
    try:
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(file_bytes))
        pages = []
        for i, page in enumerate(reader.pages[:150]):  # max 150 pages
            text = page.extract_text()
            if text:
                pages.append(f"[Page {i+1}]\n{text}")
        return "\n\n".join(pages)
    except Exception as e:
        return f"[PDF extraction error: {e}]"


def _extract_docx(file_bytes: bytes) -> str:
    try:
        from docx import Document
        doc = Document(io.BytesIO(file_bytes))
        paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
        return "\n".join(paragraphs)
    except Exception as e:
        return f"[DOCX extraction error: {e}]"
