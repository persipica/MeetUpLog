const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || '/api'
).replace(/\/$/, '')

const AUTH_API_PATH = '/v1/auth'

const USE_MOCK_AUTH =
  import.meta.env.VITE_USE_MOCK_AUTH === 'true'

const MOCK_ACCOUNT_KEY =
  'meetuplog-mock-accounts'

const DEMO_ACCOUNT = {
  id: 1,
  accountId: 'user-heesu',
  email: 'heesu@example.com',
  nickname: '희수',
  role: 'OWNER',
  password: 'Meetup123!',
}

const normalizeEmail = (value) =>
  value.trim().toLocaleLowerCase()

const delay = (duration = 420) =>
  new Promise((resolve) => {
    window.setTimeout(resolve, duration)
  })

const hashPassword = async (value) => {
  if (!window.crypto?.subtle) {
    return `mock:${value}`
  }

  const data = new TextEncoder().encode(value)
  const digest = await window.crypto.subtle.digest(
    'SHA-256',
    data,
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const getMockAccounts = () => {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(MOCK_ACCOUNT_KEY) ?? '[]',
    )

    return Array.isArray(saved) ? saved : []
  } catch {
    return []
  }
}

const getErrorMessage = (payload, status) => {
  if (typeof payload === 'string' && payload.trim()) {
    return payload
  }

  return payload?.message ||
    payload?.detail ||
    payload?.error ||
    (status === 401
      ? '이메일 또는 비밀번호를 확인해주세요.'
      : '요청을 처리하지 못했습니다.')
}

const request = async (path, options = {}) => {
  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    })
  } catch {
    const error = new Error(
      '백엔드 서버에 연결할 수 없습니다. Spring Boot 실행 상태를 확인해주세요.',
    )
    error.code = 'NETWORK_ERROR'
    throw error
  }

  const responseText = response.status === 204
    ? ''
    : await response.text().catch(() => '')

  let payload = null

  if (responseText) {
    try {
      payload = JSON.parse(responseText)
    } catch {
      payload = responseText
    }
  }

  if (!response.ok) {
    const error = new Error(
      getErrorMessage(payload, response.status),
    )
    error.code = payload?.code ?? `HTTP_${response.status}`
    error.status = response.status
    throw error
  }

  return payload
}

const normalizeMemberSession = (payload) => ({
  type: 'member',
  provider:
    payload?.accountType === 'SOCIAL'
      ? 'KAKAO'
      : 'LOCAL',
  accessToken: payload?.accountToken ?? payload?.accessToken ?? '',
  user: {
    id: payload?.userId ?? payload?.id,
    accountId: payload?.accountId ?? `user-${payload?.userId ?? payload?.id}`,
    email: payload?.email ?? '',
    nickname: payload?.nickname ?? '',
    accountType: payload?.accountType ?? 'MEMBER',
    profileImageUrl:
      payload?.profileImageUrl ??
      payload?.profile_image_url ??
      null,
    statusMessage:
      payload?.statusMessage ??
      payload?.status_message ??
      '',
    kakaoLinked:
      payload?.kakaoLinked ??
      payload?.accountType === 'SOCIAL',
    // 전역 계정 권한(USER/ADMIN)과 채팅방 권한(OWNER/MEMBER)은
    // 별개이므로 방 정보 API가 연결되기 전에는 일반 참여자로 둡니다.
    role: 'MEMBER',
    presence: 'ONLINE',
  },
})

const normalizeGuestSession = (payload, inviteContext) => ({
  type: 'guest',
  accessToken: payload?.accountToken ?? payload?.accessToken ?? '',
  inviteToken: inviteContext.inviteToken,
  inviteRoomId: inviteContext.inviteRoomId,
  inviteRoomName: inviteContext.inviteRoomName,
  user: {
    id: payload?.userId ?? payload?.id,
    accountId: payload?.accountId ?? `guest-${payload?.userId ?? payload?.id}`,
    nickname: payload?.nickname ?? inviteContext.nickname,
    accountType: payload?.accountType ?? 'GUEST',
    profileImageUrl: null,
    statusMessage: '게스트로 참여 중',
    kakaoLinked: false,
    role: 'GUEST',
    presence: 'ONLINE',
  },
})

export const checkEmailAvailability = async (email) => {
  const normalizedEmail = normalizeEmail(email)

  if (!USE_MOCK_AUTH) {
    try {
      return await request(`${AUTH_API_PATH}/check-email?email=${encodeURIComponent(normalizedEmail)}`)
    } catch (error) {
      if (error.status === 404 || error.status === 405) {
        // 팀원 백엔드의 초기 버전에는 중복 확인 API가 없습니다.
        // 회원가입 API의 서버 측 중복 검사를 최종 기준으로 사용합니다.
        return { available: true, deferredToSignup: true }
      }

      throw error
    }
  }

  await delay(360)

  const duplicated =
    normalizedEmail === DEMO_ACCOUNT.email ||
    getMockAccounts().some(
      (account) => account.email === normalizedEmail,
    )

  return { available: !duplicated }
}

export const checkNicknameAvailability = async (nickname) => {
  const normalizedNickname = nickname.trim()

  if (!USE_MOCK_AUTH) {
    try {
      return await request(`${AUTH_API_PATH}/check-nickname?nickname=${encodeURIComponent(normalizedNickname)}`)
    } catch (error) {
      if (error.status === 404 || error.status === 405) {
        return { available: true, deferredToSignup: true }
      }

      throw error
    }
  }

  await delay(360)

  const duplicated =
    normalizedNickname === DEMO_ACCOUNT.nickname ||
    getMockAccounts().some(
      (account) => account.nickname === normalizedNickname,
    )

  return { available: !duplicated }
}

export const registerMember = async ({
  email,
  password,
  nickname,
}) => {
  if (!USE_MOCK_AUTH) {
    return request(`${AUTH_API_PATH}/signup`, {
      method: 'POST',
      body: JSON.stringify({
        email: normalizeEmail(email),
        password,
        nickname: nickname.trim(),
      }),
    })
  }

  await delay(620)

  const accounts = getMockAccounts()
  const normalizedEmail = normalizeEmail(email)

  if (
    normalizedEmail === DEMO_ACCOUNT.email ||
    accounts.some((account) => account.email === normalizedEmail)
  ) {
    const error = new Error('이미 가입된 이메일입니다.')
    error.code = 'DUPLICATE_EMAIL'
    throw error
  }

  if (
    nickname.trim() === DEMO_ACCOUNT.nickname ||
    accounts.some((account) => account.nickname === nickname.trim())
  ) {
    const error = new Error('이미 사용 중인 닉네임입니다.')
    error.code = 'DUPLICATE_NICKNAME'
    throw error
  }

  const nextId = Date.now()
  const account = {
    id: nextId,
    accountId: `user-${nextId}`,
    email: normalizedEmail,
    nickname: nickname.trim(),
    role: 'MEMBER',
    passwordHash: await hashPassword(password),
  }

  window.localStorage.setItem(
    MOCK_ACCOUNT_KEY,
    JSON.stringify([...accounts, account]),
  )

  return {
    id: account.id,
    email: account.email,
    nickname: account.nickname,
  }
}

export const loginMember = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email)

  if (!USE_MOCK_AUTH) {
    const response = await request(`${AUTH_API_PATH}/login`, {
      method: 'POST',
      body: JSON.stringify({
        email: normalizedEmail,
        password,
      }),
    })

    return normalizeMemberSession(response)
  }

  await delay(560)

  if (
    normalizedEmail === DEMO_ACCOUNT.email &&
    password === DEMO_ACCOUNT.password
  ) {
    return {
      type: 'member',
      accessToken: 'mock-member-token',
      user: {
        id: DEMO_ACCOUNT.id,
        accountId: DEMO_ACCOUNT.accountId,
        email: DEMO_ACCOUNT.email,
        nickname: DEMO_ACCOUNT.nickname,
        role: DEMO_ACCOUNT.role,
      },
    }
  }

  const account = getMockAccounts().find(
    (candidate) => candidate.email === normalizedEmail,
  )

  const passwordMatches = account
    ? account.passwordHash === await hashPassword(password)
    : false

  if (!account || !passwordMatches) {
    const error = new Error('이메일 또는 비밀번호를 확인해주세요.')
    error.code = 'INVALID_CREDENTIALS'
    throw error
  }

  return {
    type: 'member',
    accessToken: `mock-member-${account.id}`,
    user: {
      id: account.id,
      accountId: account.accountId,
      email: account.email,
      nickname: account.nickname,
      role: account.role,
    },
  }
}

export const loginWithKakao = async () => {
  if (!USE_MOCK_AUTH) {
    window.location.assign(
      import.meta.env.VITE_KAKAO_AUTH_URL ||
      '/oauth2/authorization/kakao',
    )
    return null
  }

  await delay(650)

  return {
    type: 'member',
    accessToken: 'mock-kakao-token',
    provider: 'KAKAO',
    user: {
      id: DEMO_ACCOUNT.id,
      accountId: DEMO_ACCOUNT.accountId,
      email: DEMO_ACCOUNT.email,
      nickname: DEMO_ACCOUNT.nickname,
      role: DEMO_ACCOUNT.role,
    },
  }
}

/**
 * OAuth 성공 핸들러가 발급한 일회용 코드를 실제 MeetupLog JWT로 교환합니다.
 * 카카오 인가 코드를 다시 카카오 서버에 보내는 API가 아닙니다.
 */
export const exchangeOAuthCode = async (oauthCode) => {
  const code = oauthCode?.trim()

  if (USE_MOCK_AUTH) {
    return {
      type: 'member',
      provider: 'KAKAO',
      accessToken: 'mock-kakao-token',
      user: {
        id: DEMO_ACCOUNT.id,
        accountId: DEMO_ACCOUNT.accountId,
        email: DEMO_ACCOUNT.email,
        nickname: DEMO_ACCOUNT.nickname,
        accountType: 'SOCIAL',
        profileImageUrl: null,
        statusMessage: '',
        kakaoLinked: true,
        role: 'MEMBER',
        presence: 'ONLINE',
      },
    }
  }

  const response = await request(`${AUTH_API_PATH}/oauth/exchange`, {
    method: 'POST',
    // 신규 백엔드는 HttpOnly 쿠키로 교환 코드를 전달합니다.
    // code body는 기존 query-string 성공 핸들러와의 하위 호환용입니다.
    ...(code
      ? { body: JSON.stringify({ code }) }
      : {}),
  })

  return normalizeMemberSession(response)
}

export const enterAsGuest = async ({
  nickname,
  inviteToken,
  inviteRoomId = 1,
  inviteRoomName = '주말 영화방',
}) => {
  if (!USE_MOCK_AUTH) {
    const response = await request(`/v1/invites/${encodeURIComponent(inviteToken)}/guest`, {
      method: 'POST',
      body: JSON.stringify({ nickname: nickname.trim() }),
    })

    return normalizeGuestSession(response, {
      nickname: nickname.trim(),
      inviteToken,
      inviteRoomId: response.inviteRoomId ?? inviteRoomId,
      inviteRoomName: response.inviteRoomName ?? inviteRoomName,
    })
  }

  await delay(520)

  const guestId = Date.now()

  return {
    type: 'guest',
    accessToken: `mock-guest-${inviteToken}-${guestId}`,
    inviteToken,
    inviteRoomId,
    inviteRoomName,
    user: {
      id: guestId,
      accountId: `guest-${guestId}`,
      nickname: nickname.trim(),
      role: 'GUEST',
      presence: 'ONLINE',
    },
  }
}

export const authEnvironment = {
  mock: USE_MOCK_AUTH,
  demoEmail: DEMO_ACCOUNT.email,
  demoPassword: DEMO_ACCOUNT.password,
}
