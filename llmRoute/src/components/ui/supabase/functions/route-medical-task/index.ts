import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Route to specialized models based on task type
function getModelForTask(taskType: string): string {
  switch (taskType) {
    case 'ehr':
      return 'google/gemini-2.5-pro'; // Complex medical documentation
    case 'billing':
      return 'google/gemini-2.5-flash'; // Structured data extraction
    case 'patient_details':
      return 'google/gemini-2.5-flash'; // Quick information retrieval
    case 'referral_letter':
      return 'google/gemini-2.5-pro'; // Professional document generation
    default:
      return 'google/gemini-2.5-flash';
  }
}

// Get system prompt for each task type
function getSystemPrompt(taskType: string): string {
  switch (taskType) {
    case 'ehr':
      return `You are a medical documentation specialist. Create comprehensive, accurate EHR (Electronic Health Record) entries following SOAP format (Subjective, Objective, Assessment, Plan). Use proper medical terminology and maintain HIPAA compliance. Be thorough but concise.`;
    case 'billing':
      return `You are a medical billing specialist. Extract and format billing information including CPT codes, ICD-10 codes, and relevant medical procedures. Ensure accuracy for insurance claims. Provide clear justification for each code.`;
    case 'patient_details':
      return `You are a patient information specialist. Organize and present patient details clearly including demographics, medical history, current conditions, medications, and relevant clinical information. Maintain professional medical terminology.`;
    case 'referral_letter':
      return `You are a medical correspondence specialist. Draft professional referral letters with clear clinical rationale, relevant history, current treatment, and specific consultation needs. Use appropriate professional medical writing style.`;
    default:
      return `You are a helpful medical AI assistant. Provide accurate, professional medical information and documentation assistance.`;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { patientId, taskType, input } = await req.json();

    if (!patientId || !taskType || !input) {
      throw new Error('Missing required fields: patientId, taskType, or input');
    }

    console.log(`Processing ${taskType} task for patient ${patientId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get patient information
    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('*')
      .eq('id', patientId)
      .single();

    if (patientError) {
      throw new Error(`Patient not found: ${patientError.message}`);
    }

    // Route to appropriate model
    const model = getModelForTask(taskType);
    const systemPrompt = getSystemPrompt(taskType);

    console.log(`Using model: ${model}`);

    // Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Patient: ${patient.full_name}${patient.medical_record_number ? ` (MRN: ${patient.medical_record_number})` : ''}\n\nTask: ${input}`
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', errorText);
      throw new Error(`AI Gateway error: ${aiResponse.status} - ${errorText}`);
    }

    const aiData = await aiResponse.json();
    const response = aiData.choices[0].message.content;

    console.log('AI response generated successfully');

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
      throw new Error('Not authenticated');
    }

    // Save conversation to database
    const { error: insertError } = await supabase
      .from('conversations')
      .insert({
        patient_id: patientId,
        doctor_id: user.id,
        task_type: taskType,
        user_input: input,
        ai_response: response,
        model_used: model,
      });

    if (insertError) {
      console.error('Error saving conversation:', insertError);
    }

    return new Response(
      JSON.stringify({ 
        response,
        modelUsed: model,
        taskType,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});