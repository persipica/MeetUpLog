const AiResultCard = ({ movies, onDetail }) => (
  <div className="ai-result-wrapper">
    <div className="ai-avatar">✦</div>
    <div className="ai-result-card">
      <div className="ai-result-header"><div><span className="ai-label">MEETUP AI</span><h3>우리 모임에 어울리는 영화를 찾았어요</h3></div><span className="ai-complete-badge">분석 완료</span></div>
      <p className="ai-summary">액션 선호와 공포 비선호를 반영하고 그룹의 러닝타임 조건을 함께 고려했어요.</p>
      <div className="ai-preference-chips"><span>⚡ 액션 선호</span><span>🚫 공포 제외</span><span>⏱ 러닝타임 고려</span></div>
      <div className="ai-movie-list">
        {movies.map((movie) => (
          <button type="button" className="ai-movie-item" key={`${movie.rank}-${movie.title}`} onClick={() => onDetail?.(movie)}>
            <span className="ai-rank">{String(movie.rank).padStart(2, '0')}</span>
            <div className="ai-movie-info"><strong>{movie.title}</strong><span>{movie.genres} · {movie.runtime}</span></div>
            <div className="ai-match-score"><strong>{movie.score}</strong><span>match</span></div>
          </button>
        ))}
      </div>
      <button type="button" className="ai-detail-button" onClick={() => onDetail?.(movies[0])}>추천 결과 자세히 보기<span>→</span></button>
    </div>
  </div>
)

export default AiResultCard
