import {
  useState,
} from 'react'

import {
  SparklesIcon,
} from '../common/Icons'

const AiResultCard = ({
  movies,
  onDetail,
  onConfirm,
}) => {
  const topMovies =
    movies.slice(0, 3)

  const [
    confirmedRank,
    setConfirmedRank,
  ] = useState(null)

  const confirmMovie = (
    movie,
  ) => {
    setConfirmedRank(
      movie.rank,
    )

    onConfirm?.(movie)
  }

  return (
    <div className="ai-result-wrapper">
      <div className="ai-avatar">
        <SparklesIcon />
      </div>

      <article className="ai-result-card ai-wireframe-card">
        <div className="ai-wireframe-tabs">
          <span>
            AI 영화 추천 카드
          </span>

          <span
            className={
              confirmedRank
                ? 'completed'
                : ''
            }
          >
            {confirmedRank
              ? '추천 확정 완료'
              : '구성원 의견 수집 중'}
          </span>
        </div>

        <div className="ai-wireframe-summary">
          <span
            className="ai-summary-icon"
            aria-hidden="true"
          >
            💬
          </span>

          <p>
            <strong>
              대화 요약
            </strong>

            <span>
              액션을 선호하고 공포 장르는 제외하며, 모임에서
              가볍게 볼 수 있는 러닝타임을 함께 고려했어요.
            </span>
          </p>
        </div>

        <div className="ai-wireframe-grid">
          {topMovies.map(
            (movie) => {
              const confirmed =
                confirmedRank ===
                movie.rank

              return (
                <article
                  className={`ai-candidate-card ${
                    confirmed
                      ? 'confirmed'
                      : ''
                  }`}
                  key={`${movie.rank}-${movie.title}`}
                >
                  <header className="ai-candidate-heading">
                    <div>
                      <strong>
                        {movie.title}
                      </strong>

                      <span>
                        {movie.genres} · {movie.runtime}
                      </span>
                    </div>

                    <span className="ai-candidate-score">
                      <strong>
                        {movie.score}
                      </strong>

                      <small>
                        match
                      </small>
                    </span>
                  </header>

                  <button
                    type="button"
                    className="ai-candidate-poster"
                    onClick={() =>
                      onDetail?.(
                        movie,
                      )
                    }
                    aria-label={`${movie.title} 상세 정보 보기`}
                  >
                    <span className="ai-candidate-rank">
                      TOP {movie.rank}
                    </span>

                    <span
                      className="ai-poster-icon"
                      aria-hidden="true"
                    >
                      🎬
                    </span>

                    <span>
                      영화 포스터
                    </span>
                  </button>

                  <div className="ai-candidate-actions">
                    <button
                      type="button"
                      onClick={() =>
                        onDetail?.(
                          movie,
                        )
                      }
                    >
                      상세 정보
                    </button>

                    <button
                      type="button"
                      className="confirm"
                      aria-pressed={
                        confirmed
                      }
                      onClick={() =>
                        confirmMovie(
                          movie,
                        )
                      }
                    >
                      {confirmed
                        ? '확정됨'
                        : '확정'}
                    </button>
                  </div>
                </article>
              )
            },
          )}
        </div>
      </article>
    </div>
  )
}

export default AiResultCard
