const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ||
  '/api'
).replace(/\/$/, '')

export class MemberApiError extends Error {
  constructor(message, field = null, status = 0) {
    super(message)
    this.name = 'MemberApiError'
    this.field = field
    this.status = status
  }
}

const parsePayload = async (response) => {
  const contentType =
    response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    return null
  }

  return response.json().catch(() => null)
}

export const changeMyPassword = async (
  accountToken,
  {
    currentPassword,
    newPassword,
  },
) => {
  if (!accountToken) {
    throw new MemberApiError(
      '로그인 토큰이 없습니다.',
      null,
      401,
    )
  }

  let response

  try {
    response = await fetch(
      `${API_BASE_URL}/members/me/password`,
      {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accountToken}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      },
    )
  } catch {
    throw new MemberApiError(
      '서버에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요.',
    )
  }

  const payload = await parsePayload(response)

  if (!response.ok) {
    const currentPasswordError =
      payload?.field === 'currentPassword' ||
      payload?.code === 'INVALID_CURRENT_PASSWORD' ||
      response.status === 400

    throw new MemberApiError(
      payload?.message ||
        (currentPasswordError
          ? '현재 비밀번호가 올바르지 않습니다.'
          : response.status === 401
            ? '로그인이 만료되었습니다. 다시 로그인해 주세요.'
            : '비밀번호를 변경하지 못했습니다.'),
      currentPasswordError
        ? 'currentPassword'
        : null,
      response.status,
    )
  }

  return payload
}
