import json
import re

import joblib
from .model_registry import register_model, list_models, latest_usable_events
from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from .feedback import feedback_readiness
from .chat_analysis import analyze_chat
from .collectors import (
    collect_kobis,
    collect_tmdb,
    search_tmdb_movie_sync,
)
from .config import settings
from .database import MeetupDatabase, MySQLMeetupDatabase
from .models import ModelBundle, evaluate
from .deployment import activate_model
from .recommender import recommend
from .semantic import SemanticPreferenceEngine
from .text_correction import KoreanTextCorrector
from .schemas import (
    ChatAnalyzeRequest,
    ChatMessage,
    ChatMessageCreate,
    GroupRecommendRequest,
    Preference,
    RecommendationEvent,
    RecommendationEventCreate,
    ScheduleHandoffRequest,
    ScheduleHandoffResponse,
)
from .storage import JsonStore

THEATER_INTENT_KEYWORDS = (
    "영화관",
    "극장",
    "현재 상영",
    "상영 중",
    "상영중",
    "개봉작",
    "cgv",
    "메가박스",
    "롯데시네마",
)


def detect_theater_intent(text: str) -> bool:
    """
    사용자 문장에 영화관 관람 의도가 있는지 확인합니다.

    예:
    - 영화관에서 볼 거야
    - 극장에서 볼 영화 추천해줘
    - 현재 상영 중인 영화 알려줘
    """
    normalized_text = re.sub(
        r"\s+",
        "",
        text.lower(),
    )

    return any(
        re.sub(r"\s+", "", keyword.lower())
        in normalized_text
        for keyword in THEATER_INTENT_KEYWORDS
    )

OTT_PROVIDER_IDS = {
    "넷플릭스": 8,
    "왓챠": 97,
    "디즈니+": 337,
    "웨이브": 356,
}

app = FastAPI(
    title="MeetupLog Recommendation API",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_methods=["*"],
    allow_headers=["*"],
)

store = JsonStore(settings.meetup_data_dir)

text_corrector = KoreanTextCorrector(
    hf_token=settings.hf_token,
    typo_model_name=settings.meetup_typo_model_name,
    spacer_dir=settings.meetup_electra_spacer_dir,
    use_typo_model=(
        settings.meetup_use_typo_model
        and settings.meetup_realtime_heavy_correction
    ),
    use_spacer_model=(
        settings.meetup_use_spacer_model
        and settings.meetup_realtime_heavy_correction
    ),
    max_chars=settings.meetup_correction_max_chars,
)

def _extract_tmdb_query(text: str) -> str | None:
    value = text.strip()

    patterns = [
        r"(.+?)\s*영화\s*(?:보고\s*싶|볼래|보자|추천|봤어|봤는데)",
        r"(.+?)\s*(?:보고\s*싶|볼래|보자|추천해줘|추천)",
    ]

    for pattern in patterns:
        match = re.search(
            pattern,
            value,
            re.IGNORECASE,
        )

        if match:
            candidate = match.group(1).strip(
                " ,.!?\"'"
            )

            if len(candidate) >= 2:
                return candidate

    return None





_correction_cache: dict[tuple[str, int, str], object] = {}


def _analyze_corrected(
    messages: list[ChatMessage],
    movies,
    room_id: str = "__direct__",
):
    corrected_messages: list[ChatMessage] = []
    corrections: list[tuple[str, str, str, str]] = []
    catalog_updated = False
    for message in messages:
        cache_key = (
            room_id,
            message.message_id or -1,
            message.text,
        )
        correction = _correction_cache.get(cache_key)
        if correction is None:
            correction = text_corrector.correct(message.text)
            _correction_cache[cache_key] = correction
        corrected_messages.append(
            message.model_copy(update={"text": correction.corrected})
        )
        corrections.append(
            (message.user_id, correction.corrected, correction.original, correction.backend)
        )
    for message in corrected_messages:
        text = message.text.strip()

        # 너무 짧거나 일반 잡담은 TMDB 검색하지 않음
        if len(text) < 2:
            continue

        # 이미 카탈로그 영화가 문장에 포함돼 있으면 검색 생략
        normalized_text = text.casefold()
        already_known = any(
            movie.title.casefold() in normalized_text
            or (
                movie.original_title
                and movie.original_title.casefold() in normalized_text
            )
            for movie in movies
        )

        if already_known:
            continue

        query = _extract_tmdb_query(text)

        if not query:
            continue

        try:
            tmdb_movie = search_tmdb_movie_sync(query)
        except Exception:
            tmdb_movie = None        

        if (
            tmdb_movie
            and tmdb_movie.tmdb_id
            and all(
                movie.tmdb_id != tmdb_movie.tmdb_id
                for movie in movies
            )
        ):
            movies.append(tmdb_movie)
            catalog_updated = True

    if catalog_updated:
        store.save_movies(movies)

    result = analyze_chat(
        ChatAnalyzeRequest(messages=corrected_messages),
        movies,
    )
    for analysis in result.analyses:
        correction = next(
            (
                item
                for item in reversed(corrections)
                if item[0] == analysis.user_id and item[1] == analysis.text
            ),
            None,
        )
        if correction and correction[1] != correction[2]:
            analysis.text = correction[2]
            analysis.corrected_from = analysis.corrected_from or correction[2]
            analysis.note = f"{correction[3]} 교정 후 분석 · {analysis.note}"
    return result

database = (
    MySQLMeetupDatabase(
        settings.meetup_mysql_host,
        settings.meetup_mysql_port,
        settings.meetup_mysql_database,
        settings.meetup_mysql_user,
        settings.meetup_mysql_password,
    )
    if settings.meetup_db_backend == "mysql"
    else MeetupDatabase(settings.meetup_db_path)
)

jobs: dict[str, dict] = {}
_bundle = None
_semantic_engine = SemanticPreferenceEngine(
    settings.meetup_model_name,
    use_embedding=settings.meetup_use_embedding,
    cache_dir=settings.meetup_model_dir / "semantic",
    precomputed_dir=settings.meetup_data_dir / "normalized",
)

training_state = {
    "running": False,
    "last_trained_usable_events": latest_usable_events(
        settings.meetup_model_dir
    ),
}
AUTO_RETRAIN_MIN_NEW_EVENTS = 500

def _load_bundle():
    global _bundle

    path = settings.meetup_model_dir / "current.joblib"

    if _bundle is None and path.exists():
        _bundle = joblib.load(path)

    return _bundle


def _learned_scores(movies, request):
    bundle = _load_bundle()

    semantic = _semantic_engine.score(
        movies,
        request.members,
    ).scores

    if (
        bundle is None
        or bundle.matrix is None
        or len(bundle.matrix) != len(movies)
    ):
        return semantic or None

    lookup: dict[str, int] = {}

    for index, movie in enumerate(movies):
        lookup[movie.internal_id.casefold()] = index
        lookup[movie.title.casefold()] = index

        if movie.original_title:
            lookup[movie.original_title.casefold()] = index

    result: dict[str, list[float]] = {}

    for member in request.members:
        seeds = [
            lookup[value.casefold()]
            for value in member.liked_movies
            if value.casefold() in lookup
        ]

        seed_scores = bundle.scores_for_seeds(seeds).tolist() if seeds else None
        semantic_scores = semantic.get(member.user_id)
        if seed_scores and semantic_scores:
            result[member.user_id] = [
                0.55 * seed + 0.45 * meaning
                for seed, meaning in zip(seed_scores, semantic_scores)
            ]
        elif seed_scores:
            result[member.user_id] = seed_scores
        elif semantic_scores:
            result[member.user_id] = semantic_scores

    return result or None


@app.exception_handler(RuntimeError)
async def runtime_error(_, exc: RuntimeError):
    from fastapi.responses import JSONResponse

    return JSONResponse(
        status_code=503,
        content={
            "error": {
                "code": "SERVICE_NOT_READY",
                "message": str(exc),
                "retryable": True,
            }
        },
    )


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "meetup-log-ml",
        "version": app.version,
    }


@app.get("/v1/version")
def version():
    return {
        "api": "v1",
        "model": ModelBundle.version,
        "data": f"movies-{len(store.load_movies())}",
    }


async def _collect(
    job_id: str,
    source: str,
    pages: int,
    incremental: bool,
):
    jobs[job_id] = {"status": "RUNNING"}

    try:
        if source == "tmdb":
            result = await collect_tmdb(
                store,
                pages,
                incremental,
            )
        else:
            result = await collect_kobis(
                store,
                pages,
            )

        jobs[job_id] = {
            "status": "SUCCEEDED",
            "count": len(result),
        }

    except Exception as exc:
        jobs[job_id] = {
            "status": "FAILED",
            "error": str(exc),
        }


@app.post("/v1/collections", status_code=202)
async def start_collection(
    source: str,
    background: BackgroundTasks,
    pages: int = 1,
    incremental: bool = False,
):
    if source not in {"tmdb", "kobis"}:
        raise HTTPException(
            status_code=422,
            detail="source는 tmdb 또는 kobis여야 합니다.",
        )

    job_id = f"collect-{source}-{len(jobs) + 1}"

    background.add_task(
        _collect,
        job_id,
        source,
        pages,
        incremental,
    )

    return {
        "job_id": job_id,
        "status": "QUEUED",
    }


@app.get("/v1/jobs/{job_id}")
def job(job_id: str):
    if job_id not in jobs:
        raise HTTPException(
            status_code=404,
            detail="작업을 찾을 수 없습니다.",
        )

    return jobs[job_id]

@app.post("/v1/training")
def train():
    global _bundle
    print("[TRAIN] 1. movies loading", flush=True)

    movies = [
        movie
        for movie in store.load_movies()
        if movie.recommendation_eligible
    ]

    print(f"[TRAIN] 2. movies loaded: {len(movies)}", flush=True)

    bundle = ModelBundle(
        settings.meetup_model_name
        if settings.meetup_use_embedding
        else None
    )

    print("[TRAIN] 3. bundle.fit start", flush=True)
    report = bundle.fit(movies)
    print("[TRAIN] 4. bundle.fit complete", flush=True)

    settings.meetup_model_dir.mkdir(
        parents=True,
        exist_ok=True,
    )

    print("[TRAIN] 5. saving model", flush=True)

    print("[TRAIN] 6. candidate ready", flush=True)
    print("[TRAIN] 7. evaluation start", flush=True)

    metrics = evaluate(bundle, movies)

    print("[TRAIN] 8. evaluation complete", flush=True)

    output = {
        **report,
        "metrics": metrics,
    }

    # 평가가 끝난 후보만 원자적으로 활성화한다. 로드/검증 실패 시
    # previous.joblib에서 기존 모델을 즉시 복원한다.
    _bundle = activate_model(bundle, settings.meetup_model_dir)

    (
        settings.meetup_model_dir
        / "evaluation.json"
    ).write_text(
        json.dumps(
            output,
            indent=2,
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    current_feedback = feedback_readiness(
        database.recommendation_events()
    )

    registry_entry = register_model(
        settings.meetup_model_dir,
        ModelBundle.version,
        output,
        usable_events=current_feedback["usable_events"],
    )
    

    print("[TRAIN] 9. evaluation.json saved", flush=True)

    return output

def _run_auto_training():
    if training_state["running"]:
        return

    training_state["running"] = True

    try:
        train()
    finally:
        training_state["running"] = False

@app.get("/v1/evaluation")
def evaluation():
    path = (
        settings.meetup_model_dir
        / "evaluation.json"
    )

    if path.exists():
        return json.loads(
            path.read_text(encoding="utf-8")
        )

    return {
        "status": "NOT_EVALUATED",
    }

@app.get("/v1/models")
def models_registry():
    return {
        "models": list_models(
            settings.meetup_model_dir
        )
    }

def _normalize_provider_name(value: str) -> str:
    """
    OTT 제공자 이름을 비교하기 쉽게 정규화한다.

    예:
    - "Disney Plus" -> "disneyplus"
    - "Apple TV Plus" -> "appletvplus"
    - "쿠팡 플레이" -> "쿠팡플레이"
    """
    return "".join(
        character
        for character in value.casefold()
        if character.isalnum()
    )


OTT_PROVIDER_ALIASES = {
    "넷플릭스": {
        "넷플릭스",
        "넷플",
        "netflix",
    },
    "티빙": {
        "티빙",
        "tving",
    },
    "웨이브": {
        "웨이브",
        "wavve",
    },
    "디즈니+": {
        "디즈니+",
        "디즈니플러스",
        "디플",
        "disney+",
        "disneyplus",
    },
    "왓챠": {
        "왓챠",
        "watcha",
    },
    "쿠팡플레이": {
        "쿠팡플레이",
        "쿠플",
        "coupangplay",
    },
    "Apple TV+": {
        "애플티비",
        "애플tv",
        "애플티비플러스",
        "appletv",
        "appletv+",
        "appletvplus",
    },
}


def _provider_ids_for_platforms(
    movies,
    platforms: list[str],
) -> set[int]:
    """
    사용자가 말한 OTT 이름을 현재 영화 데이터에 들어 있는
    TMDB provider_id로 변환한다.

    provider ID를 코드에 고정하지 않고, movies.runtime.json 또는
    movies.json의 실제 provider 데이터를 기준으로 찾는다.
    """
    if not platforms:
        return set()

    requested_names: set[str] = set()

    for platform in platforms:
        platform_aliases = OTT_PROVIDER_ALIASES.get(
            platform,
            {platform},
        )

        requested_names.update(
            _normalize_provider_name(alias)
            for alias in platform_aliases
        )

    provider_ids: set[int] = set()

    for movie in movies:
        for provider in movie.providers:
            provider_name = _normalize_provider_name(
                provider.name
            )

            if provider_name in requested_names:
                provider_ids.add(
                    provider.provider_id
                )

    return provider_ids


def _apply_watch_preferences(
    request: GroupRecommendRequest,
    movies,
) -> None:
    """
    채팅 분석 결과에 저장된 OTT 및 영화관 조건을
    실제 추천 요청 필터에 반영한다.
    """
    requested_platforms = list(
        dict.fromkeys(
            platform
            for member in request.members
            for platform in member.ott_platforms
        )
    )

    detected_provider_ids = (
        _provider_ids_for_platforms(
            movies,
            requested_platforms,
        )
    )

    if detected_provider_ids:
        existing_provider_ids = set(
            request.allowed_providers
        )

        request.allowed_providers = sorted(
            existing_provider_ids
            | detected_provider_ids
        )

    strict_ott_requested = any(
        member.ott_strict
        for member in request.members
    )

    if strict_ott_requested:
        request.include_unknown_watch_path = False

    theater_requested = any(
        member.prefers_theater
        for member in request.members
    )

    if theater_requested:
        request.require_now_playing = True


@app.post("/v1/recommendations/group")
def group_recommendation(
    request: GroupRecommendRequest,
):
    # 현재 채팅방의 최근 사용자 메시지를 가져온다.
    room_messages = [
        message
        for message in database.messages(
            request.room_id
        )
        if message.user_id != "AI"
    ][-20:]

    # 최근 채팅에서 영화관 관람 의도가 감지되면
    # 현재 상영 중인 영화만 추천하도록 설정한다.
    request.require_now_playing = (
        request.require_now_playing
        or any(
            detect_theater_intent(
                message.text
            )
            for message in room_messages
        )
    )

    movies = [
        movie
        for movie in store.load_movies()
        if movie.recommendation_eligible
    ]

    # 분석된 OTT와 영화관 관람 조건을
    # 실제 추천 요청에 연결한다.
    _apply_watch_preferences(
        request,
        movies,
    )

    result = recommend(
        movies,
        request,
        learned_scores=_learned_scores(
            movies,
            request,
        ),
    )

    database.save_recommendations(
        request.room_id,
        request.round_id,
        result.recommendations,
    )

    return result


@app.post(
    "/v1/recommendation-events",
    response_model=RecommendationEvent,
)


def save_recommendation_event(
    event: RecommendationEventCreate,
    background: BackgroundTasks,
):
    if event.event_type == "SELECT":
        existing_selection = next(
            (
                item
                for item in reversed(database.recommendation_events())
                if item.room_id == event.room_id
                and item.event_type == "SELECT"
            ),
            None,
        )
        if existing_selection:
            if existing_selection.movie_id == event.movie_id:
                return existing_selection
            raise HTTPException(
                status_code=409,
                detail="이미 확정된 영화는 변경할 수 없습니다.",
            )

    saved = database.save_recommendation_event(
        event
    )

    events = database.recommendation_events()
    readiness = feedback_readiness(events)

    if (
        readiness["ready"]
        and not training_state["running"]
        and readiness["usable_events"]
            >= training_state["last_trained_usable_events"]
            + AUTO_RETRAIN_MIN_NEW_EVENTS
    ):
        training_state["last_trained_usable_events"] = (
            readiness["usable_events"]
        )

        background.add_task(
            _run_auto_training
        )

    return saved


@app.get(
    "/v1/recommendation-events",
    response_model=list[RecommendationEvent],
)
def list_recommendation_events(
    round_id: str | None = None,
):
    return database.recommendation_events(
        round_id
    )

@app.get("/v1/feedback/readiness")
def feedback_status():
    events = database.recommendation_events()
    return feedback_readiness(events)

@app.get("/v1/training/status")
def training_status():
    readiness = feedback_readiness(
        database.recommendation_events()
    )

    return {
        "running": training_state["running"],
        "last_trained_usable_events": (
            training_state["last_trained_usable_events"]
        ),
        "usable_events": readiness["usable_events"],
        "ready": readiness["ready"],
        "next_auto_retrain_at": max(
            1000,
            training_state["last_trained_usable_events"]
            + AUTO_RETRAIN_MIN_NEW_EVENTS,
        ),
    }

@app.post("/v1/chat/analyze")
def chat_analysis(
    request: ChatAnalyzeRequest,
):
    user_messages = [
        message
        for message in request.messages
        if message.user_id != "AI"
    ]

    return _analyze_corrected(
        user_messages,
        store.load_movies(),
    )


@app.get("/v1/correction/status")
def correction_status():
    return text_corrector.status()


def _merge_preferences(
    current: list[Preference],
    updates: list[Preference],
) -> list[Preference]:
    merged = {
        member.user_id:
            member.model_copy(deep=True)
        for member in current
    }

    dictionary_pairs = [
        (
            "liked_genres",
            "disliked_genres",
        ),
        (
            "disliked_genres",
            "liked_genres",
        ),
        (
            "liked_topics",
            "disliked_topics",
        ),
        (
            "disliked_topics",
            "liked_topics",
        ),
        (
            "liked_brands",
            "disliked_brands",
        ),
        (
            "disliked_brands",
            "liked_brands",
        ),
    ]

    list_fields = [
        "liked_movies",
        "direct_movies",
        "seen_movies",
        "rewatch_allowed_movies",
        "disliked_movies",
        "liked_people",
        "disliked_people",
        "countries",
        "excluded_countries",
        "languages",
        "certifications",
        "allowed_providers",
        "allowed_provider_types",
        "ott_platforms",
        "hard_exclusions",
        "evidence_message_ids",
    ]

    scalar_fields = [
        "max_runtime",
        "min_runtime",
        "min_year",
        "max_year",
    ]

    # False 기본값으로 기존 True를 덮어쓰면 안 되는 필드다.
    positive_boolean_fields = [
        "prefers_theater",
        "ott_strict",
    ]

    for update in updates:
        target = merged.setdefault(
            update.user_id,
            Preference(
                user_id=update.user_id
            ),
        )

        for field, opposite in dictionary_pairs:
            values = getattr(
                update,
                field,
            )

            if not values:
                continue

            getattr(
                target,
                field,
            ).update(values)

            for key in values:
                getattr(
                    target,
                    opposite,
                ).pop(
                    key,
                    None,
                )

        for field in list_fields:
            values = getattr(
                update,
                field,
            )

            if not values:
                continue

            existing_values = getattr(
                target,
                field,
            )

            setattr(
                target,
                field,
                list(
                    dict.fromkeys(
                        [
                            *existing_values,
                            *values,
                        ]
                    )
                ),
            )

        for field in scalar_fields:
            value = getattr(
                update,
                field,
            )

            if value is not None:
                setattr(
                    target,
                    field,
                    value,
                )

        # 새 분석 결과가 True일 때만 기존 상태를 True로 변경한다.
        # 새 메시지의 기본값 False가 기존 True를 지우지 않게 한다.
        for field in positive_boolean_fields:
            if getattr(
                update,
                field,
                False,
            ):
                setattr(
                    target,
                    field,
                    True,
                )

        target.confidence = (
            update.confidence
        )

    return list(
        merged.values()
    )


def _room_analysis(room_id: str):
    room_movies = store.load_movies()
    movie_titles = {
        movie.internal_id: movie.title
        for movie in room_movies
    }
    messages = database.messages(
        room_id
    )

    if not messages:
        return {
            "messages": [],
            "members": [],
            "analyses": [],
            "recommended_movie_ids":
                database.recommended_movie_ids(
                    room_id
                ),
            "movie_titles": movie_titles,
            "analysis": {
                "mode": "INCREMENTAL",
                "processed": 0,
                "last_message_id": 0,
            },
        }

    checkpoint = (
        database.analysis_checkpoint(
            room_id
        )
    )

    pending = (
        database.messages_after(
            room_id,
            checkpoint,
        )
    )

    members = database.preferences(
        room_id
    )

    analyses = []
    processed_user_messages = 0

    if pending:
        context = (
            database.context_messages(
                room_id,
                checkpoint,
                limit=200,
            )
            if checkpoint
            else []
        )

        # AI가 생성한 추천 안내 메시지는
        # 사용자 취향 분석 대상에서 제외한다.
        selected = {
            message.message_id: message
            for message in [
                *context,
                *pending,
            ]
            if (
                message.message_id
                is not None
                and message.user_id != "AI"
            )
        }

        analysis_input = [
            selected[key]
            for key in sorted(
                selected
            )
        ][-200:]
        print(
            "ANALYSIS INPUT =",
            [
                {
                    "message_id": message.message_id,
                    "user_id": message.user_id,
                    "text": message.text,
                }
                for message in analysis_input
            ],
        )

        pending_user_messages = [
            message
            for message in pending
            if message.user_id != "AI"
        ]

        processed_user_messages = len(
            pending_user_messages
        )
        print("pending =", len(pending))
        print("pending users =", len(pending_user_messages))

        print("analysis_input =", len(analysis_input))
        if analysis_input:
            print("CALL analyze_chat")
            result = _analyze_corrected(
                analysis_input,
                room_movies,
                room_id,
            )
            print("result = ", result)
            

            
            print(
                "ANALYZED MEMBERS =",
                [
                    member.model_dump()
                    for member in result.members
                ],
            )

            # 최근 대화 전체를 다시 계산한 결과로 스냅샷을 교체한다.
            # 과거 오탐을 단순 누적 병합하면 수정 후에도 잘못된 영화/OTT
            # 성향이 영구히 남으므로, 동일 문맥의 재분석 결과를 진실값으로 쓴다.
            members = result.members

            database.save_preferences(
                room_id,
                members,
            )

            if processed_user_messages > 0:
                analyses = result.analyses[
                    -processed_user_messages:
                ]

        # AI 메시지만 pending에 있어도
        # 체크포인트는 반드시 전진시킨다.
        checkpoint = max(
            message.message_id or 0
            for message in pending
        )

        database.save_analysis_checkpoint(
            room_id,
            checkpoint,
        )

    selected_event = next(
        (
            item
            for item in reversed(database.recommendation_events())
            if item.room_id == room_id
            and item.event_type == "SELECT"
        ),
        None,
    )

    return {
        "members": [
            member.model_dump()
            for member in members
        ],
        "analyses": [
            item.model_dump()
            for item in analyses
        ],
        "messages": [
            message.model_dump()
            for message in messages
        ],
        "recommended_movie_ids":
            database.recommended_movie_ids(
                room_id
            ),
        "movie_titles": movie_titles,
        "selected_movie_id": (
            selected_event.movie_id
            if selected_event
            else None
        ),
        "analysis": {
            "mode": "INCREMENTAL",
            "processed":
                processed_user_messages,
            "last_message_id":
                checkpoint,
        },
    }


@app.post("/v1/chat/messages")
def save_chat_message(
    request: ChatMessageCreate,
):
    database.add_message(
        request.room_id,
        request.user_id,
        request.text,
        request.reply_to_message_id,
    )

    return _room_analysis(
        request.room_id
    )


@app.get("/v1/chat/rooms/{room_id}")
def room_chat(room_id: str):
    return _room_analysis(
        room_id
    )


@app.delete("/v1/chat/rooms/{room_id}")
def reset_room_chat(room_id: str):
    database.reset_room(
        room_id
    )

    for cache_key in [
        key for key in _correction_cache
        if key[0] == room_id
    ]:
        _correction_cache.pop(cache_key, None)

    return {
        "room_id": room_id,
        "status": "RESET",
    }


@app.post("/v1/recommendations/user")
def user_recommendation(
    request: GroupRecommendRequest,
):
    if len(request.members) != 1:
        raise HTTPException(
            status_code=422,
            detail=(
                "단일 사용자 API에는 "
                "members가 1명이어야 합니다."
            ),
        )

    # 채팅방의 최근 사용자 메시지를 가져온다.
    room_messages = [
        message
        for message in database.messages(
            request.room_id
        )
        if message.user_id != "AI"
    ][-20:]

    # 사용자가 직접 require_now_playing=True를 보냈거나,
    # 최근 채팅에서 영화관 관람 의도가 감지되면
    # 현재 상영작만 추천한다.
    request.require_now_playing = (
        request.require_now_playing
        or any(
            detect_theater_intent(
                message.text
            )
            for message in room_messages
        )
    )

    movies = [
        movie
        for movie in store.load_movies()
        if movie.recommendation_eligible
    ]

    # 단일 사용자 추천에도 OTT와 영화관 조건을 반영한다.
    _apply_watch_preferences(
        request,
        movies,
    )

    return recommend(
        movies,
        request,
        learned_scores=_learned_scores(
            movies,
            request,
        ),
    )


@app.get(
    "/v1/movies/{movie_id}/watch-providers"
)
def providers(movie_id: str):
    movie = next(
        (
            item
            for item in store.load_movies()
            if (
                item.internal_id == movie_id
                or str(item.tmdb_id)
                == movie_id
            )
        ),
        None,
    )

    if not movie:
        raise HTTPException(
            status_code=404,
            detail="영화를 찾을 수 없습니다.",
        )

    return {
        "movie_id": movie.internal_id,
        "region": "KR",
        "status": (
            "AVAILABLE"
            if (
                movie.providers
                or movie.is_now_playing
            )
            else "UNKNOWN"
        ),
        "providers": movie.providers,
        "link": movie.provider_link,
        "watch_path": movie.watch_path,
        "is_now_playing":
            movie.is_now_playing,
        "cinema_sources":
            movie.cinema_sources,
        "attribution": (
            "TMDB watch provider data "
            "powered by JustWatch"
        ),
    }


@app.post(
    "/v1/schedule-handoffs",
    response_model=ScheduleHandoffResponse,
)
def schedule_handoff(
    request: ScheduleHandoffRequest,
):
    movie = next(
        (
            item
            for item in store.load_movies()
            if (
                item.internal_id
                == request.selected_movie_id
            )
        ),
        None,
    )

    if not movie:
        raise HTTPException(
            status_code=404,
            detail=(
                "선택한 영화를 "
                "찾을 수 없습니다."
            ),
        )

    return ScheduleHandoffResponse(
        room_id=request.room_id,
        round_id=request.round_id,
        selected_movie_id=movie.internal_id,
        selected_movie_title=movie.title,
        participant_ids=list(
            dict.fromkeys(
                request.participant_ids
            )
        ),
    )
