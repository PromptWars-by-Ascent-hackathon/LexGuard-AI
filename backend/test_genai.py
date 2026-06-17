import os
from google import genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")
print(f"Loaded Key: {api_key[:10]}...")

try:
    client = genai.Client(api_key=api_key)
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Hello, explain what is dynamic programming in 1 sentence."
    )
    print("Success!")
    print(response.text)
except Exception as e:
    print(f"Error calling Gemini: {e}")
