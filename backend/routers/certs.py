import os
import tempfile
import httpx
from fastapi import APIRouter, Depends, HTTPException, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from supabase import create_client
from models.schemas import ExtractCertRequest, ExtractedCert
from services.extractor import extract_cert
from services.auth import get_current_user

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

supabase = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
)


@router.post("/extract", response_model=ExtractedCert)
@limiter.limit("10/minute")
async def extract_certification(
    request: Request,
    body: ExtractCertRequest,
    user_id: str = Depends(get_current_user),
):
    if user_id != body.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    signed = supabase.storage.from_("certifications").create_signed_url(
        body.file_url, 300
    )
    download_url = signed["signedURL"]

    async with httpx.AsyncClient() as client:
        response = await client.get(download_url)
        response.raise_for_status()
        content = response.content

    ext = body.file_type
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        raw_text, cert_data = extract_cert(tmp_path, ext)
    finally:
        os.unlink(tmp_path)

    supabase.table("certifications").update({
        "name": cert_data.get("name", "Sin nombre"),
        "issuer": cert_data.get("issuer", "Desconocido"),
        "issued_date": cert_data.get("issued_date"),
        "category": cert_data.get("category", "other"),
        "raw_text": raw_text,
    }).eq("id", body.cert_id).execute()

    return ExtractedCert(**cert_data)
