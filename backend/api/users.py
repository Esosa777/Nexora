from fastapi import APIRouter, HTTPException, Depends, Header
from pydantic import BaseModel, Field
from typing import Optional
from backend.core.config import settings
from supabase import create_client, Client

router = APIRouter(prefix="/users", tags=["Users"])

supabase: Client = create_client(settings.SUPABASE_URL, settings.SUPABASE_SERVICE_ROLE_KEY)

class UserProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    country: Optional[str] = None
    educational_level: Optional[str] = None

def verify_supabase_token(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer"):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization token")
    token = authorization.split(" ")[1]
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid authentication credentials")
        return user_response.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")
    
@router.get("/profile/user_id")
def get_user_profile(user_id: str):
    response = supabase.table("user_profiles").select("*").eq("user_id", user_id).execute()
    if not response.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return response.data[0]

@router.patch("/profile")
def update_user_profile(profile_data: UserProfileUpdate, user = Depends(verify_supabase_token)):
    update_dict = {k: v for k, v in profile_data.dict().items() if v is not None}

    response = supabase.table("user_profiles").update(update_dict).eq("user_id", user.id).execute()
    if not response.data:
        raise HTTPException(status_code=400, detail="Failed to update profile")
    
    return {"message": "Profile updated successfully", "profile": response.data[0]}