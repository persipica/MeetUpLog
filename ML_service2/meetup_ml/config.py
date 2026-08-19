from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    tmdb_api_token: str | None = None
    tmdb_api_key: str | None = None
    kobis_api_key: str | None = None
    tmdb_base_url: str = "https://api.themoviedb.org/3"
    kobis_base_url: str = "https://www.kobis.or.kr/kobisopenapi/webservice/rest"
    meetup_data_dir: Path = Path("data")
    meetup_model_dir: Path = Path("models")
    meetup_db_path: Path = Path("data/meetup_test.db")
    # 기본값은 sqlite - .env를 깜빡 빼먹었을 때 "진짜처럼 보이는" MySQL
    # 접속정보로 조용히 연결을 시도하지 않고, 그냥 로컬 파일 DB로 동작한다.
    # 운영 배포에서는 .env로 meetup_db_backend=mysql을 명시적으로 켤 것.
    meetup_db_backend: str = "sqlite"
    meetup_mysql_host: str = "localhost"
    meetup_mysql_port: int = 3306
    # 아래 세 값은 일부러 기본값을 두지 않는다 - 이전에는
    # meetup_mysql_database="lostmatch3_dev"(다른 프로젝트에서 그대로 복사된
    # 것으로 보이는 이름), meetup_mysql_password="1234"가 코드에 커밋돼
    # 있어서, 실수로 .env 없이 배포해도 에러 없이 엉뚱하거나 취약한 DB로
    # 연결을 시도할 수 있었다. require_mysql()이 실제 필요한 시점에
    # 누락을 명확한 에러로 알린다.
    meetup_mysql_database: str | None = None
    meetup_mysql_user: str | None = None
    meetup_mysql_password: str | None = None
    meetup_request_interval_seconds: float = 0.25
    meetup_max_retries: int = 3
    meetup_model_name: str = "jhgan/ko-sroberta-multitask"
    meetup_use_embedding: bool = True
    hf_token: str | None = None
    # Large local correction models are opt-in for batch/evaluation jobs.
    # Synchronous use makes real-time chat requests take several seconds.
    meetup_use_typo_model: bool = False
    meetup_typo_model_name: str = "j5ng/et5-typos-corrector"
    meetup_use_spacer_model: bool = False
    meetup_realtime_heavy_correction: bool = False
    meetup_electra_spacer_dir: Path = Path("vendor/ElectraSpacer")
    meetup_correction_max_chars: int = 180

    def require_tmdb(self) -> str:
        credential = self.tmdb_api_token or self.tmdb_api_key
        if not credential:
            raise RuntimeError("TMDB_API_TOKEN 또는 TMDB_API_KEY 환경변수가 필요합니다. ml-service/.env에 추가하세요.")
        return credential.strip()

    def require_kobis(self) -> str:
        if not self.kobis_api_key:
            raise RuntimeError("KOBIS_API_KEY 환경변수가 필요합니다. ml-service/.env에 추가하세요.")
        return self.kobis_api_key

    def require_mysql(self) -> dict[str, str | int]:
        """MySQL 접속정보가 실제로 필요한 시점(meetup_db_backend=mysql로
        MySQLMeetupDatabase를 만들 때)에만 누락을 명확한 에러로 알린다."""
        missing = [
            name
            for name, value in (
                ("MEETUP_MYSQL_DATABASE", self.meetup_mysql_database),
                ("MEETUP_MYSQL_USER", self.meetup_mysql_user),
                ("MEETUP_MYSQL_PASSWORD", self.meetup_mysql_password),
            )
            if not value
        ]
        if missing:
            raise RuntimeError(
                f"{', '.join(missing)} 환경변수가 필요합니다 (meetup_db_backend=mysql). "
                "ml-service/.env 또는 서버 환경변수로 주입하세요."
            )
        return {
            "host": self.meetup_mysql_host,
            "port": self.meetup_mysql_port,
            "database": self.meetup_mysql_database,
            "user": self.meetup_mysql_user,
            "password": self.meetup_mysql_password,
        }


settings = Settings()
