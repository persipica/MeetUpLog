"""timezone-aware UTC 시각 헬퍼."""

from __future__ import annotations

from datetime import datetime, timezone


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def to_aware_utc(dt: datetime) -> datetime:
    """naive datetime이 들어오면 UTC로 간주해 tz를 붙인다. 이미 aware면 UTC로 변환."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)
