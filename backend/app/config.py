from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    database_url: str = ""
    allowed_origins: str = "http://localhost:3000"

    # --- Vision Pipeline ---
    vision_pipeline: str = "v1"  # "v1" | "v3" | "v4"
    gemini_temperature: float = 0.2
    gemini_count_model: str = "gemini-2.5-flash"
    gemini_classify_model: str = "gemini-2.5-flash"
    gemini_count_temperature: float = 0.1
    gemini_classify_temperature: float = 0.2
    gemini_detection_temperature: float = 0.5  # Google recommended for bbox

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
