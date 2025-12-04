import os
from supabase import create_client, Client

url: str = "https://ixwbfvttrviebvrqhhcn.supabase.co"
key: str = "sb_secret_5WXYT-DxsxInwykSPd5wTg_ioq2P4uP"
supabase: Client = create_client(url, key)

try:
    # Try to sign in with demo credentials
    email = "demo@medroute.com"
    password = "demo123456"
    try:
        print(f"Signing in as {email}...")
        auth_response = supabase.auth.sign_in_with_password({"email": email, "password": password})
        if auth_response.user:
            doctor_id = auth_response.user.id
            print(f"Signed in! ID: {doctor_id}")
        else:
            print("Failed to sign in (no user in response)")
            doctor_id = None
    except Exception as e:
        print(f"Auth Error: {e}")
        # Try to sign up if sign in fails
        try:
             print("Sign in failed, trying to sign up...")
             auth_response = supabase.auth.sign_up({"email": email, "password": password})
             if auth_response.user:
                 doctor_id = auth_response.user.id
                 print(f"Created user: {email} with ID: {doctor_id}")
             else:
                 doctor_id = None
        except Exception as e2:
             print(f"Signup Error: {e2}")
             doctor_id = None

    if doctor_id:
        # Try to insert a patient to probe schema
        try:
            # Guessing columns based on previous errors
            patient_data = {
                "doctor_id": doctor_id,
                "full_name": "Bob Builder"
            }
            print(f"Attempting to insert: {patient_data}")
            response = supabase.table("patients").insert(patient_data).execute()
            print("Insert successful!")
            print("Data:", response.data)
        except Exception as e:
            print(f"Insert Error: {e}")
    else:
        print("Skipping insert due to missing doctor_id")

    response = supabase.table("patients").select("*").execute()
    print("Patients table exists.")
    print(f"Count: {len(response.data)}")
    print("Data:", response.data)
except Exception as e:
    print(f"Error: {e}")
