from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    SECRET_KEY: str = "taskflow-super-secret-key-12345"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440


settings = Settings()
