import logging
import secrets

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # development | production | test
    # En production faltan SECRET_KEY / SIGAO_API_KEY → la app no arranca.
    ENVIRONMENT: str = "development"

    # Clave de firma JWT. NUNCA debe quemarse en el código: en producción se
    # inyecta por variable de entorno (SECRET_KEY) o backend/.env. Si queda
    # vacía fuera de production, se genera una clave efímera (ver model_post_init).
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    # Contraseña inicial al crear usuarios por admin (deben cambiarla: must_change_password)
    DEFAULT_NEW_USER_PASSWORD: str = "taskflow123"
    # API key compartida con SIGAO BFF (integración Proyectos Estratégicos)
    SIGAO_API_KEY: str = ""

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT.strip().lower() == "production"

    def model_post_init(self, __context: object) -> None:
        if not self.SECRET_KEY:
            if self.is_production:
                raise ValueError(
                    "SECRET_KEY is required when ENVIRONMENT=production. "
                    "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
                )
            # Fail-safe en development/test: aleatoria efímera (mejor que una conocida).
            object.__setattr__(self, "SECRET_KEY", secrets.token_urlsafe(48))
            logger.warning(
                "SECRET_KEY no definida en el entorno; se generó una clave "
                "efímera. Los tokens JWT se invalidarán en cada reinicio. "
                "Definí SECRET_KEY en backend/.env (o variables de entorno) "
                "antes de desplegar a producción."
            )

        if self.is_production and not self.SIGAO_API_KEY:
            raise ValueError(
                "SIGAO_API_KEY is required when ENVIRONMENT=production. "
                "Set it in the environment (must match SIGAO's TASKFLOW_SIGAO_API_KEY)."
            )


settings = Settings()
