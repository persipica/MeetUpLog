"""
MeetupLog AI Service - 시간 유틸
==================================
Python 3.12+에서 datetime.utcnow()는 지원 중단(deprecation) 경고 대상이며,
naive datetime은 다른 서비스(Spring Boot)에서 넘어온 timezone-aware
timestamp와 섞이면 비교/뺄셈 시 오류가 날 수 있다.

이 모듈은 "항상 timezone-aware UTC"로 통일하는 두 헬퍼만 제공한다.
프로젝트 전체(모델 기본값, NLP 시간가중치, 데모 스크립트)에서
datetime.utcnow() 대신 이 모듈의 utc_now()를 사용한다.
"""

from datetime import datetime, timezone


def utc_now() -> datetime:
    """타임존 인식 UTC 현재 시각."""
    return datetime.now(timezone.utc)


def to_aware_utc(dt: datetime) -> datetime:
    """naive datetime이 들어오면 UTC로 간주해 tzinfo를 붙인다.
    이미 aware면 그대로 반환한다.

    API로 외부(Spring Boot 등)에서 넘어온 타임스탬프가 naive일 수도, aware일
    수도 있기 때문에 시간 가중치 계산 등 뺄셈 연산 전에 항상 이 함수를 거친다.
    """
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt
