import time
import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
from supabase import create_client, Client
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv("apiR.env")

app = FastAPI()

# --- Configuration ---
SUPABASE_URL = "https://ixwbfvttrviebvrqhhcn.supabase.co"
SUPABASE_KEY = "sb_secret_5WXYT-DxsxInwykSPd5wTg_ioq2P4uP"
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Configure Gemini
genai.configure(api_key=os.getenv("GENAI_API_KEY"))
model = genai.GenerativeModel('gemini-pro')

# --- Models ---
class QueryRequest(BaseModel):
    patient_details: Optional[str] = None
    query_text: str

class QueryResponse(BaseModel):
    router_decision: str
    model_used: str
    final_analysis: str
    metadata: Optional[Dict[str, Any]] = None

# --- Mock Models ---

class MockModel:
    def process(self, input_text: str, patient_details: Optional[str] = None) -> str:
        raise NotImplementedError

class ReferralModel(MockModel):
    def process(self, input_text: str, patient_details: Optional[str] = None) -> str:
        try:
            prompt = f"""
            You are a medical assistant. Draft a professional referral letter based on the following:
            
            Task: {input_text}
            Patient Details: {patient_details or 'Not provided'}
            
            The letter should be formal, concise, and addressed to the appropriate specialist.
            """
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
            return f"Error generating referral: {str(e)}"

class EHRModel(MockModel):
    def process(self, input_text: str, patient_details: Optional[str] = None) -> str:
        time.sleep(0.5)
        return f"EHR QUERY RESULT: Found recent lab results and history related to '{input_text[:30]}...'"

class BillingModel(MockModel):
    def process(self, input_text: str, patient_details: Optional[str] = None) -> str:
        time.sleep(0.5)
        return f"BILLING CODE: CPT-4 codes generated for '{input_text[:30]}...'. Estimated cost calculated."

class RPAModel(MockModel):
    def process(self, input_text: str, patient_details: Optional[str] = None) -> str:
        time.sleep(1.0)
        return f"🤖 RPA ACTION: Automating task '{input_text[:30]}...'. \n[Step 1] Opening external portal...\n[Step 2] Filling patient data...\n[Step 3] Submitting form.\n✅ Task Completed."

class GeneralModel(MockModel):
    def process(self, input_text: str, patient_details: Optional[str] = None) -> str:
        return "I am not sure which specialist to use. I will handle this as a general query."

# --- Router Logic ---

def route_request(user_input: str):
    text = user_input.lower()
    
    automation_keywords = ['automate', 'robot', 'rpa', 'fill', 'submit', 'click', 'form']
    if any(word in text for word in automation_keywords):
        return "RPA Model", RPAModel()

    billing_keywords = ['invoice', 'cost', 'price', 'insurance', 'copay', 'deductible', 'bill', 'code', 'cpt']
    if any(word in text for word in billing_keywords):
        return "Billing Model", BillingModel()

    referral_keywords = ['refer', 'letter', 'specialist', 'handover', 'transfer', 'recommendation']
    if any(word in text for word in referral_keywords):
        return "Referral Model", ReferralModel()

    ehr_keywords = ['history', 'lab', 'result', 'blood', 'prescription', 'medication', 'dose', 'patient id', 'mrn']
    if any(word in text for word in ehr_keywords):
        return "EHR Model", EHRModel()
    
    return "General Assistant", GeneralModel()

# --- Patient Management ---

class Patient(BaseModel):
    full_name: str
    medical_record_number: str # Mapping Age/Gender here
    contact_email: str # Mapping Condition here

@app.get("/api/patients")
async def get_patients():
    try:
        response = supabase.table("patients").select("*").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/patients")
async def add_patient(patient: Patient):
    try:
        data = patient.model_dump()
        # Hardcode doctor_id for now since we don't have real auth flow
        data["doctor_id"] = "0bea631a-8854-445d-9502-cbc170beb9bf" 
        response = supabase.table("patients").insert(data).execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- API Endpoints ---

@app.post("/api/route", response_model=QueryResponse)
async def route_query(request: QueryRequest):
    try:
        model_name, model_instance = route_request(request.query_text)
        result = model_instance.process(request.query_text, request.patient_details)
        
        # Log to Supabase
        try:
            supabase.table("llm_query_log").insert({
                "input_data": request.model_dump(),
                "status": "COMPLETED_SUCCESS",
                "output_data": {"router_decision": model_name, "final_analysis": result},
                "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            }).execute()
        except Exception as e:
            print(f"Supabase Logging Error: {e}")

        return QueryResponse(
            router_decision=f"Routed to {model_name}",
            model_used=model_name,
            final_analysis=result
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# Serve static files (Frontend)
# We will mount the 'dist' folder from the frontend build later
# For now, we can keep it as is or update when frontend is built
if os.path.exists("frontend/dist"):
    app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="static")
elif os.path.exists("frontend_smpl"):
     app.mount("/", StaticFiles(directory="frontend_smpl", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
