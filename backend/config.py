import os
from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    # Gemini
    gemini_api_key: str = ""

    # GCP
    gcp_project_id: str = "promptwars-community-x-ascen"
    gcp_region: str = "us-central1"

    # Storage
    gcs_bucket_name: str = "lexguard-uploads-promptwars"

    # Document AI
    document_ai_processor_id: str = ""
    document_ai_location: str = "us"

    # Firebase
    firebase_service_account_path: str = "./firebase-service-account.json"

    # App
    app_env: str = "development"
    max_file_size_mb: int = 25
    max_pages: int = 150
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    # Pub/Sub
    pubsub_topic: str = "lexguard-pipeline-jobs"

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
