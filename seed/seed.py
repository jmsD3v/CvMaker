"""
One-time seed script to pre-load Juanma's profile into Supabase.

Usage:
    cd seed
    pip install supabase python-dotenv
    python seed.py juanmanuelsilva06@gmail.com

Prerequisites:
    1. User must have logged in to the app at least once (so auth.users row exists)
    2. .env file must exist at ../backend/.env with SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY
"""
import os
import sys
from pathlib import Path

# Load backend .env
env_path = Path(__file__).parent.parent / "backend" / ".env"
if env_path.exists():
    from dotenv import load_dotenv
    load_dotenv(env_path)

from supabase import create_client
from profile_data import PROFILE, EXPERIENCE, EDUCATION, CERTIFICATIONS_STATIC

supabase = create_client(
    os.getenv("SUPABASE_URL", ""),
    os.getenv("SUPABASE_SERVICE_ROLE_KEY", ""),
)


def seed(email: str):
    # Find user by email via admin API
    try:
        response = supabase.auth.admin.list_users()
        users = response if isinstance(response, list) else getattr(response, 'users', [])
        user = next((u for u in users if getattr(u, 'email', None) == email), None)
    except Exception as e:
        print(f"Error listing users: {e}")
        print("Make sure SUPABASE_SERVICE_ROLE_KEY is set correctly.")
        sys.exit(1)

    if not user:
        print(f"User {email} not found in auth.users.")
        print("Log in to the app first via the magic link, then run this script.")
        sys.exit(1)

    user_id = user.id
    print(f"Seeding data for {email} (id: {user_id})")

    # Upsert profile
    supabase.table("profiles").upsert({**PROFILE, "id": user_id}).execute()
    print("✓ Profile")

    # Clear and re-insert experience
    supabase.table("experience").delete().eq("user_id", user_id).execute()
    for exp in EXPERIENCE:
        supabase.table("experience").insert({**exp, "user_id": user_id}).execute()
    print(f"✓ Experience ({len(EXPERIENCE)} items)")

    # Clear and re-insert education
    supabase.table("education").delete().eq("user_id", user_id).execute()
    for edu in EDUCATION:
        supabase.table("education").insert({**edu, "user_id": user_id}).execute()
    print(f"✓ Education ({len(EDUCATION)} items)")

    # Clear and re-insert certifications
    supabase.table("certifications").delete().eq("user_id", user_id).execute()
    for cert in CERTIFICATIONS_STATIC:
        supabase.table("certifications").insert({**cert, "user_id": user_id}).execute()
    print(f"✓ Certifications ({len(CERTIFICATIONS_STATIC)} items)")

    print("\n✅ Seed complete!")
    print("You can now upload additional cert files via the app to supplement this data.")


if __name__ == "__main__":
    target_email = sys.argv[1] if len(sys.argv) > 1 else "juanmanuelsilva06@gmail.com"
    seed(target_email)
