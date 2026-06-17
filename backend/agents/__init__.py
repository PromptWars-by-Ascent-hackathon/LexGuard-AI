import os
import json
import re
from google import genai
from google.genai import types
from config import settings

FLASH_MODEL = "gemini-1.5-flash"
PRO_MODEL   = "gemini-1.5-pro"

DISCLAIMER = (
    "LexGuard is an AI-powered awareness tool and does not constitute legal advice. "
    "Consult a licensed attorney in your jurisdiction for legally binding guidance."
)

# Initialize GenAI Client
# If the API key is not local or is the known leaked key, use Vertex AI.
api_key = settings.gemini_api_key
if api_key and not api_key.startswith("AIzaSyC3fIN4"):
    try:
        client = genai.Client(api_key=api_key)
        print("[LexGuard] Initialized Gemini Client with API Key")
    except Exception as e:
        print(f"[LexGuard] Failed to initialize Gemini Client with API Key: {e}. Falling back to Vertex AI.")
        client = genai.Client(
            vertexai=True,
            project=settings.gcp_project_id or "promptwars-community-x-ascen",
            location=settings.gcp_region or "us-central1"
        )
else:
    client = genai.Client(
        vertexai=True,
        project=settings.gcp_project_id or "promptwars-community-x-ascen",
        location=settings.gcp_region or "us-central1"
    )
    print("[LexGuard] Initialized Vertex AI Client with ADC")

def extract_json(text: str) -> dict | list:
    """Strip markdown fences and parse JSON from model output."""
    text = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    return json.loads(text)

async def call_model(model_name: str, system: str, prompt: str, max_tokens: int = 8192) -> str:
    """Call the generative AI model asynchronously with the modern google-genai SDK."""
    response = await client.aio.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            system_instruction=system,
            temperature=0.15,
            max_output_tokens=max_tokens
        )
    )
    return response.text


