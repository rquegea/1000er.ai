from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_service_key: str = ""
    supabase_jwt_secret: str = ""
    openai_api_key: str = ""
    gemini_api_key: str = ""
    database_url: str = ""
    allowed_origins: str = "http://localhost:3000"

    # --- Vision V2 Pipeline ---
    vision_pipeline: str = "v2"
    roboflow_api_key: str = ""
    roboflow_model_url: str = "https://infer.roboflow.com/grounding_dino/infer"
    detection_text_prompt: str = "product . bottle . box . can . package . bag . carton . food"
    detection_confidence_threshold: float = 0.15
    detection_nms_iou_threshold: float = 0.45
    mosaic_cell_size: int = 150
    mosaic_columns: int = 8
    mosaic_padding: int = 4
    mosaic_max_crops: int = 80
    gemini_v2_temperature: float = 0.2
    debug_detection: bool = False

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",")]

    class Config:
        env_file = ".env"
        extra = "ignore"


settings = Settings()
