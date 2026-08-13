const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || '/api'
).replace(/\/$/, '')

const USE_MOCK_AUTH =
  import.meta.env.VITE_USE_MOCK_AUTH !== 'false'

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

const request = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })

  const payload = response.status === 204
    ? null
    : await response.json().catch(() => null)

  if (!response.ok) {
    const error = new Error(
      payload?.message ?? '요청을 처리하지 못했습니다.',
    )
    error.code = payload?.code ?? `HTTP_${response.status}`
    throw error
  }

  return payload
}

export const checkEmailAvailability = async (email) => {
  const normalizedEmail = normalizeEmail(email)

  if (!USE_MOCK_AUTH) {
    return request(`/auth/check-email?email=${encodeURIComponent(normalizedEmail)}`)
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
    return request(`/auth/check-nickname?nickname=${encodeURIComponent(normalizedNickname)}`)
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
    return request('/auth/signup', {
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
    return request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        email: normalizedEmail,
        password,
      }),
    })
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

export const enterAsGuest = async ({
  nickname,
  inviteToken,
  inviteRoomId = 1,
  inviteRoomName = '주말 영화방',
}) => {
  if (!USE_MOCK_AUTH) {
    return request(`/invites/${encodeURIComponent(inviteToken)}/guest`, {
      method: 'POST',
      body: JSON.stringify({ nickname: nickname.trim() }),
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
