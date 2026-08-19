const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? '/api'
).replace(/\/$/, '')

export class SocialApiError extends Error {
  constructor(message, status = 0, body = null) {
    super(message)
    this.name = 'SocialApiError'
    this.status = status
    this.body = body
  }
}

const readBody = async (response) => {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

const request = async (path, { accessToken, signal, ...options } = {}) => {
  let response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new SocialApiError('친구·초대 서버에 연결할 수 없습니다.')
  }

  const body = await readBody(response)
  if (!response.ok) {
    const message = typeof body === 'string'
      ? body
      : body?.message ?? body?.error ?? `요청 처리에 실패했습니다. (${response.status})`
    throw new SocialApiError(message, response.status, body)
  }
  return body
}

export const normalizeFriend = (user) => ({
  id: user.userId ?? user.id,
  accountId: user.accountId ?? `user-${user.userId ?? user.id}`,
  email: user.email ?? '',
  nickname: user.nickname ?? '알 수 없음',
  profileImageUrl: user.profileImageUrl ?? null,
  statusMessage: user.statusMessage ?? '',
  relationship: user.relationship ?? 'FRIEND',
  presence: user.presence ?? 'OFFLINE',
})

export const getFriends = async (accessToken, signal) => {
  const body = await request('/v1/friends', { accessToken, signal })
  return Array.isArray(body) ? body.map(normalizeFriend) : []
}

export const searchFriendUsers = async (accessToken, query, signal) => {
  const body = await request(`/v1/friends/search?query=${encodeURIComponent(query)}`, {
    accessToken,
    signal,
  })
  return Array.isArray(body) ? body.map(normalizeFriend) : []
}

export const sendFriendRequest = (accessToken, receiverId, message = '') =>
  request('/v1/friends/requests', {
    accessToken,
    method: 'POST',
    body: JSON.stringify({ receiverId, message }),
  })

export const getReceivedFriendRequests = (accessToken, signal) =>
  request('/v1/friends/requests/received', { accessToken, signal })

export const getSentFriendRequests = (accessToken, signal) =>
  request('/v1/friends/requests/sent', { accessToken, signal })

export const acceptFriendRequest = (accessToken, requestId) =>
  request(`/v1/friends/requests/${requestId}/accept`, {
    accessToken,
    method: 'POST',
  }).then(normalizeFriend)

export const rejectFriendRequest = (accessToken, requestId) =>
  request(`/v1/friends/requests/${requestId}/reject`, {
    accessToken,
    method: 'POST',
  })

export const removeFriend = (accessToken, friendId) =>
  request(`/v1/friends/${friendId}`, {
    accessToken,
    method: 'DELETE',
  })

export const blockFriend = (accessToken, friendId, reason = '') =>
  request(`/v1/friends/${friendId}/block`, {
    accessToken,
    method: 'POST',
    body: JSON.stringify({ reason }),
  })

export const sendRoomMemberInvite = (accessToken, roomId, inviteeUserId) =>
  request(`/v1/rooms/${roomId}/member-invites`, {
    accessToken,
    method: 'POST',
    body: JSON.stringify({ inviteeUserId }),
  })

export const getSentRoomMemberInvites = (accessToken, roomId, signal) =>
  request(`/v1/rooms/${roomId}/member-invites/sent`, { accessToken, signal })

export const getReceivedRoomMemberInvites = (accessToken, signal) =>
  request('/v1/room-member-invites/received', { accessToken, signal })

export const acceptRoomMemberInvite = (accessToken, inviteId) =>
  request(`/v1/room-member-invites/${inviteId}/accept`, {
    accessToken,
    method: 'POST',
  })

export const rejectRoomMemberInvite = (accessToken, inviteId) =>
  request(`/v1/room-member-invites/${inviteId}/reject`, {
    accessToken,
    method: 'POST',
  })

export const createRoomInviteLink = (accessToken, roomId, values = {}) =>
  request(`/v1/rooms/${roomId}/invite-links`, {
    accessToken,
    method: 'POST',
    body: JSON.stringify({
      expiresInHours: values.expiresInHours ?? 24,
      maxUses: values.maxUses ?? 50,
    }),
  })

export const getActiveRoomInviteLink = (accessToken, roomId, signal) =>
  request(`/v1/rooms/${roomId}/invite-links/active`, {
    accessToken,
    signal,
  })

export const revokeRoomInviteLink = (accessToken, roomId, inviteId) =>
  request(`/v1/rooms/${roomId}/invite-links/${inviteId}`, {
    accessToken,
    method: 'DELETE',
  })

export const getPublicRoomInvite = (inviteToken, signal) =>
  request(`/v1/invites/${encodeURIComponent(inviteToken)}`, { signal })

export const joinRoomByInvite = (accessToken, inviteToken) =>
  request(`/v1/invites/${encodeURIComponent(inviteToken)}/join`, {
    accessToken,
    method: 'POST',
  })
