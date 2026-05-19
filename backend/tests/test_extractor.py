import pytest
from unittest.mock import patch, MagicMock
from services.extractor import extract_text_from_pdf, parse_cert_with_gemini


def test_extract_text_from_pdf_with_text(tmp_path):
    import fitz
    pdf_path = tmp_path / "test.pdf"
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 50), "Certificate of Completion\nIssued by: TestCorp\nDate: 2025-01-15")
    doc.save(str(pdf_path))
    doc.close()

    text = extract_text_from_pdf(str(pdf_path))
    assert "Certificate" in text
    assert "TestCorp" in text


def test_parse_cert_with_gemini():
    mock_response = MagicMock()
    mock_response.text = '{"name": "Test Cert", "issuer": "TestCorp", "issued_date": "2025-01-15", "category": "cybersecurity"}'

    with patch("services.extractor.model") as mock_model:
        mock_model.generate_content.return_value = mock_response
        result = parse_cert_with_gemini("Certificate of Completion TestCorp 2025-01-15")

    assert result["name"] == "Test Cert"
    assert result["issuer"] == "TestCorp"
    assert result["category"] == "cybersecurity"
