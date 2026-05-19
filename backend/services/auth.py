import os
import jwt
from fastapi import HTTPException, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()


class AuthError(Exception):
    pass


def validate_token(token: str, secret: str | None = None) -> str:
    secret = secret or os.getenv("SUPABASE_JWT_SECRET", "")
    try:
        payload = jwt.decode(
            token,
            secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
        user_id = payload.get("sub")
        if not user_id:
            raise AuthError("No subject in token")
        return user_id
    except jwt.ExpiredSignatureError:
        raise AuthError("Token expired")
    except jwt.InvalidTokenError as e:
        raise AuthError(f"Invalid token: {e}")


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Security(security),
) -> str:
    try:
        return validate_token(credentials.credentials)
    except AuthError as e:
        raise HTTPException(status_code=401, detail=str(e))
