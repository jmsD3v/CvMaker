import pytest
import jwt
import time
from services.auth import validate_token, AuthError

FAKE_SECRET = "testsecret" * 4  # 40 chars, valid for HS256


def make_token(user_id: str, secret: str, expired: bool = False) -> str:
    exp = time.time() - 10 if expired else time.time() + 3600
    return jwt.encode(
        {"sub": user_id, "aud": "authenticated", "exp": int(exp)},
        secret,
        algorithm="HS256",
    )


def test_valid_token():
    token = make_token("user-123", FAKE_SECRET)
    user_id = validate_token(token, secret=FAKE_SECRET)
    assert user_id == "user-123"


def test_expired_token():
    token = make_token("user-123", FAKE_SECRET, expired=True)
    with pytest.raises(AuthError):
        validate_token(token, secret=FAKE_SECRET)


def test_invalid_signature():
    token = make_token("user-123", "wrongsecret" * 4)
    with pytest.raises(AuthError):
        validate_token(token, secret=FAKE_SECRET)
