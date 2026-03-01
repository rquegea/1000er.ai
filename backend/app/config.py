from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    database_url: str = ""
    mvp_tenant_id: str = ""
    mvp_user_id: str = ""
    mvp_store_id: str = ""
    allowed_origins: str = "http://localhost:3000"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"


settings = Settings()
