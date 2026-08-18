const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  '/api'
).replace(/\/$/, '')

export class ProfileApiError extends Error {
  constructor(message, status = 0, body = null) {
    super(message)
    this.name = 'ProfileApiError'
    this.status = status
    this.body = body
  }
}

const parseBody = async (response) => {
  if (response.status === 204) return null

  const text = await response.text().catch(() => '')
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

const request = async (
  path,
  accountToken,
  options = {},
) => {
  if (!accountToken) {
    throw new ProfileApiError(
      '로그인 토큰이 없습니다.',
      401,
    )
  }

  let response
  const isFormData =
    typeof FormData !== 'undefined' &&
    options.body instanceof FormData

  try {
    response = await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,
        headers: {
          Accept: 'application/json',
          ...(options.body && !isFormData
            ? { 'Content-Type': 'application/json' }
            : {}),
          Authorization: `Bearer ${accountToken}`,
          ...options.headers,
        },
      },
    )
  } catch {
    throw new ProfileApiError(
      '서버에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요.',
    )
  }

  const body = await parseBody(response)

  if (!response.ok) {
    throw new ProfileApiError(
      body?.detail ||
        body?.message ||
        body?.error ||
        `요청 처리에 실패했습니다. (${response.status})`,
      response.status,
      body,
    )
  }

  return body
}

export const normalizeProfile = (profile) => {
  if (!profile) return null

  return {
    ...profile,
    id: profile.userId ?? profile.id,
    email: profile.email ?? '',
    nickname: profile.nickname ?? '사용자',
    profileImageUrl:
      profile.profileImageUrl ??
      profile.profile_image_url ??
      null,
    statusMessage:
      profile.statusMessage ??
      profile.status_message ??
      '',
    accountType: profile.accountType ?? 'MEMBER',
    kakaoLinked:
      profile.kakaoLinked ??
      profile.accountType === 'SOCIAL',
  }
}

export const getMyProfile = async (
  accountToken,
  signal,
) =>
  normalizeProfile(
    await request(
      '/v1/users/me',
      accountToken,
      {
        method: 'GET',
        signal,
      },
    ),
  )

export const updateMyProfile = async (
  accountToken,
  values,
) =>
  normalizeProfile(
    await request(
      '/v1/users/me',
      accountToken,
      {
        method: 'PATCH',
        body: JSON.stringify(values),
      },
    ),
  )

export const uploadProfileImage = async (
  accountToken,
  file,
) => {
  const formData = new FormData()
  formData.append('file', file)

  const response = await request(
    '/v1/users/me/profile-image',
    accountToken,
    {
      method: 'POST',
      body: formData,
    },
  )

  return normalizeProfile(response)
}

export const removeProfileImage = async (
  accountToken,
) =>
  normalizeProfile(
    await request(
      '/v1/users/me/profile-image',
      accountToken,
      { method: 'DELETE' },
    ),
  )

export const unlinkKakao = (
  accountToken,
) =>
  request(
    '/v1/users/me/kakao-link',
    accountToken,
    { method: 'DELETE' },
  )

export const deleteMyAccount = (
  accountToken,
) =>
  request(
    '/v1/users/me',
    accountToken,
    { method: 'DELETE' },
  )

export const convertGuestAccount = async (
  accountToken,
  values,
) =>
  request(
    '/v1/users/me/convert',
    accountToken,
    {
      method: 'POST',
      body: JSON.stringify(values),
    },
  )
