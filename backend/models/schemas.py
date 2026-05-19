from pydantic import BaseModel
from typing import Optional


class ExtractCertRequest(BaseModel):
    file_url: str
    file_type: str
    user_id: str
    cert_id: str


class ExtractedCert(BaseModel):
    name: str
    issuer: str
    issued_date: Optional[str] = None
    category: str


class GenerateRequest(BaseModel):
    job_posting_text: str
    user_id: str


class Experience(BaseModel):
    title: str
    company: str
    location: Optional[str] = None
    start_date: str
    end_date: Optional[str] = None
    description: Optional[str] = None
    highlights: list[str] = []


class Education(BaseModel):
    degree: str
    institution: str
    status: str
    start_year: Optional[int] = None
    end_year: Optional[int] = None


class Certification(BaseModel):
    name: str
    issuer: str
    issued_date: Optional[str] = None
    category: str


class UserProfile(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    linkedin: Optional[str] = None
    github: Optional[str] = None
    location: Optional[str] = None
    experience: list[Experience] = []
    education: list[Education] = []
    certifications: list[Certification] = []
