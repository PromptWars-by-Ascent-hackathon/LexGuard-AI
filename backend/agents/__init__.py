import google.generativeai as genai
from google.generativeai.types import HarmCategory, HarmBlockThreshold
from config import settings
import json, re

# Configure Gemini API key
genai.configure(api_key=settings.gemini_api_key)

FLASH_MODEL = "gemini-1.5-flash"
PRO_MODEL   = "gemini-1.5-pro"

DISCLAIMER = (
    "LexGuard is an AI-powered awareness tool and does not constitute legal advice. "
    "Consult a licensed attorney in your jurisdiction for legally binding guidance."
)

def extract_json(text: str) -> dict | list:
    """Strip markdown fences and parse JSON from model output."""
    text = re.sub(r"```(?:json)?", "", text).strip().rstrip("`").strip()
    return json.loads(text)

def call_model(model_name: str, system: str, prompt: str, max_tokens: int = 8192) -> str:
    """Call the generative AI model with the standard google.generativeai SDK."""
    model = genai.GenerativeModel(
        model_name=model_name,
        system_instruction=system,
        generation_config={"temperature": 0.15, "max_output_tokens": max_tokens}
    )
    response = model.generate_content(prompt)
    return response.text
