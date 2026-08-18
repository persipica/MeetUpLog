import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import GlobalThemeToggle from '../components/common/GlobalThemeToggle'
import {
  ArrowRightIcon,
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  KakaoIcon,
  LockIcon,
  MailIcon,
  SparklesIcon,
  UserPlusIcon,
  UsersIcon,
} from '../components/common/Icons'
import {
  authEnvironment,
  checkEmailAvailability,
  checkNicknameAvailability,
  enterAsGuest,
  exchangeOAuthCode,
  loginMember,
  loginWithKakao,
  registerMember,
} from '../api/authApi'
import useLiquidControlReflection from '../hooks/useLiquidControlReflection'

const EMAIL_PATTERN =
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const PASSWORD_PATTERN =
  /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/

const getInitialColorMode = () => {
  const saved = window.localStorage.getItem(
    'meetuplog-color-mode',
  )

  if (saved === 'light' || saved === 'dark') {
    return saved
  }

  return window.matchMedia?.(
    '(prefers-color-scheme: dark)',
  ).matches
    ? 'dark'
    : 'light'
}

const resolveInviteContext = () => {
  const pathSegments = window.location.pathname.split('/').filter(Boolean)
  const inviteIndex = pathSegments.indexOf('invite')
  const pathToken = inviteIndex >= 0
    ? pathSegments[inviteIndex + 1]
    : null
  const query = new URLSearchParams(window.location.search)
  const suppliedToken = query.get('invite') || pathToken

  return {
    supplied: Boolean(suppliedToken),
    token: suppliedToken || (authEnvironment.mock ? 'demo-weekend-movie' : ''),
    roomId: Number(query.get('roomId')) || 1,
    roomName: query.get('roomName') || '주말 영화방',
  }
}

const PasswordField = ({
  id,
  label,
  value,
  onChange,
  placeholder,
  autoComplete,
  invalid = false,
}) => {
  const [visible, setVisible] = useState(false)

  return (
    <label className={`auth-field ${invalid ? 'invalid' : ''}`} htmlFor={id}>
      <span className="auth-field-label">{label}</span>
      <span className="auth-input-shell">
        <span className="auth-input-icon"><LockIcon /></span>
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          className="auth-password-toggle"
          onClick={() => setVisible((previous) => !previous)}
          aria-label={visible ? '비밀번호 숨기기' : '비밀번호 보기'}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </span>
    </label>
  )
}

const AuthPage = ({ onAuthenticated }) => {
  useLiquidControlReflection()

  const [colorMode, setColorMode] = useState(getInitialColorMode)
  const [view, setView] = useState(
    () => resolveInviteContext().supplied ? 'guest' : 'login',
  )
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const [loginValues, setLoginValues] = useState({
    email: '',
    password: '',
    remember: true,
  })

  const [signupValues, setSignupValues] = useState({
    email: '',
    password: '',
    passwordConfirm: '',
    nickname: '',
    terms: false,
  })

  const [emailCheck, setEmailCheck] = useState('idle')
  const [nicknameCheck, setNicknameCheck] = useState('idle')
  const [guestNickname, setGuestNickname] = useState('')
  const oauthCallbackStartedRef = useRef(false)

  useEffect(() => {
    document.documentElement.dataset.colorMode = colorMode
    document.documentElement.style.colorScheme = colorMode
    window.localStorage.setItem('meetuplog-color-mode', colorMode)
  }, [colorMode])

  useEffect(() => {
    if (oauthCallbackStartedRef.current) return

    const currentUrl = new URL(window.location.href)
    const oauthCode = currentUrl.searchParams.get('oauthCode')
    const oauthStatus = currentUrl.searchParams.get('oauth')
    const oauthError = currentUrl.searchParams.get('oauthError')

    if (!oauthCode && oauthStatus !== 'success' && !oauthError) return

    oauthCallbackStartedRef.current = true

    // 일회용 코드가 주소창·브라우저 기록에 남지 않도록 API 호출 전에 제거합니다.
    currentUrl.searchParams.delete('oauthCode')
    currentUrl.searchParams.delete('oauth')
    currentUrl.searchParams.delete('oauthError')

    const cleanUrl = `${currentUrl.pathname}${
      currentUrl.searchParams.toString()
        ? `?${currentUrl.searchParams.toString()}`
        : ''
    }${currentUrl.hash}`

    window.history.replaceState({}, document.title, cleanUrl)

    if (oauthError) {
      setFeedback({
        type: 'error',
        message: '카카오 로그인에 실패했습니다. 잠시 후 다시 시도해주세요.',
      })
      setSubmitting(false)
      return
    }

    setFeedback(null)
    setSubmitting(true)

    exchangeOAuthCode(oauthCode)
      .then((session) => {
        onAuthenticated(session, true)
      })
      .catch((error) => {
        setFeedback({
          type: 'error',
          message: error.message,
        })
        setSubmitting(false)
      })
  }, [onAuthenticated])

  const inviteContext = useMemo(() => {
    return resolveInviteContext()
  }, [])

  const passwordRules = {
    length: signupValues.password.length >= 8,
    letter: /[A-Za-z]/.test(signupValues.password),
    number: /\d/.test(signupValues.password),
    special: /[^A-Za-z\d]/.test(signupValues.password),
  }

  const setMode = (nextView) => {
    setView(nextView)
    setFeedback(null)
    setSubmitting(false)
  }

  const toggleColorMode = () => {
    const nextMode = colorMode === 'light' ? 'dark' : 'light'
    setColorMode(nextMode)
    document.documentElement.dataset.colorMode = nextMode
    document.documentElement.style.colorScheme = nextMode
    window.localStorage.setItem('meetuplog-color-mode', nextMode)
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setFeedback(null)

    if (!EMAIL_PATTERN.test(loginValues.email.trim())) {
      setFeedback({ type: 'error', message: '올바른 이메일을 입력해주세요.' })
      return
    }

    if (!loginValues.password) {
      setFeedback({ type: 'error', message: '비밀번호를 입력해주세요.' })
      return
    }

    setSubmitting(true)

    try {
      const session = await loginMember(loginValues)
      onAuthenticated(session, loginValues.remember)
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
      setSubmitting(false)
    }
  }

  const handleKakao = async () => {
    setFeedback(null)
    setSubmitting(true)

    try {
      const session = await loginWithKakao()
      if (session) onAuthenticated(session, true)
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
      setSubmitting(false)
    }
  }

  const handleEmailCheck = async () => {
    const email = signupValues.email.trim()

    if (!EMAIL_PATTERN.test(email)) {
      setEmailCheck('invalid')
      return
    }

    setEmailCheck('checking')

    try {
      const result = await checkEmailAvailability(email)
      setEmailCheck(result.available ? 'available' : 'duplicate')
    } catch {
      setEmailCheck('error')
    }
  }

  const handleNicknameCheck = async () => {
    const nickname = signupValues.nickname.trim()

    if (nickname.length < 2 || nickname.length > 20) {
      setNicknameCheck('invalid')
      return
    }

    setNicknameCheck('checking')

    try {
      const result = await checkNicknameAvailability(nickname)
      setNicknameCheck(result.available ? 'available' : 'duplicate')
    } catch {
      setNicknameCheck('error')
    }
  }

  const handleSignup = async (event) => {
    event.preventDefault()
    setFeedback(null)

    if (emailCheck !== 'available') {
      setFeedback({ type: 'error', message: '이메일 중복 확인을 완료해주세요.' })
      return
    }

    if (!PASSWORD_PATTERN.test(signupValues.password)) {
      setFeedback({ type: 'error', message: '비밀번호 조건을 모두 충족해주세요.' })
      return
    }

    if (signupValues.password !== signupValues.passwordConfirm) {
      setFeedback({ type: 'error', message: '비밀번호 확인이 일치하지 않습니다.' })
      return
    }

    if (nicknameCheck !== 'available') {
      setFeedback({ type: 'error', message: '닉네임 중복 확인을 완료해주세요.' })
      return
    }

    if (!signupValues.terms) {
      setFeedback({ type: 'error', message: '필수 약관에 동의해주세요.' })
      return
    }

    setSubmitting(true)

    try {
      await registerMember(signupValues)
      setLoginValues((previous) => ({
        ...previous,
        email: signupValues.email.trim(),
        password: '',
      }))
      setMode('login')
      setFeedback({ type: 'success', message: '가입이 완료되었습니다. 새 계정으로 로그인해주세요.' })
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
      setSubmitting(false)
    }
  }

  const handleGuestEntry = async (event) => {
    event.preventDefault()
    const nickname = guestNickname.trim()

    if (!inviteContext.token) {
      setFeedback({ type: 'error', message: '유효한 채팅방 초대 링크로 접속해주세요.' })
      return
    }

    if (nickname.length < 2 || nickname.length > 20) {
      setFeedback({ type: 'error', message: '닉네임은 2~20자로 입력해주세요.' })
      return
    }

    setFeedback(null)
    setSubmitting(true)

    try {
      const session = await enterAsGuest({
        nickname,
        inviteToken: inviteContext.token,
        inviteRoomId: inviteContext.roomId,
        inviteRoomName: inviteContext.roomName,
      })
      onAuthenticated(session, false)
    } catch (error) {
      setFeedback({ type: 'error', message: error.message })
      setSubmitting(false)
    }
  }

  const renderFeedback = () => feedback && (
    <div className={`auth-feedback ${feedback.type}`} role="alert">
      <span>{feedback.type === 'success' ? <CheckIcon /> : '!'}</span>
      <p>{feedback.message}</p>
    </div>
  )

  return (
    <main className="auth-page" data-color-mode={colorMode}>
      <GlobalThemeToggle mode={colorMode} onToggle={toggleColorMode} />

      <div className="auth-ambient auth-ambient-one" aria-hidden="true" />
      <div className="auth-ambient auth-ambient-two" aria-hidden="true" />

      <section className="auth-shell">
        <div className="auth-brand-panel">
          <div className="auth-brand-lockup">
            <span className="brand-mark">M</span>
            <div>
              <strong>MeetupLog</strong>
              <span>Decide together</span>
            </div>
          </div>

          <div className="auth-brand-copy">
            <span className="auth-eyebrow">MEETUPLOG</span>
            <h1>
              대화에서 시작해,
              <br />
              함께 결정해요.
            </h1>
            <p>
              친구들의 의견을 한곳에 모으고<br />
              우리 모임에 꼭 맞는 선택을 찾아보세요.
            </p>
          </div>

          <div className="auth-brand-visual" aria-hidden="true">
            <span className="auth-orbit orbit-one" />
            <span className="auth-orbit orbit-two" />
            <span className="auth-visual-core">M</span>
            <span className="auth-visual-node node-chat">💬</span>
            <span className="auth-visual-node node-spark"><SparklesIcon /></span>
            <span className="auth-visual-node node-check"><CheckIcon /></span>
          </div>

          <div className="auth-brand-features">
            <span><CheckIcon />실시간 그룹 대화</span>
            <span><CheckIcon />AI 의견 분석</span>
            <span><CheckIcon />함께 만드는 결정</span>
          </div>
        </div>

        <div className="auth-form-panel">
          <div key={view} className={`auth-card auth-card-${view}`}>
            <header className="auth-card-header">
              <span className="auth-card-icon">
                {view === 'login' && <LockIcon />}
                {view === 'signup' && <UserPlusIcon />}
                {view === 'guest' && <UsersIcon />}
              </span>
              <div>
                <span className="auth-eyebrow">
                  {view === 'login' ? 'WELCOME BACK' : view === 'signup' ? 'CREATE ACCOUNT' : 'GUEST PASS'}
                </span>
                <h2>
                  {view === 'login' ? '다시 만나 반가워요' : view === 'signup' ? 'MeetupLog 시작하기' : '게스트로 참여하기'}
                </h2>
                <p>
                  {view === 'login' && '계정에 로그인하고 대화를 이어가세요.'}
                  {view === 'signup' && '모임의 더 좋은 결정을 위한 계정을 만드세요.'}
                  {view === 'guest' && '초대받은 채팅방에 닉네임으로 참여합니다.'}
                </p>
              </div>
            </header>

            {view === 'login' && (
              <form className="auth-form" onSubmit={handleLogin}>
                <label className="auth-field" htmlFor="login-email">
                  <span className="auth-field-label">이메일</span>
                  <span className="auth-input-shell">
                    <span className="auth-input-icon"><MailIcon /></span>
                    <input
                      id="login-email"
                      type="email"
                      value={loginValues.email}
                      onChange={(event) => setLoginValues((previous) => ({ ...previous, email: event.target.value }))}
                      placeholder="name@example.com"
                      autoComplete="email"
                    />
                  </span>
                </label>

                <PasswordField
                  id="login-password"
                  label="비밀번호"
                  value={loginValues.password}
                  onChange={(event) => setLoginValues((previous) => ({ ...previous, password: event.target.value }))}
                  placeholder="비밀번호 입력"
                  autoComplete="current-password"
                />

                <div className="auth-form-options">
                  <label className="auth-checkbox">
                    <input
                      type="checkbox"
                      checked={loginValues.remember}
                      onChange={(event) => setLoginValues((previous) => ({ ...previous, remember: event.target.checked }))}
                    />
                    <span><CheckIcon /></span>
                    로그인 상태 유지
                  </label>
                  <button type="button" className="auth-text-button">비밀번호 찾기</button>
                </div>

                {renderFeedback()}

                <button type="submit" className="auth-primary-button" disabled={submitting}>
                  <span>{submitting ? '로그인 중…' : '로그인'}</span>
                  {!submitting && <ArrowRightIcon />}
                </button>

                <div className="auth-account-switch">
                  <span>계정이 없으신가요?</span>
                  <button type="button" onClick={() => setMode('signup')}>회원가입</button>
                </div>

                <div className="auth-divider"><span>또는</span></div>

                <button type="button" className="auth-kakao-button" onClick={handleKakao} disabled={submitting}>
                  <KakaoIcon />
                  카카오톡으로 계속하기
                </button>

                <button type="button" className="auth-guest-button" onClick={() => setMode('guest')}>
                  <UsersIcon />
                  게스트로 참여하기
                </button>

                {authEnvironment.mock && import.meta.env.DEV && (
                  <button
                    type="button"
                    className="auth-demo-account"
                    onClick={() => setLoginValues((previous) => ({
                      ...previous,
                      email: authEnvironment.demoEmail,
                      password: authEnvironment.demoPassword,
                    }))}
                  >
                    데모 계정 자동 입력
                  </button>
                )}
              </form>
            )}

            {view === 'signup' && (
              <form className="auth-form auth-signup-form" onSubmit={handleSignup}>
                <label className={`auth-field ${emailCheck === 'duplicate' || emailCheck === 'invalid' ? 'invalid' : ''}`} htmlFor="signup-email">
                  <span className="auth-field-label">이메일</span>
                  <span className="auth-input-action-row">
                    <span className="auth-input-shell">
                      <span className="auth-input-icon"><MailIcon /></span>
                      <input
                        id="signup-email"
                        type="email"
                        value={signupValues.email}
                        onChange={(event) => {
                          setSignupValues((previous) => ({ ...previous, email: event.target.value }))
                          setEmailCheck('idle')
                        }}
                        placeholder="name@example.com"
                        autoComplete="email"
                      />
                    </span>
                    <button type="button" onClick={handleEmailCheck} disabled={emailCheck === 'checking'}>
                      {emailCheck === 'checking' ? '확인 중' : '중복 확인'}
                    </button>
                  </span>
                  {emailCheck === 'available' && <small className="auth-validation success"><CheckIcon />사용 가능한 이메일입니다.</small>}
                  {emailCheck === 'duplicate' && <small className="auth-validation error">이미 가입된 이메일입니다.</small>}
                  {emailCheck === 'invalid' && <small className="auth-validation error">올바른 이메일 형식으로 입력해주세요.</small>}
                </label>

                <PasswordField
                  id="signup-password"
                  label="비밀번호"
                  value={signupValues.password}
                  onChange={(event) => setSignupValues((previous) => ({ ...previous, password: event.target.value }))}
                  placeholder="영문·숫자·특수문자 포함 8자 이상"
                  autoComplete="new-password"
                  invalid={signupValues.password.length > 0 && !PASSWORD_PATTERN.test(signupValues.password)}
                />

                <div className="auth-password-rules">
                  <span className={passwordRules.length ? 'valid' : ''}><CheckIcon />8자 이상</span>
                  <span className={passwordRules.letter ? 'valid' : ''}><CheckIcon />영문</span>
                  <span className={passwordRules.number ? 'valid' : ''}><CheckIcon />숫자</span>
                  <span className={passwordRules.special ? 'valid' : ''}><CheckIcon />특수문자</span>
                </div>

                <PasswordField
                  id="signup-password-confirm"
                  label="비밀번호 확인"
                  value={signupValues.passwordConfirm}
                  onChange={(event) => setSignupValues((previous) => ({ ...previous, passwordConfirm: event.target.value }))}
                  placeholder="비밀번호를 한 번 더 입력"
                  autoComplete="new-password"
                  invalid={signupValues.passwordConfirm.length > 0 && signupValues.password !== signupValues.passwordConfirm}
                />

                {signupValues.passwordConfirm.length > 0 && signupValues.password === signupValues.passwordConfirm && (
                  <small className="auth-validation success standalone"><CheckIcon />비밀번호가 일치합니다.</small>
                )}

                <label className={`auth-field ${nicknameCheck === 'duplicate' || nicknameCheck === 'invalid' ? 'invalid' : ''}`} htmlFor="signup-nickname">
                  <span className="auth-field-label">닉네임</span>
                  <span className="auth-input-action-row">
                    <span className="auth-input-shell">
                      <span className="auth-input-icon"><UsersIcon /></span>
                      <input
                        id="signup-nickname"
                        type="text"
                        value={signupValues.nickname}
                        onChange={(event) => {
                          setSignupValues((previous) => ({ ...previous, nickname: event.target.value }))
                          setNicknameCheck('idle')
                        }}
                        placeholder="2~20자"
                        maxLength={20}
                        autoComplete="nickname"
                      />
                    </span>
                    <button type="button" onClick={handleNicknameCheck} disabled={nicknameCheck === 'checking'}>
                      {nicknameCheck === 'checking' ? '확인 중' : '중복 확인'}
                    </button>
                  </span>
                  {nicknameCheck === 'available' && <small className="auth-validation success"><CheckIcon />사용 가능한 닉네임입니다.</small>}
                  {nicknameCheck === 'duplicate' && <small className="auth-validation error">이미 사용 중인 닉네임입니다.</small>}
                  {nicknameCheck === 'invalid' && <small className="auth-validation error">닉네임은 2~20자로 입력해주세요.</small>}
                </label>

                <label className="auth-checkbox auth-terms">
                  <input
                    type="checkbox"
                    checked={signupValues.terms}
                    onChange={(event) => setSignupValues((previous) => ({ ...previous, terms: event.target.checked }))}
                  />
                  <span><CheckIcon /></span>
                  <em>[필수] 이용약관 및 개인정보 처리방침에 동의합니다.</em>
                </label>

                {renderFeedback()}

                <button type="submit" className="auth-primary-button" disabled={submitting}>
                  <span>{submitting ? '계정을 만드는 중…' : '가입하기'}</span>
                  {!submitting && <ArrowRightIcon />}
                </button>

                <div className="auth-account-switch">
                  <span>이미 계정이 있으신가요?</span>
                  <button type="button" onClick={() => setMode('login')}>로그인</button>
                </div>

                <div className="auth-divider"><span>또는</span></div>

                <button type="button" className="auth-kakao-button" onClick={handleKakao} disabled={submitting}>
                  <KakaoIcon />
                  카카오톡으로 가입하기
                </button>
              </form>
            )}

            {view === 'guest' && (
              <form className="auth-form auth-guest-form" onSubmit={handleGuestEntry}>
                <div className="auth-invite-room">
                  <span className="auth-invite-room-icon">🎬</span>
                  <div>
                    <span>초대받은 채팅방</span>
                    <strong>{inviteContext.token ? inviteContext.roomName : '초대 정보가 없습니다'}</strong>
                  </div>
                  <span className="auth-invite-badge">GUEST</span>
                </div>

                <label className="auth-field" htmlFor="guest-nickname">
                  <span className="auth-field-label">표시할 닉네임</span>
                  <span className="auth-input-shell">
                    <span className="auth-input-icon"><UsersIcon /></span>
                    <input
                      id="guest-nickname"
                      type="text"
                      value={guestNickname}
                      onChange={(event) => setGuestNickname(event.target.value)}
                      placeholder="2~20자 닉네임 입력"
                      maxLength={20}
                      autoFocus
                    />
                  </span>
                  <small className="auth-field-help">채팅방 참여자에게 표시되는 이름입니다.</small>
                </label>

                <div className="auth-guest-permissions">
                  <strong>게스트 이용 범위</strong>
                  <span><CheckIcon />초대받은 채팅방 대화 참여</span>
                  <span><CheckIcon />메시지·이미지·이모티콘 전송</span>
                  <span className="restricted">× 친구·알림·새 채팅방 및 계정 기능 제한</span>
                </div>

                {renderFeedback()}

                <button type="submit" className="auth-primary-button" disabled={submitting || !inviteContext.token}>
                  <span>{submitting ? '입장하는 중…' : '초대방 입장'}</span>
                  {!submitting && <ArrowRightIcon />}
                </button>

                <button type="button" className="auth-back-button" onClick={() => setMode('login')}>
                  계정으로 로그인
                </button>
              </form>
            )}
          </div>

          <footer className="auth-footer">
            <span>© 2026 MeetupLog</span>
            <button type="button">이용약관</button>
            <button type="button">개인정보 처리방침</button>
          </footer>
        </div>
      </section>
    </main>
  )
}

export default AuthPage
