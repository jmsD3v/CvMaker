import os
import zipfile
import io
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import create_client
from models.schemas import GenerateRequest, UserProfile, Experience, Education, Certification
from services.generator import generate_cv_content, generate_cover_letter, build_docx, build_letter_docx
from services.auth import get_current_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

supabase = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
)


def fetch_user_profile(user_id: str) -> UserProfile:
    profile_res = supabase.table("profiles").select("*").eq("id", user_id).single().execute()
    p = profile_res.data

    exp_res = supabase.table("experience").select("*").eq("user_id", user_id).order("start_date", desc=True).execute()
    edu_res = supabase.table("education").select("*").eq("user_id", user_id).order("start_year", desc=True).execute()
    cert_res = (
        supabase.table("certifications")
        .select("name,issuer,issued_date,category")
        .eq("user_id", user_id)
        .order("issued_date", desc=True)
        .execute()
    )

    return UserProfile(
        full_name=p.get("full_name") or "",
        email=p.get("email"),
        phone=p.get("phone"),
        linkedin=p.get("linkedin"),
        github=p.get("github"),
        location=p.get("location"),
        experience=[Experience(**{k: v for k, v in e.items() if k in Experience.model_fields}) for e in (exp_res.data or [])],
        education=[Education(**{k: v for k, v in e.items() if k in Education.model_fields}) for e in (edu_res.data or [])],
        certifications=[Certification(**{k: v for k, v in c.items() if k in Certification.model_fields}) for c in (cert_res.data or [])],
    )


@router.post("")
@limiter.limit("10/minute")
async def generate_cv(
    request: Request,
    body: GenerateRequest,
    user_id: str = Depends(get_current_user),
):
    if user_id != body.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    try:
        profile = fetch_user_profile(user_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching profile: {e}")

    try:
        cv_content = generate_cv_content(profile, body.job_posting_text)
        letter_text = generate_cover_letter(profile, body.job_posting_text, cv_content.get("summary", ""))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating content: {e}")

    contact_parts = [x for x in [profile.email, profile.phone, profile.linkedin, profile.github] if x]
    contact_str = " | ".join(contact_parts)

    cv_bytes = build_docx(cv_content, profile.full_name, contact_str)
    letter_bytes = build_letter_docx(letter_text, profile.full_name)

    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("CV_JMS.docx", cv_bytes)
        zf.writestr("Carta_Presentacion_JMS.docx", letter_bytes)
    zip_buf.seek(0)

    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=cvmaker_output.zip"},
    )
