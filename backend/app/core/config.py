import logging
import secrets

from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


class Settings(BaseSettings):
    # Clave de firma JWT. NUNCA debe quemarse en el código: en producción se
    # inyecta por variable de entorno (SECRET_KEY) o backend/.env. Si queda
    # vacía, se genera una clave efímera (ver model_post_init).
    SECRET_KEY: str = ""
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    # Contraseña inicial al crear usuarios (deben cambiarla desde el perfil)
    DEFAULT_NEW_USER_PASSWORD: str = "taskflow123"

    def model_post_init(self, __context: object) -> None:
        # Fail-safe: si no se definió SECRET_KEY, generamos una aleatoria en vez
        # de usar un valor conocido. Es segura pero efímera: los tokens JWT se
        # invalidan en cada reinicio del proceso. Definí SECRET_KEY en el entorno
        # para producción y para que las sesiones sobrevivan a los reinicios.
        if not self.SECRET_KEY:
            object.__setattr__(self, "SECRET_KEY", secrets.token_urlsafe(48))
            logger.warning(
                "SECRET_KEY no definida en el entorno; se generó una clave "
                "efímera. Los tokens JWT se invalidarán en cada reinicio. "
                "Definí SECRET_KEY en backend/.env (o variables de entorno) "
                "antes de desplegar a producción."
            )


settings = Settings()
