import {
  useState,
} from 'react'

import AuthPage from './pages/AuthPage'
import ChatMainPage from './pages/ChatMainPage'

const SESSION_KEY = 'meetuplog-auth-session'

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
        authSession={session}
        onLogout={handleLogout}
      />
      )
    : <AuthPage onAuthenticated={handleAuthenticated} />
}

export default App
