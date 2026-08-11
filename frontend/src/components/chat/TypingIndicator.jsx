const TypingIndicator = ({ typingUsers = [], aiAnalyzing = false }) => {
  const userNames = typingUsers.map((user) => `${user.nickname}님`)

  const getStatusText = () => {
    if (userNames.length === 0 && !aiAnalyzing) return ''
    if (userNames.length === 0 && aiAnalyzing) return 'AI가 대화를 분석 중입니다'
    if (userNames.length > 0 && !aiAnalyzing) return `${userNames.join(', ')} 입력 중입니다`
    return `${userNames.join(', ')} 입력 중 · AI가 분석 중입니다`
  }

  const visible = typingUsers.length > 0 || aiAnalyzing

  return (
    <div className={`typing-indicator ${visible ? 'visible' : ''}`} aria-live="polite">
      <div className="typing-indicator-inner">
        {visible && <><div className="typing-dots" aria-hidden="true"><span /><span /><span /></div><span className="typing-text">{getStatusText()}</span></>}
      </div>
    </div>
  )
}

export default TypingIndicator
