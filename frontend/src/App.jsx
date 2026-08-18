import {
  useState,
} from 'react'

import AuthPage from './pages/AuthPage'
import ChatMainPage from './pages/ChatMainPage'

const USE_MOCK_AUTH =
  import.meta.env.VITE_USE_MOCK_AUTH === 'true'

// Mock 인증 시절에 저장된 세션이 실제 API 세션으로 오인되지 않도록
// 인증 모드별로 저장소를 분리합니다.
const SESSION_KEY = USE_MOCK_AUTH
  ? 'meetuplog-auth-session-mock'
  : 'meetuplog-auth-session-v2'
const LEGACY_SESSION_KEY = 'meetuplog-auth-session'

const readSession = () => {
  const sources = [
    window.sessionStorage,
    window.localStorage,
  ]

  for (const storage of sources) {
    try {
      const value = storage.getItem(SESSION_KEY)
      if (value) return JSON.parse(value)
    } catch {
      storage.removeItem(SESSION_KEY)
    }
  }

  return null
}

const clearStoredSession = () => {
  window.localStorage.removeItem(SESSION_KEY)
  window.sessionStorage.removeItem(SESSION_KEY)
  window.localStorage.removeItem(LEGACY_SESSION_KEY)
  window.sessionStorage.removeItem(LEGACY_SESSION_KEY)
}

const App = () => {
  const [session, setSession] = useState(readSession)

  const handleAuthenticated = (nextSession, remember) => {
    if (!nextSession) return

    clearStoredSession()

    const targetStorage =
      nextSession.type === 'guest' || !remember
        ? window.sessionStorage
        : window.localStorage

    targetStorage.setItem(
      SESSION_KEY,
      JSON.stringify(nextSession),
    )
    setSession(nextSession)
  }

  const handleLogout = () => {
    clearStoredSession()
    setSession(null)
  }

  return session
    ? (
      <ChatMainPage
        key={`${session.type}:${session.user?.id ?? 'unknown'}`}
        authSession={session}
        onLogout={handleLogout}
        onSessionChange={handleAuthenticated}
      />
      )
    : <AuthPage onAuthenticated={handleAuthenticated} />
}

export default App
