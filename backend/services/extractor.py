import os
import json
import fitz  # PyMuPDF
import google.generativeai as genai
from pathlib import Path

genai.configure(api_key=os.getenv("GEMINI_API_KEY", ""))
model = genai.GenerativeModel("gemini-2.0-flash-exp")

EXTRACT_PROMPT = """Analyze this certificate text and extract structured information.
Return ONLY valid JSON with these exact keys:
- name: the certificate/course name (string)
- issuer: the issuing organization (string)
- issued_date: date in YYYY-MM-DD format, or null if not found
- category: one of "cybersecurity", "ai", "dev", "industrial", "other"

Text:
{text}

JSON only, no explanation:"""


def extract_text_from_pdf(file_path: str) -> str:
    doc = fitz.open(file_path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text.strip()


def extract_text_from_image_with_gemini(file_path: str) -> str:
    with open(file_path, "rb") as f:
        image_data = f.read()
    ext = Path(file_path).suffix.lower().lstrip(".")
    mime = "image/jpeg" if ext in ("jpg", "jpeg") else f"image/{ext}"
    response = model.generate_content([
        {"mime_type": mime, "data": image_data},
        "Extract all text from this certificate image. Return only the raw text.",
    ])
    return response.text.strip()


def parse_cert_with_gemini(text: str) -> dict:
    response = model.generate_content(EXTRACT_PROMPT.format(text=text[:4000]))
    raw = response.text.strip()
    if raw.startswith("```"):
        parts = raw.split("```")
        raw = parts[1] if len(parts) > 1 else raw
        if raw.startswith("json"):
            raw = raw[4:]
    return json.loads(raw.strip())


def extract_cert(file_path: str, file_type: str) -> tuple[str, dict]:
    """Returns (raw_text, structured_cert_data)."""
    if file_type == "pdf":
        raw_text = extract_text_from_pdf(file_path)
        if len(raw_text) < 50:
            raw_text = extract_text_from_image_with_gemini(file_path)
    else:
        raw_text = extract_text_from_image_with_gemini(file_path)

    cert_data = parse_cert_with_gemini(raw_text)
    return raw_text, cert_data
