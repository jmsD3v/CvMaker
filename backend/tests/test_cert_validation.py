import pytest
from fastapi import HTTPException

from services.cert_validation import validate_cert_request

USER = "11111111-1111-1111-1111-111111111111"


def test_valid_request_returns_safe_suffix():
    assert validate_cert_request(USER, f"{USER}/abc.pdf", "pdf") == ".pdf"
    assert validate_cert_request(USER, f"{USER}/abc.jpg", "JPG") == ".jpg"
    assert validate_cert_request(USER, f"{USER}/abc.jpeg", "jpeg") == ".jpg"


@pytest.mark.parametrize("file_type", ["exe", "../../etc/passwd", "pdf/../x", "", "svg"])
def test_rejects_file_types_outside_allowlist(file_type):
    with pytest.raises(HTTPException) as exc:
        validate_cert_request(USER, f"{USER}/abc.pdf", file_type)
    assert exc.value.status_code == 400


@pytest.mark.parametrize(
    "file_url",
    [
        "22222222-2222-2222-2222-222222222222/abc.pdf",  # archivo de otro usuario
        f"{USER}/../22222222-2222-2222-2222-222222222222/abc.pdf",
        f"{USER}\\..\\otro.pdf",
        "abc.pdf",
        f"/{USER}/abc.pdf",
    ],
)
def test_rejects_paths_outside_user_folder(file_url):
    with pytest.raises(HTTPException) as exc:
        validate_cert_request(USER, file_url, "pdf")
    assert exc.value.status_code == 403
