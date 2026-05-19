import pytest
from unittest.mock import patch, MagicMock
from services.generator import build_cv_prompt, build_docx
from models.schemas import UserProfile, Experience, Education, Certification


def make_profile() -> UserProfile:
    return UserProfile(
        full_name="Juan Manuel Silva",
        email="test@test.com",
        phone="3625-455529",
        linkedin="linkedin.com/in/jmsilva83",
        github="github.com/jmsD3v",
        location="Las Breñas, Chaco, Argentina",
        experience=[
            Experience(
                title="Oficial Eléctrico",
                company="MSU Energy",
                location="Chaco",
                start_date="2022-01-01",
                end_date=None,
                description="Parque solar 45MW",
                highlights=["PLC Siemens", "SCADA"],
            )
        ],
        education=[
            Education(
                degree="Licenciatura en Ciberdefensa",
                institution="UNDEF",
                status="in_progress",
                start_year=2026,
                end_year=None,
            )
        ],
        certifications=[
            Certification(
                name="Google Cybersecurity",
                issuer="Google",
                issued_date="2025-11-01",
                category="cybersecurity",
            )
        ],
    )


def test_build_cv_prompt():
    profile = make_profile()
    prompt = build_cv_prompt(profile, "Consultor ciberseguridad industrial OT/IT")
    assert "Juan Manuel Silva" in prompt
    assert "MSU Energy" in prompt
    assert "Google Cybersecurity" in prompt
    assert "ciberseguridad" in prompt.lower()


def test_build_docx_returns_bytes():
    cv_content = {
        "summary": "Profesional con +25 años en infraestructura crítica.",
        "experience": [
            {
                "title": "Oficial Eléctrico",
                "company": "MSU Energy",
                "period": "2022–Actual",
                "bullets": ["PLC Siemens", "SCADA"],
            }
        ],
        "education": [
            {"degree": "Licenciatura en Ciberdefensa", "institution": "UNDEF", "period": "2026–En curso"}
        ],
        "certifications": [{"name": "Google Cybersecurity", "issuer": "Google", "date": "Nov 2025"}],
        "skills": ["PLC Siemens", "SCADA", "Python"],
    }
    result = build_docx(cv_content, full_name="Juan Manuel Silva", contact="test@test.com | 3625-455529")
    assert isinstance(result, bytes)
    assert len(result) > 1000
