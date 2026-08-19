import { useState } from 'react'

import { searchFriendUsers, sendFriendRequest } from '../../api/socialApi'
import { SearchIcon, UserPlusIcon } from '../common/Icons'
import UserAvatar from '../common/UserAvatar'

const relationshipCopy = {
  FRIEND: '이미 친구',
  REQUEST_SENT: '요청 전송됨',
  REQUEST_RECEIVED: '받은 요청 확인',
  BLOCKED: '요청 불가',
}

const relationshipHint = {
  FRIEND: '이미 친구 목록에 있는 사용자예요.',
  REQUEST_SENT: '상대방의 수락을 기다리고 있어요.',
  REQUEST_RECEIVED: '알림에서 받은 요청을 확인해주세요.',
  BLOCKED: '현재 친구 요청을 보낼 수 없어요.',
}

const FriendAddWorkspace = ({ onBack, accessToken, onRequestSent }) => {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [feedback, setFeedback] = useState(null)
  const [sendingId, setSendingId] = useState(null)

  const handleSearch = async (event) => {
    event?.preventDefault()
    const keyword = query.trim()
    if (keyword.length < 2) {
      setFeedback({ type: 'error', message: '닉네임 또는 이메일을 2자 이상 입력해주세요.' })
      return
    }

    setLoading(true)
    setFeedback(null)
    try {
      const users = await searchFriendUsers(accessToken, keyword)
      setResults(users)
      if (users.length === 0) {
        setFeedback({ type: 'empty', message: '일치하는 사용자를 찾지 못했습니다.' })
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setLoading(false)
    }
  }

  const handleRequest = async (user) => {
    setSendingId(user.id)
    setFeedback(null)
    try {
      await sendFriendRequest(accessToken, user.id)
      setResults((previous) => previous.map((item) => (
        item.id === user.id ? { ...item, relationship: 'REQUEST_SENT' } : item
      )))
      setFeedback({ type: 'success', message: `${user.nickname}님에게 친구 요청을 보냈습니다.` })
      onRequestSent?.(user)
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
    } finally {
      setSendingId(null)
    }
  }

  return (
    <main className="friend-add-workspace">
      <button type="button" className="workspace-mobile-back" onClick={onBack}>← 돌아가기</button>

      <header className="workspace-section-header">
        <div>
          <span>ADD FRIEND</span>
          <h1>친구 추가</h1>
          <p>닉네임이나 이메일로 사용자를 찾아 친구 요청을 보낼 수 있어요.</p>
        </div>
      </header>

      <section className="friend-add-panel liquid-menu-surface">
        <div className="friend-add-panel-heading">
          <div className="friend-add-panel-icon"><UserPlusIcon /></div>
          <div>
            <strong>MeetupLog 사용자 찾기</strong>
            <span>정확한 닉네임 또는 가입 이메일로 검색해보세요.</span>
          </div>
        </div>

        <form className="friend-add-search liquid-menu-surface" onSubmit={handleSearch}>
          <label htmlFor="friendSearch">
            <span><SearchIcon /></span>
            <input id="friendSearch" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="닉네임 또는 이메일 검색" autoComplete="off" />
          </label>
          <button type="submit" disabled={loading || query.trim().length < 2}>
            {loading ? <><i className="friend-search-spinner" /> 검색 중</> : '검색'}
          </button>
        </form>

        {feedback && (
          <p className={`friend-add-feedback ${feedback.type}`} role="status">
            <i>{feedback.type === 'success' ? '✓' : feedback.type === 'error' ? '!' : '⌕'}</i>
            <span>{feedback.message}</span>
          </p>
        )}

        {results.length > 0 ? (
          <section className="friend-search-results" aria-label="친구 검색 결과">
            <header className="friend-search-results-header">
              <div><span>SEARCH RESULTS</span><strong>검색 결과</strong></div>
              <small>{results.length}명</small>
            </header>

            <div className="friend-search-result-list">
              {results.map((user, index) => {
                const canRequest = user.relationship === 'NONE'
                return (
                  <article className={`friend-search-result relationship-${(user.relationship ?? 'NONE').toLowerCase()}`} style={{ '--result-order': index }} key={user.id}>
                    <div className="friend-search-avatar-wrap">
                      <UserAvatar user={user} className="friend-search-avatar" />
                      <span className="friend-search-user-dot" />
                    </div>

                    <div className="friend-search-result-copy">
                      <div className="friend-search-name-row">
                        <strong>{user.nickname}</strong>
                        <span>MeetupLog</span>
                      </div>
                      <p>{user.email || '이메일 비공개'}</p>
                      <small>{user.statusMessage || relationshipHint[user.relationship] || '새로운 친구와 대화를 시작해보세요.'}</small>
                    </div>

                    <button
                      type="button"
                      className={canRequest ? 'requestable' : 'relationship-state'}
                      disabled={!canRequest || sendingId === user.id}
                      onClick={() => handleRequest(user)}
                    >
                      {sendingId === user.id
                        ? <><i className="friend-search-spinner" /> 전송 중</>
                        : canRequest
                          ? <><UserPlusIcon /> 친구 요청</>
                          : <><i className="friend-request-state-icon">✓</i>{relationshipCopy[user.relationship] ?? '요청 불가'}</>}
                    </button>
                  </article>
                )
              })}
            </div>
          </section>
        ) : (
          <div className="friend-add-guide liquid-menu-surface">
            <div className="friend-add-guide-icon"><UserPlusIcon /></div>
            <div><strong>친구를 찾아보세요</strong><p>친구 요청을 보내면 상대방이 알림에서 수락할 수 있습니다.</p></div>
          </div>
        )}
      </section>
    </main>
  )
}

export default FriendAddWorkspace
