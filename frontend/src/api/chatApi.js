const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL ?? '/api'
).replace(/\/$/, '')

const resolveAssetUrl = (value) => {
  if (!value || /^(?:https?:|data:|blob:)/i.test(value)) return value ?? null
  if (!value.startsWith('/')) return value

  try {
    return /^https?:\/\//i.test(API_BASE_URL)
      ? `${new URL(API_BASE_URL).origin}${value}`
      : value
  } catch {
    return value
  }
}

export class ChatApiError extends Error {
  constructor(message, status = 0, body = null) {
    super(message)
    this.name = 'ChatApiError'
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

const getErrorMessage = (body, status) => {
  if (typeof body === 'string' && body.trim()) return body
  return body?.message ?? body?.error ?? `요청 처리에 실패했습니다. (${status})`
}

const request = async (path, { accessToken, signal, ...options } = {}) => {
  let response
  const isFormData = options.body instanceof FormData

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      signal,
      headers: {
        Accept: 'application/json',
        ...(options.body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        ...options.headers,
      },
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ChatApiError(
      '채팅 서버에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요.',
    )
  }

  const body = await readBody(response)
  if (!response.ok) {
    throw new ChatApiError(getErrorMessage(body, response.status), response.status, body)
  }

  return body
}

const formatMessageTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(11, 16)

  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

export const normalizeRoom = (room) => ({
  id: room.roomId ?? room.id,
  name: room.roomName ?? room.name ?? '이름 없는 채팅방',
  topicType: room.topicType ?? room.category ?? 'ETC',
  lastMessage: room.lastMessage ?? room.description ?? '새 대화를 시작해보세요.',
  unreadCount: Number(room.unreadCount ?? 0),
  memberCount: Number(room.currentMembers ?? room.memberCount ?? 0),
  maxMembers: Number(room.maxMembers ?? 9),
  roomType: room.roomType ?? 'GROUP',
  roomStatus: room.roomStatus ?? 'ACTIVE',
  createdById: room.createdById ?? null,
  createdByNickname: room.createdByNickname ?? '',
  myRole: room.myRole ?? null,
  roomImageUrl: room.roomImageUrl ?? null,
  description: room.description ?? '',
  notificationSetting: room.notificationSetting ?? 'ALL',
  notificationMutedUntil: room.notificationMutedUntil ?? null,
  notificationsMuted: Boolean(room.notificationsMuted),
})

export const normalizeMessage = (message) => {
  const status = message.messageStatus ?? 'ACTIVE'
  const type = message.messageType ?? message.type ?? 'TEXT'

  return {
    id: message.messageId ?? message.id ?? message.clientMessageKey,
    roomId: message.roomId,
    senderId: message.senderId ?? 0,
    senderName: message.senderNickname ?? message.senderName ?? '알 수 없음',
    content: status === 'DELETED' ? '' : (message.content ?? ''),
    sentAt: formatMessageTime(message.sentAt),
    sentAtRaw: message.sentAt ?? null,
    type: type === 'DECISION_CARD' ? 'AI_RESULT' : type,
    imageUrl: resolveAssetUrl(message.imageUrl),
    imageMimeType: message.imageMimeType ?? null,
    imageSize: message.imageSize ?? null,
    replyToId: message.replyToMessageId ?? message.replyToId ?? null,
    relatedEntityType: message.relatedEntityType ?? null,
    relatedEntityId: message.relatedEntityId ?? null,
    clientMessageKey: message.clientMessageKey ?? null,
    unreadCount: Number(message.unreadCount ?? 0),
    edited: status === 'EDITED',
    deleted: status === 'DELETED',
    pending: Boolean(message.pending),
    failed: Boolean(message.failed),
    systemEvent: message.systemEvent ?? null,
    reactions: message.reactions ?? {},
    realtimeEvent: message.eventType ?? null,
  }
}

export const normalizeMember = (member) => ({
  id: member.userId ?? member.memberId ?? member.id,
  accountId: member.accountId ?? null,
  nickname: member.nickname ?? '알 수 없음',
  email: member.email ?? '',
  role: member.accountType === 'GUEST'
    ? 'GUEST'
    : member.roomRole ?? member.role ?? 'MEMBER',
  accountType: member.accountType ?? 'MEMBER',
  presence: member.presence ?? 'OFFLINE',
  profileImageUrl: member.profileImageUrl ?? null,
  statusMessage: member.statusMessage ?? '',
})

export const getMyRooms = async (accessToken, signal) => {
  const rooms = await request('/v1/rooms', { accessToken, signal })
  return Array.isArray(rooms) ? rooms.map(normalizeRoom) : []
}

export const getRoom = async (accessToken, roomId, signal) => {
  const room = await request(`/v1/rooms/${roomId}`, { accessToken, signal })
  return normalizeRoom(room)
}

export const getRoomMessages = async (accessToken, roomId, signal) => {
  const messages = await request(`/v1/rooms/${roomId}/messages`, {
    accessToken,
    signal,
  })
  return Array.isArray(messages) ? messages.map(normalizeMessage) : []
}

export const getRoomMembers = async (accessToken, roomId, signal) => {
  const members = await request(`/v1/rooms/${roomId}/members`, {
    accessToken,
    signal,
  })
  return Array.isArray(members) ? members.map(normalizeMember) : []
}

export const createRoom = async (accessToken, values) => {
  const room = await request('/v1/rooms', {
    accessToken,
    method: 'POST',
    body: JSON.stringify({
      roomName: values.name,
      topicType: values.topicType,
      maxMembers: values.maxMembers,
      description: values.description ?? '',
    }),
  })
  return normalizeRoom(room)
}

export const joinRoom = (accessToken, roomId) =>
  request(`/v1/rooms/${roomId}/join`, {
    accessToken,
    method: 'POST',
  })

export const updateRoom = async (accessToken, roomId, roomName) => {
  const room = await request(`/v1/rooms/${roomId}`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify({ roomName }),
  })
  return normalizeRoom(room)
}

export const deleteRoom = (accessToken, roomId) =>
  request(`/v1/rooms/${roomId}`, {
    accessToken,
    method: 'DELETE',
  })

export const leaveRoom = (accessToken, roomId) =>
  request(`/v1/rooms/${roomId}/leave`, {
    accessToken,
    method: 'POST',
  })

export const getRoomNotificationSetting = (accessToken, roomId, signal) =>
  request(`/v1/rooms/${roomId}/notification-setting`, {
    accessToken,
    signal,
  })

export const updateRoomNotificationSetting = (accessToken, roomId, mode) =>
  request(`/v1/rooms/${roomId}/notification-setting`, {
    accessToken,
    method: 'PUT',
    body: JSON.stringify({ mode }),
  })

export const createWebSocketTicket = (accessToken, signal) =>
  request('/v1/chat/ws-ticket', {
    accessToken,
    signal,
    method: 'POST',
  })

export const editChatMessage = async (accessToken, roomId, messageId, content) => {
  const message = await request(`/v1/rooms/${roomId}/messages/${messageId}`, {
    accessToken,
    method: 'PATCH',
    body: JSON.stringify({ content }),
  })
  return normalizeMessage(message)
}

export const deleteChatMessage = async (accessToken, roomId, messageId) => {
  const message = await request(`/v1/rooms/${roomId}/messages/${messageId}`, {
    accessToken,
    method: 'DELETE',
  })
  return normalizeMessage(message)
}

export const uploadChatImage = async (accessToken, roomId, file) => {
  const formData = new FormData()
  formData.append('file', file)

  const image = await request(`/v1/rooms/${roomId}/images`, {
    accessToken,
    method: 'POST',
    body: formData,
  })

  return {
    ...image,
    serverImageUrl: image?.imageUrl,
    imageUrl: resolveAssetUrl(image?.imageUrl),
  }
}
