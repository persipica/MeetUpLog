import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import ChatSidebar from '../components/chat/ChatSidebar'
import ChatHeader from '../components/chat/ChatHeader'
import MessageList from '../components/chat/MessageList'
import TypingIndicator from '../components/chat/TypingIndicator'
import MessageComposer from '../components/chat/MessageComposer'
import MemberPanel from '../components/chat/MemberPanel'

import WorkspaceHome from '../components/workspace/WorkspaceHome'
import FriendAddWorkspace from '../components/workspace/FriendAddWorkspace'
import NotificationsWorkspace from '../components/workspace/NotificationsWorkspace'
import ProfileEditWorkspace from '../components/workspace/ProfileEditWorkspace'

import CreateRoomModal from '../components/modals/CreateRoomModal'
import KickMemberModal from '../components/modals/KickMemberModal'
import KickedMemberNoticeModal from '../components/modals/KickedMemberNoticeModal'
import RoomMenuModal from '../components/modals/RoomMenuModal'
import AppModal from '../components/common/AppModal'

import {
  currentUser as initialCurrentUser,
  initialChatRooms,
  initialFriends,
  initialMembers,
  initialMessagesByRoom,
  initialNotifications,
  mockAiMovies,
} from '../data/mockChatData'

import {
  getRoomTheme,
} from '../config/roomThemes'

import useLiquidControlReflection from '../hooks/useLiquidControlReflection'
import GlobalThemeToggle from '../components/common/GlobalThemeToggle'
import { changeMyPassword } from '../api/memberApi'
import {
  convertGuestAccount,
  deleteMyAccount,
  getMyProfile,
  removeProfileImage,
  unlinkKakao,
  updateMyProfile,
  uploadProfileImage,
} from '../api/profileApi'
import {
  createRoom as createChatRoom,
  deleteRoom as deleteChatRoom,
  deleteChatMessage,
  editChatMessage,
  getRoomNotificationSetting,
  getMyRooms,
  getRoomMembers,
  getRoomMessages,
  normalizeMessage,
  normalizeRoom,
  leaveRoom as leaveChatRoom,
  updateRoom as updateChatRoom,
  updateRoomNotificationSetting,
  uploadChatImage,
} from '../api/chatApi'
import {
  acceptFriendRequest,
  acceptRoomMemberInvite,
  createRoomInviteLink,
  getActiveRoomInviteLink,
  getFriends,
  getReceivedFriendRequests,
  getReceivedRoomMemberInvites,
  getSentRoomMemberInvites,
  joinRoomByInvite,
  blockFriend,
  removeFriend,
  rejectFriendRequest,
  rejectRoomMemberInvite,
  revokeRoomInviteLink,
  sendRoomMemberInvite,
} from '../api/socialApi'
import useRealtimeChat from '../hooks/useRealtimeChat'
import {
  BellIcon,
  CloseIcon,
  LogoutIcon,
  PencilIcon,
  TrashIcon,
  UserPlusIcon,
} from '../components/common/Icons'

const PRESENCE_KEYS = new Set([
  'ONLINE',
  'AWAY',
  'OFFLINE',
])

const USE_MOCK_CHAT =
  import.meta.env.VITE_USE_MOCK_CHAT === 'true'

const normalizePresenceIdentity = (value) => {
  if (value == null) return null

  const identity = String(value).trim()
  if (!identity) return null
  if (/^id:\d+$/i.test(identity)) return identity.toLocaleLowerCase()
  if (/^\d+$/.test(identity)) return `id:${identity}`

  const userIdMatch = identity.match(/^(?:user|guest)-(\d+)$/i)
  if (userIdMatch) return `id:${userIdMatch[1]}`

  if (/^account:/i.test(identity)) {
    return `account:${identity.slice(identity.indexOf(':') + 1)}`
  }

  if (/^email:/i.test(identity)) {
    return `email:${identity.slice(identity.indexOf(':') + 1).toLocaleLowerCase()}`
  }

  if (identity.includes('@')) return `email:${identity.toLocaleLowerCase()}`
  return null
}

const getPresenceIdentities = (person) => {
  if (!person) return []

  const identities = new Set()
  const userId = person.id ?? person.userId
  const normalizedPayloadIdentity = normalizePresenceIdentity(person.identity)

  if (userId != null) identities.add(`id:${userId}`)
  if (normalizedPayloadIdentity) identities.add(normalizedPayloadIdentity)
  if (person.accountId) identities.add(`account:${person.accountId}`)
  if (person.email) identities.add(`email:${String(person.email).toLocaleLowerCase()}`)

  return Array.from(identities)
}

const getPresenceIdentity = (person) => getPresenceIdentities(person)[0] ?? null

const resolvePresence = (directory, person) => {
  const identity = getPresenceIdentities(person).find((key) => directory[key] != null)
  return identity ? directory[identity] : person?.presence
}

const createPresenceDirectory = (...groups) => {
  const directory = {}

  groups.flat().forEach((person) => {
    if (PRESENCE_KEYS.has(person?.presence)) {
      getPresenceIdentities(person).forEach((identity) => {
        directory[identity] = person.presence
      })
    }
  })

  return directory
}

const ChatMainPage = ({
  authSession,
  onLogout,
  onSessionChange,
}) => {
  useLiquidControlReflection()

  const isGuest =
    authSession?.type === 'guest'

  const sessionUser = {
    ...initialCurrentUser,
    ...authSession?.user,
    role:
      authSession?.user?.role ??
      (isGuest ? 'GUEST' : initialCurrentUser.role),
    email:
      authSession?.user?.email ??
      (isGuest ? '' : initialCurrentUser.email),
    statusMessage:
      isGuest
        ? '게스트로 참여 중'
        : authSession?.user?.statusMessage ?? initialCurrentUser.statusMessage,
    presence:
      authSession?.user?.presence ?? 'ONLINE',
  }

  const sessionRooms = isGuest
    ? [
        {
          ...(initialChatRooms.find(
            (room) => room.id === authSession?.inviteRoomId,
          ) ?? initialChatRooms[0]),
          id: authSession?.inviteRoomId ?? initialChatRooms[0].id,
          name: authSession?.inviteRoomName ?? initialChatRooms[0].name,
          memberCount:
            (initialChatRooms.find(
              (room) => room.id === authSession?.inviteRoomId,
            )?.memberCount ?? initialChatRooms[0].memberCount) + 1,
        },
      ]
    : initialChatRooms

  const sessionMembers = (() => {
    const currentMember = {
      id: sessionUser.id,
      accountId: sessionUser.accountId,
      nickname: sessionUser.nickname,
      email: sessionUser.email,
      role: sessionUser.role,
      presence: sessionUser.presence,
      profileImageUrl: sessionUser.profileImageUrl,
      statusMessage: sessionUser.statusMessage,
    }

    if (isGuest) {
      return [currentMember, ...initialMembers]
    }

    const alreadyIncluded = initialMembers.some(
      (member) => member.id === currentMember.id,
    )

    return alreadyIncluded
      ? initialMembers.map((member) =>
          member.id === currentMember.id
            ? { ...member, ...currentMember }
            : member,
        )
      : [currentMember, ...initialMembers]
  })()

  const sessionMessages = isGuest
    ? {
        ...initialMessagesByRoom,
        [sessionRooms[0].id]: [
          ...(initialMessagesByRoom[sessionRooms[0].id] ?? []),
          {
            id: `guest-join-${sessionUser.id}`,
            eventId: `guest-join-${sessionUser.id}`,
            senderId: 0,
            senderName: 'System',
            content: `${sessionUser.nickname}님이 입장했습니다.`,
            sentAt: '',
            type: 'SYSTEM',
            systemEvent: 'JOIN',
          },
        ],
      }
    : initialMessagesByRoom

  const [
    colorMode,
    setColorMode,
  ] = useState(() => {
    if (
      typeof window ===
      'undefined'
    ) {
      return 'light'
    }

    const saved =
      window.localStorage.getItem(
        'meetuplog-color-mode',
      )

    if (
      saved === 'light' ||
      saved === 'dark'
    ) {
      return saved
    }

    return window.matchMedia?.(
      '(prefers-color-scheme: dark)',
    ).matches
      ? 'dark'
      : 'light'
  })

  useEffect(() => {
    if (
      typeof document ===
      'undefined'
    ) {
      return
    }

    document.documentElement.dataset.colorMode =
      colorMode

    document.documentElement.style.colorScheme =
      colorMode

    window.localStorage.setItem(
      'meetuplog-color-mode',
      colorMode,
    )
  }, [
    colorMode,
  ])

  const [
    userProfile,
    setUserProfile,
  ] = useState(
    sessionUser,
  )

  const [rooms, setRooms] =
    useState(
      USE_MOCK_CHAT || isGuest
        ? sessionRooms
        : [],
    )

  const [baseFriends, setBaseFriends] =
    useState(
      isGuest ? [] : (USE_MOCK_CHAT ? initialFriends : []),
    )

  const [presenceDirectory, setPresenceDirectory] = useState(
    () => createPresenceDirectory(
      initialCurrentUser,
      isGuest ? [] : initialFriends,
      sessionMembers,
    ),
  )

  const [
    baseMembers,
    setBaseMembers,
  ] = useState(sessionMembers)

  /*
   * 로그인 응답은 최소 정보만 포함할 수 있으므로
   * 앱 진입 후 /users/me에서 실제 프로필을 다시 조회합니다.
   */
  useEffect(() => {
    const accountToken = authSession?.accessToken

    if (!accountToken) return undefined

    const controller = new AbortController()

    getMyProfile(accountToken, controller.signal)
      .then((profile) => {
        if (!profile) return

        setUserProfile((previous) => ({
          ...previous,
          ...profile,
          id: profile.userId ?? profile.id ?? previous.id,
          accountId:
            previous.accountId ??
            `user-${profile.userId ?? profile.id}`,
          // 전역 USER 역할이 채팅방 MEMBER 역할을 덮지 않도록 유지합니다.
          role: previous.role,
          presence: previous.presence ?? 'ONLINE',
        }))

        setBaseMembers((previous) =>
          previous.map((member) =>
            member.id === (profile.userId ?? profile.id)
              ? {
                  ...member,
                  nickname: profile.nickname,
                  email: profile.email,
                  profileImageUrl: profile.profileImageUrl,
                  statusMessage: profile.statusMessage,
                  accountType: profile.accountType,
                }
              : member,
          ),
        )
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          console.error('프로필 조회 실패:', error)
        }
      })

    return () => controller.abort()
  }, [authSession?.accessToken])

  const [activeMenu, setActiveMenu] =
    useState('chat')

  const friends = useMemo(
    () => baseFriends.map((friend) => ({
      ...friend,
      presence: resolvePresence(presenceDirectory, friend),
    })),
    [baseFriends, presenceDirectory],
  )

  const applyRealtimePresence = useCallback((payload) => {
    const presence = payload?.presence
    const identities = getPresenceIdentities(payload)

    if (identities.length === 0 || !PRESENCE_KEYS.has(presence)) {
      return
    }

    setPresenceDirectory((previous) => {
      const next = { ...previous }
      identities.forEach((identity) => {
        next[identity] = presence
      })
      return next
    })

    const currentUserIdentities = new Set(getPresenceIdentities(userProfile))

    if (identities.some((identity) => currentUserIdentities.has(identity))) {
      setUserProfile((previous) => ({
        ...previous,
        presence,
      }))
    }
  }, [userProfile.accountId, userProfile.email, userProfile.id])

  useEffect(() => {

    const handleWindowPresence = (event) => {
      applyRealtimePresence(event.detail)
    }

    window.addEventListener(
      'meetuplog:presence-change',
      handleWindowPresence,
    )

    const channel = 'BroadcastChannel' in window
      ? new BroadcastChannel('meetuplog-presence')
      : null

    if (channel) {
      channel.onmessage = (event) => {
        applyRealtimePresence(event.data)
      }
    }

    return () => {
      window.removeEventListener(
        'meetuplog:presence-change',
        handleWindowPresence,
      )
      channel?.close()
    }
  }, [applyRealtimePresence])

  /*
   * 중앙 콘텐츠:
   * home | chat | friend-add |
   * notifications | profile-edit
   */
  const [
    workspaceMode,
    setWorkspaceMode,
  ] = useState(
    isGuest ? 'chat' : 'home',
  )

  const [
    returnWorkspaceMode,
    setReturnWorkspaceMode,
  ] = useState('home')

  const [
    selectedRoomId,
    setSelectedRoomId,
  ] = useState(
    isGuest
      ? sessionRooms[0]?.id ?? null
      : null,
  )

  const [
    messagesByRoom,
    setMessagesByRoom,
  ] = useState(
    USE_MOCK_CHAT
      ? sessionMessages
      : {},
  )

  const [
    notifications,
    setNotifications,
  ] = useState(
    USE_MOCK_CHAT ? initialNotifications : [],
  )

  const [pendingInvitesByRoom, setPendingInvitesByRoom] = useState({})
  const [inviteLinksByRoom, setInviteLinksByRoom] = useState({})
  const [inviteLinkBusy, setInviteLinkBusy] = useState(false)
  const [notificationActionBusyId, setNotificationActionBusyId] = useState(null)

  const refreshSocialData = useCallback(async (signal) => {
    if (USE_MOCK_CHAT || isGuest || !authSession?.accessToken) return

    const [friendList, friendRequests, roomInvites] = await Promise.all([
      getFriends(authSession.accessToken, signal),
      getReceivedFriendRequests(authSession.accessToken, signal),
      getReceivedRoomMemberInvites(authSession.accessToken, signal),
    ])

    setBaseFriends(friendList)
    setPresenceDirectory((previous) => ({
      ...previous,
      ...createPresenceDirectory(friendList),
    }))
    setNotifications([
      ...friendRequests.map((request) => ({
        id: `friend-${request.requestId}`,
        type: 'FRIEND',
        title: '친구 요청',
        body: `${request.nickname}님이 친구 요청을 보냈습니다.${request.message ? ` · ${request.message}` : ''}`,
        time: request.createdAt ? new Date(request.createdAt).toLocaleString('ko-KR') : '방금',
        read: false,
        actionable: true,
        actionKind: 'FRIEND_REQUEST',
        referenceId: request.requestId,
      })),
      ...roomInvites.map((invite) => ({
        id: `room-${invite.inviteId}`,
        type: 'INVITE',
        title: '새 채팅방 초대',
        body: `${invite.inviterNickname}님이 “${invite.roomName}”에 초대했습니다.`,
        time: invite.createdAt ? new Date(invite.createdAt).toLocaleString('ko-KR') : '방금',
        read: false,
        actionable: true,
        actionKind: 'ROOM_INVITE',
        referenceId: invite.inviteId,
      })),
    ])
  }, [authSession?.accessToken, isGuest])

  useEffect(() => {
    if (USE_MOCK_CHAT || isGuest || !authSession?.accessToken) return undefined
    const controller = new AbortController()
    refreshSocialData(controller.signal).catch((error) => {
      if (error?.name !== 'AbortError') console.error('친구·초대 정보 조회 실패:', error)
    })
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        refreshSocialData().catch(() => {})
      }
    }, 15000)
    return () => {
      controller.abort()
      window.clearInterval(refreshTimer)
    }
  }, [authSession?.accessToken, isGuest, refreshSocialData])

  useEffect(() => {
    if (USE_MOCK_CHAT || isGuest || !authSession?.accessToken || !selectedRoomId) return undefined
    const controller = new AbortController()
    getSentRoomMemberInvites(authSession.accessToken, selectedRoomId, controller.signal)
      .then((invites) => {
        setPendingInvitesByRoom((previous) => ({
          ...previous,
          [selectedRoomId]: invites.map((invite) => invite.inviteeId),
        }))
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') console.error('보낸 채팅방 초대 조회 실패:', error)
      })
    return () => controller.abort()
  }, [authSession?.accessToken, isGuest, selectedRoomId])

  const [typingUsers, setTypingUsers] = useState(
    USE_MOCK_CHAT
      ? [{ id: 2, nickname: '민수' }]
      : [],
  )

  const typingTimersRef = useRef(new Map())
  const inviteJoinAttemptedRef = useRef(false)
  const lastReadSentRef = useRef(new Map())
  const unreadCountUpdatesRef = useRef(new Map())

  useEffect(() => {
    if (USE_MOCK_CHAT || isGuest || inviteJoinAttemptedRef.current || !authSession?.accessToken) return
    const segments = window.location.pathname.split('/').filter(Boolean)
    const inviteIndex = segments.indexOf('invite')
    const inviteToken = inviteIndex >= 0 ? segments[inviteIndex + 1] : null
    if (!inviteToken) return

    inviteJoinAttemptedRef.current = true
    joinRoomByInvite(authSession.accessToken, inviteToken)
      .then((response) => {
        const room = normalizeRoom(response)
        setRooms((previous) => previous.some((item) => item.id === room.id)
          ? previous.map((item) => item.id === room.id ? room : item)
          : [room, ...previous])
        setSelectedRoomId(room.id)
        setWorkspaceMode('chat')
        setActiveMenu('chat')
        window.history.replaceState({}, document.title, '/')
      })
      .catch((error) => window.alert(error.message))
  }, [authSession?.accessToken, isGuest])

  const handleRealtimeMessage = useCallback((payload) => {
    const incoming = normalizeMessage(payload)
    const roomId = incoming.roomId
    if (!roomId) return
    const unreadUpdateKey = `${roomId}:${incoming.id}`
    if (unreadCountUpdatesRef.current.has(unreadUpdateKey)) {
      incoming.unreadCount = unreadCountUpdatesRef.current.get(unreadUpdateKey)
      unreadCountUpdatesRef.current.delete(unreadUpdateKey)
    }
    const isCreatedEvent = ![
      'MESSAGE_UPDATED',
      'MESSAGE_DELETED',
    ].includes(incoming.realtimeEvent)

    setMessagesByRoom((previous) => {
      const messages = previous[roomId] ?? []
      const existingIndex = messages.findIndex((message) =>
        (incoming.id != null && message.id === incoming.id) ||
        (incoming.clientMessageKey && message.clientMessageKey === incoming.clientMessageKey),
      )

      if (existingIndex < 0) {
        return {
          ...previous,
          [roomId]: [...messages, incoming],
        }
      }

      const nextMessages = [...messages]
      nextMessages[existingIndex] = {
        ...messages[existingIndex],
        ...incoming,
        reactions:
          incoming.realtimeEvent && Object.keys(incoming.reactions ?? {}).length === 0
            ? messages[existingIndex].reactions ?? {}
            : incoming.reactions,
        pending: false,
        failed: false,
      }

      return {
        ...previous,
        [roomId]: nextMessages,
      }
    })

    setRooms((previous) =>
      previous.map((room) =>
        room.id === roomId
          ? {
              ...room,
              lastMessage:
                isCreatedEvent
                  ? incoming.type === 'IMAGE'
                    ? '사진을 보냈습니다.'
                    : incoming.content || room.lastMessage
                  : room.lastMessage,
              unreadCount:
                !isCreatedEvent
                  ? room.unreadCount ?? 0
                  : roomId === selectedRoomId || incoming.senderId === userProfile.id
                    ? 0
                    : (room.unreadCount ?? 0) + 1,
            }
          : room,
      ),
    )
  }, [selectedRoomId, userProfile.id])

  const handleRealtimeTyping = useCallback((payload) => {
    const userId = payload?.userId ?? payload?.senderId
    const roomId = payload?.roomId

    if (!userId || userId === userProfile.id || roomId !== selectedRoomId) return

    const timerKey = `${roomId}:${userId}`
    window.clearTimeout(typingTimersRef.current.get(timerKey))

    setTypingUsers((previous) => {
      const withoutUser = previous.filter((user) => user.id !== userId)
      return payload.typing === false
        ? withoutUser
        : [...withoutUser, { id: userId, nickname: payload.nickname ?? '참여자' }]
    })

    if (payload.typing !== false) {
      const timer = window.setTimeout(() => {
        setTypingUsers((previous) => previous.filter((user) => user.id !== userId))
        typingTimersRef.current.delete(timerKey)
      }, 5500)
      typingTimersRef.current.set(timerKey, timer)
    }
  }, [selectedRoomId, userProfile.id])

  const handleRealtimeReaction = useCallback((payload) => {
    const roomId = payload?.roomId
    const messageId = payload?.messageId
    const emoji = payload?.emoji
    const userIds = Array.isArray(payload?.userIds)
      ? payload.userIds
      : []

    if (!roomId || !messageId || !emoji) return

    setMessagesByRoom((previous) => {
      const roomMessages = previous[roomId] ?? []
      const messageIndex = roomMessages.findIndex(
        (message) => String(message.id) === String(messageId),
      )

      if (messageIndex < 0) return previous

      const nextMessages = [...roomMessages]
      const target = nextMessages[messageIndex]
      const reactions = { ...(target.reactions ?? {}) }

      if (userIds.length > 0) reactions[emoji] = userIds
      else delete reactions[emoji]

      nextMessages[messageIndex] = { ...target, reactions }

      return {
        ...previous,
        [roomId]: nextMessages,
      }
    })
  }, [])

  const handleRealtimeRead = useCallback((payload) => {
    const roomId = payload?.roomId
    const unreadCounts = payload?.unreadCounts

    if (!roomId || !unreadCounts || typeof unreadCounts !== 'object') return

    setMessagesByRoom((previous) => {
      const roomMessages = previous[roomId] ?? []
      if (roomMessages.length > 0) {
        const knownIds = new Set(roomMessages.map((message) => String(message.id)))
        Object.entries(unreadCounts).forEach(([messageId, count]) => {
          if (!knownIds.has(String(messageId))) {
            unreadCountUpdatesRef.current.set(`${roomId}:${messageId}`, Number(count))
          }
        })
      }
      let changed = false
      const nextMessages = roomMessages.map((message) => {
        const nextCount = unreadCounts[message.id] ?? unreadCounts[String(message.id)]
        if (nextCount == null) {
          return message
        }
        unreadCountUpdatesRef.current.delete(`${roomId}:${message.id}`)
        if (Number(nextCount) === Number(message.unreadCount ?? 0)) return message
        changed = true
        return { ...message, unreadCount: Number(nextCount) }
      })

      return changed
        ? { ...previous, [roomId]: nextMessages }
        : previous
    })
  }, [])

  const handleRealtimeRoomEvent = useCallback((payload) => {
    const roomId = payload?.roomId
    const eventType = payload?.eventType
    if (!roomId || !eventType) return

    if (eventType === 'ROOM_UPDATED') {
      setRooms((previous) => previous.map((room) => (
        String(room.id) === String(roomId)
          ? { ...room, name: payload.roomName || room.name }
          : room
      )))
      return
    }

    if (eventType === 'MEMBER_LEFT') {
      setBaseMembers((previous) => previous.filter(
        (member) => String(member.id) !== String(payload.actorId),
      ))
      setRooms((previous) => previous.map((room) => (
        String(room.id) === String(roomId)
          ? { ...room, memberCount: Math.max(0, (room.memberCount ?? 1) - 1) }
          : room
      )))

      if (String(payload.actorId) !== String(userProfile.id)) return
    }

    if (
      eventType === 'ROOM_DELETED' ||
      (eventType === 'MEMBER_LEFT' && String(payload.actorId) === String(userProfile.id))
    ) {
      setRooms((previous) => previous.filter((room) => String(room.id) !== String(roomId)))
      setMessagesByRoom((previous) => {
        const next = { ...previous }
        delete next[roomId]
        delete next[String(roomId)]
        return next
      })
      setSelectedRoomId((current) => (
        String(current) === String(roomId) ? null : current
      ))
      setWorkspaceMode(isGuest ? 'chat' : 'home')
      setModal(null)
    }
  }, [isGuest, userProfile.id])

  const {
    connectionState: chatConnectionState,
    sendMessage: sendRealtimeMessage,
    sendTyping: sendRealtimeTyping,
    sendReaction: sendRealtimeReaction,
    sendRead: sendRealtimeRead,
    sendPresence: sendRealtimePresence,
  } = useRealtimeChat({
    accessToken: USE_MOCK_CHAT ? null : authSession?.accessToken,
    roomIds: rooms.map((room) => room.id),
    onMessage: handleRealtimeMessage,
    onTyping: handleRealtimeTyping,
    onReaction: handleRealtimeReaction,
    onRead: handleRealtimeRead,
    onPresence: applyRealtimePresence,
    onRoomEvent: handleRealtimeRoomEvent,
  })

  /*
   * 서버 CONNECT 이벤트는 구독 완료보다 먼저 도착할 수 있습니다.
   * 연결이 완성된 뒤 현재 상태를 한 번 더 발행하고 친구/참여자 상태를
   * 재조회해 새 탭에서도 기존 접속자의 presence 스냅샷을 복구합니다.
   */
  useEffect(() => {
    if (
      USE_MOCK_CHAT ||
      chatConnectionState !== 'connected' ||
      !authSession?.accessToken
    ) {
      return undefined
    }

    const controller = new AbortController()
    const refreshTimer = window.setTimeout(() => {
      sendRealtimePresence({
        presence: PRESENCE_KEYS.has(userProfile.presence)
          ? userProfile.presence
          : 'ONLINE',
      })

      if (!isGuest) {
        refreshSocialData(controller.signal).catch((error) => {
          if (error?.name !== 'AbortError') {
            console.error('실시간 연결 후 친구 상태 동기화 실패:', error)
          }
        })
      }

      if (selectedRoomId) {
        getRoomMembers(
          authSession.accessToken,
          selectedRoomId,
          controller.signal,
        )
          .then((serverMembers) => {
            setBaseMembers(serverMembers)
            setPresenceDirectory((previous) => ({
              ...previous,
              ...createPresenceDirectory(serverMembers),
            }))
          })
          .catch((error) => {
            if (error?.name !== 'AbortError') {
              console.error('실시간 연결 후 참여자 상태 동기화 실패:', error)
            }
          })
      }
    }, 120)

    return () => {
      window.clearTimeout(refreshTimer)
      controller.abort()
    }
  }, [chatConnectionState])

  useEffect(() => {
    if (USE_MOCK_CHAT || !authSession?.accessToken) return undefined

    const controller = new AbortController()

    getMyRooms(authSession.accessToken, controller.signal)
      .then((serverRooms) => {
        setRooms(serverRooms)

        if (isGuest && serverRooms.length === 1) {
          setSelectedRoomId(serverRooms[0].id)
          setWorkspaceMode('chat')
        }
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          console.error('채팅방 목록 조회 실패:', error)
        }
      })

    return () => controller.abort()
  }, [authSession?.accessToken, isGuest])

  useEffect(() => {
    if (USE_MOCK_CHAT || !authSession?.accessToken || !selectedRoomId) return undefined

    const controller = new AbortController()

    Promise.all([
      getRoomMessages(authSession.accessToken, selectedRoomId, controller.signal),
      getRoomMembers(authSession.accessToken, selectedRoomId, controller.signal),
    ])
      .then(([serverMessages, serverMembers]) => {
        setMessagesByRoom((previous) => ({
          ...previous,
          [selectedRoomId]: serverMessages,
        }))
        setBaseMembers(serverMembers)
        setPresenceDirectory((previous) => ({
          ...previous,
          ...createPresenceDirectory(serverMembers),
        }))
      })
      .catch((error) => {
        if (error?.name !== 'AbortError') {
          console.error('채팅방 데이터 조회 실패:', error)
        }
      })

    return () => controller.abort()
  }, [authSession?.accessToken, selectedRoomId])

  useEffect(() => {
    setTypingUsers([])
  }, [selectedRoomId])

  useEffect(() => () => {
    typingTimersRef.current.forEach((timer) => window.clearTimeout(timer))
    typingTimersRef.current.clear()
  }, [])

  /*
   * 현재 사용자 입력 상태.
   */
  const [
    localTyping,
    setLocalTyping,
  ] = useState(false)

  const [
    aiAnalyzingRoomId,
    setAiAnalyzingRoomId,
  ] = useState(null)

  const [
    memberDrawerOpen,
    setMemberDrawerOpen,
  ] = useState(false)

  const [modal, setModal] =
    useState(null)

  const [accountActionSubmitting, setAccountActionSubmitting] =
    useState(false)

  const [accountActionError, setAccountActionError] =
    useState('')

  const [
    kickTarget,
    setKickTarget,
  ] = useState(null)

  const [
    kickedNotice,
    setKickedNotice,
  ] = useState(null)

  const processedRoomEventIds = useRef(new Set())

  const [
    aiDetailMovie,
    setAiDetailMovie,
  ] = useState(null)

  /*
   * 참여자 입장/퇴장/강퇴 이벤트 처리.
   * Mock에서는 CustomEvent/BroadcastChannel로 검증하고,
   * 실제 연결 시 WebSocket payload를 같은 형태로 전달한다.
   */
  useEffect(() => {
    const supportedEvents = new Set([
      'MEMBER_JOINED',
      'MEMBER_LEFT',
      'MEMBER_KICKED',
    ])

    const applyRoomMemberEvent = (payload) => {
      if (!payload || !supportedEvents.has(payload.type) || !payload.roomId) return

      const eventId = payload.eventId ?? `${payload.type}-${payload.roomId}-${payload.memberId}-${Date.now()}`
      if (processedRoomEventIds.current.has(eventId)) return
      processedRoomEventIds.current.add(eventId)
      const eventConfig = {
        MEMBER_JOINED: {
          content: `${payload.memberName}님이 입장했습니다.`,
          systemEvent: 'JOIN',
          memberDelta: 1,
        },
        MEMBER_LEFT: {
          content: `${payload.memberName}님이 퇴장했습니다.`,
          systemEvent: 'LEAVE',
          memberDelta: -1,
        },
        MEMBER_KICKED: {
          content: `${payload.memberName}님이 강퇴당했습니다.`,
          systemEvent: 'KICK',
          memberDelta: -1,
        },
      }[payload.type]

      setMessagesByRoom((previous) => {
        const roomMessages = previous[payload.roomId] ?? []
        if (roomMessages.some((message) => message.eventId === eventId)) return previous

        return {
          ...previous,
          [payload.roomId]: [
            ...roomMessages,
            {
              id: eventId,
              eventId,
              senderId: 0,
              senderName: 'System',
              content: eventConfig.content,
              sentAt: '',
              type: 'SYSTEM',
              systemEvent: eventConfig.systemEvent,
            },
          ],
        }
      })

      setBaseMembers((previous) => {
        if (payload.type === 'MEMBER_JOINED') {
          if (previous.some((member) => member.id === payload.memberId)) return previous
          return [
            ...previous,
            payload.member ?? {
              id: payload.memberId,
              nickname: payload.memberName,
              role: 'MEMBER',
              presence: 'ONLINE',
              profileImageUrl: null,
              statusMessage: '',
            },
          ]
        }

        return previous.filter((member) => member.id !== payload.memberId)
      })

      const currentUserRemoved =
        payload.memberId === userProfile.id &&
        (payload.type === 'MEMBER_LEFT' || payload.type === 'MEMBER_KICKED')

      setRooms((previous) =>
        currentUserRemoved
          ? previous.filter((room) => room.id !== payload.roomId)
          : previous.map((room) =>
              room.id === payload.roomId
                ? {
                    ...room,
                    memberCount: Math.max(0, (room.memberCount ?? 0) + eventConfig.memberDelta),
                  }
                : room,
            ),
      )

      if (payload.type !== 'MEMBER_KICKED' || payload.memberId !== userProfile.id) {
        if (currentUserRemoved) {
          setSelectedRoomId(null)
          setMemberDrawerOpen(false)
          setWorkspaceMode('home')
        }
        return
      }

      setKickedNotice({
        roomId: payload.roomId,
        roomName: payload.roomName,
        reason: payload.reason?.trim() ?? '',
      })
      setSelectedRoomId(null)
      setMemberDrawerOpen(false)
      setWorkspaceMode('home')
    }

    const handleWindowMemberEvent = (event) => applyRoomMemberEvent(event.detail)
    window.addEventListener('meetuplog:room-member-event', handleWindowMemberEvent)

    let roomEventChannel = null
    if ('BroadcastChannel' in window) {
      roomEventChannel = new BroadcastChannel('meetuplog-room-events')
      roomEventChannel.addEventListener('message', (event) => {
        applyRoomMemberEvent(event.data)
      })
    }

    return () => {
      window.removeEventListener('meetuplog:room-member-event', handleWindowMemberEvent)
      roomEventChannel?.close()
    }
  }, [userProfile.id])

  const [
    replyTarget,
    setReplyTarget,
  ] = useState(null)

  const [
    editingMessage,
    setEditingMessage,
  ] = useState(null)

  const [
    editMessageDraft,
    setEditMessageDraft,
  ] = useState('')

  const [
    deleteMessageTarget,
    setDeleteMessageTarget,
  ] = useState(null)

  const selectedRoom =
    useMemo(() => {
      if (
        selectedRoomId === null
      ) {
        return null
      }

      return (
        rooms.find(
          (room) =>
            room.id ===
            selectedRoomId,
        ) ?? null
      )
    }, [
      rooms,
      selectedRoomId,
    ])

  /*
   * 참여자 목록의 현재 사용자는
   * 프로필/상태 변경 즉시 반영한다.
   */
  const members =
    useMemo(() => {
      return baseMembers.map(
        (member) => {
          if (
            member.id !==
            userProfile.id
          ) {
            return {
              ...member,
              presence: resolvePresence(presenceDirectory, member),
            }
          }

          return {
            ...member,
            nickname:
              userProfile.nickname,
            presence:
              userProfile.presence,
            profileImageUrl:
              userProfile.profileImageUrl,
            statusMessage:
              userProfile.statusMessage,
          }
        },
      )
    }, [
      baseMembers,
      presenceDirectory,
      userProfile,
    ])

  const roomTheme =
    selectedRoom
      ? getRoomTheme(
          selectedRoom.topicType,
        )
      : getRoomTheme('ETC')

  const currentMessages =
    selectedRoom
      ? messagesByRoom[
          selectedRoom.id
        ] ?? []
      : []

  useEffect(() => {
    if (
      USE_MOCK_CHAT ||
      chatConnectionState !== 'connected' ||
      !selectedRoom?.id
    ) {
      return
    }

    const latestMessage = [...currentMessages]
      .reverse()
      .find((message) => Number.isFinite(Number(message.id)) && !message.pending)

    if (!latestMessage) return

    const roomKey = String(selectedRoom.id)
    const messageKey = String(latestMessage.id)
    if (lastReadSentRef.current.get(roomKey) === messageKey) return

    const sent = sendRealtimeRead({
      roomId: selectedRoom.id,
      lastReadMessageId: Number(latestMessage.id),
    })

    if (sent) {
      lastReadSentRef.current.set(roomKey, messageKey)
    }
  }, [
    chatConnectionState,
    currentMessages,
    selectedRoom?.id,
    sendRealtimeRead,
  ])

  const isOwner =
    selectedRoom?.myRole === 'OWNER' || members.some(
      (member) =>
        member.id === userProfile.id &&
        member.role === 'OWNER',
    ) || (USE_MOCK_CHAT && userProfile.role === 'OWNER')

  const aiAnalyzing =
    selectedRoom
      ? aiAnalyzingRoomId ===
        selectedRoom.id
      : false

  const unreadNotificationCount =
    notifications.filter(
      (notification) =>
        !notification.read,
    ).length

  const participantTypingUsers =
    useMemo(() => {
      const map = new Map()

      typingUsers.forEach(
        (user) => {
          map.set(
            user.id,
            user,
          )
        },
      )

      if (localTyping) {
        map.set(
          userProfile.id,
          {
            id: userProfile.id,
            nickname:
              userProfile.nickname,
          },
        )
      }

      return Array.from(
        map.values(),
      )
    }, [
      typingUsers,
      localTyping,
      userProfile.id,
      userProfile.nickname,
    ])

  const handleSelectRoom = (
    roomId,
  ) => {
    setLocalTyping(false)
    setReplyTarget(null)
    setEditingMessage(null)
    setDeleteMessageTarget(null)
    setSelectedRoomId(roomId)
    setWorkspaceMode('chat')

    setRooms((previous) =>
      previous.map((room) =>
        room.id === roomId
          ? {
              ...room,
              unreadCount: 0,
            }
          : room,
      ),
    )
  }

  const handleTypingChange = useCallback((typing) => {
    setLocalTyping(typing)

    if (USE_MOCK_CHAT || !selectedRoomId) return

    sendRealtimeTyping({
      roomId: selectedRoomId,
      userId: userProfile.id,
      nickname: userProfile.nickname,
      typing,
    })
  }, [selectedRoomId, sendRealtimeTyping, userProfile.id, userProfile.nickname])

  const handleHome = () => {
    if (isGuest) {
      setSelectedRoomId(
        sessionRooms[0]?.id ?? null,
      )
      setWorkspaceMode('chat')
      return
    }

    setLocalTyping(false)
    setReplyTarget(null)
    setEditingMessage(null)
    setDeleteMessageTarget(null)
    setSelectedRoomId(null)
    setWorkspaceMode('home')
  }

  const handleChangeMenu = (
    menu,
  ) => {
    setActiveMenu(menu)
  }

  const openWorkspacePage = (
    nextMode,
  ) => {
    setReturnWorkspaceMode(
      workspaceMode,
    )

    setWorkspaceMode(nextMode)
  }

  const closeWorkspacePage =
    () => {
      setWorkspaceMode(
        returnWorkspaceMode,
      )
    }

  const handlePresenceChange = (
    presence,
  ) => {
    if (!PRESENCE_KEYS.has(presence)) {
      return
    }

    const identities = getPresenceIdentities(userProfile)

    setUserProfile(
      (previous) => ({
        ...previous,
        presence,
      }),
    )

    if (identities.length > 0) {
      setPresenceDirectory((previous) => {
        const next = { ...previous }
        identities.forEach((identity) => {
          next[identity] = presence
        })
        return next
      })

      const payload = {
        identity: identities[0],
        userId: userProfile.id,
        accountId: userProfile.accountId,
        email: userProfile.email,
        presence,
        changedAt: new Date().toISOString(),
      }

      window.dispatchEvent(
        new CustomEvent('meetuplog:presence-change', {
          detail: payload,
        }),
      )

      if ('BroadcastChannel' in window) {
        const channel = new BroadcastChannel('meetuplog-presence')
        channel.postMessage(payload)
        channel.close()
      }
    }

    if (!USE_MOCK_CHAT) {
      sendRealtimePresence({ presence })
    }
  }

  const handleProfileSave = async (
    values,
  ) => {
    const updatedProfile =
      await updateMyProfile(
        authSession.accessToken,
        values,
      )

    setUserProfile((previous) => ({
      ...previous,
      ...updatedProfile,
      id:
        updatedProfile.userId ??
        updatedProfile.id ??
        previous.id,
      role: previous.role,
      presence: previous.presence,
    }))

    setBaseMembers((previous) =>
      previous.map((member) =>
        member.id === userProfile.id
          ? {
              ...member,
              nickname: updatedProfile.nickname,
              profileImageUrl: updatedProfile.profileImageUrl,
              statusMessage: updatedProfile.statusMessage,
            }
          : member,
      ),
    )

    setWorkspaceMode(returnWorkspaceMode)
    return updatedProfile
  }

  const handleGuestConversion = async (values) => {
    const response = await convertGuestAccount(
      authSession.accessToken,
      values,
    )

    const nextUser = {
      ...userProfile,
      id: response?.userId ?? response?.id ?? userProfile.id,
      accountId:
        response?.accountId ??
        userProfile.accountId,
      email: response?.email ?? values.email,
      nickname: response?.nickname ?? values.nickname,
      accountType: response?.accountType ?? 'MEMBER',
      role: 'MEMBER',
      statusMessage: response?.statusMessage ?? '',
      kakaoLinked: false,
    }

    const nextSession = {
      ...authSession,
      type: 'member',
      provider: 'LOCAL',
      accessToken:
        response?.accountToken ??
        response?.accessToken ??
        authSession.accessToken,
      user: nextUser,
    }

    onSessionChange?.(nextSession, true)
    return nextSession
  }

  const updateMessageInRoom = (
    roomId,
    messageId,
    updater,
  ) => {
    setMessagesByRoom(
      (previous) => ({
        ...previous,

        [roomId]: (
          previous[
            roomId
          ] ?? []
        ).map(
          (message) =>
            message.id ===
            messageId
              ? updater(
                  message,
                )
              : message,
        ),
      }),
    )
  }

  const scheduleMockReadReceipts = (
    roomId,
    messageId,
  ) => {
    /*
     * 실제 구현에서는 WebSocket READ 이벤트로 교체.
     * 현재 Mock에서는 새 메시지의 안 읽은 인원이
     * 순차적으로 감소하는 모습을 확인할 수 있다.
     */
    const delays = [
      1800,
      3600,
      5600,
    ]

    delays.forEach(
      (delay) => {
        window.setTimeout(
          () => {
            updateMessageInRoom(
              roomId,
              messageId,
              (message) => ({
                ...message,

                unreadCount:
                  Math.max(
                    0,
                    Number(
                      message.unreadCount ??
                      0,
                    ) - 1,
                  ),
              }),
            )
          },
          delay,
        )
      },
    )
  }

  const handleSend = (
    content,
    replyToId = null,
  ) => {
    if (!selectedRoom || !content?.trim()) return

    const now = new Date()
    const clientMessageKey =
      globalThis.crypto?.randomUUID?.() ??
      `message-${userProfile.id}-${now.getTime()}`
    const messageId = `pending-${clientMessageKey}`
    const unreadCount = Math.max(0, members.length - 1)
    const newMessage = {
      id: messageId,
      roomId: selectedRoom.id,
      senderId: userProfile.id,
      senderName: userProfile.nickname,
      content: content.trim(),
      sentAt: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
      type: 'TEXT',
      unreadCount,
      replyToId,
      clientMessageKey,
      pending: !USE_MOCK_CHAT,
    }

    setMessagesByRoom((previous) => ({
      ...previous,
      [selectedRoom.id]: [
        ...(previous[selectedRoom.id] ?? []),
        newMessage,
      ],
    }))

    setRooms((previous) =>
      previous.map((room) =>
        room.id ===
        selectedRoom.id
          ? {
              ...room,
              lastMessage: content.trim(),
            }
          : room,
      ),
    )

    setReplyTarget(null)
    setEditingMessage(null)

    if (USE_MOCK_CHAT && unreadCount > 0) {
      scheduleMockReadReceipts(
        selectedRoom.id,
        messageId,
      )
    }

    if (!USE_MOCK_CHAT) {
      const sent = sendRealtimeMessage({
        roomId: selectedRoom.id,
        messageType: 'TEXT',
        content: content.trim(),
        replyToMessageId: replyToId,
        clientMessageKey,
      })

      if (!sent) {
        updateMessageInRoom(selectedRoom.id, messageId, (message) => ({
          ...message,
          pending: false,
          failed: true,
        }))
      }
    }
  }

  const handleSendImage = async (
    attachment,
    replyToId = null,
  ) => {
    if (
      !selectedRoom ||
      !attachment?.file
    ) {
      return
    }

    let uploaded

    if (USE_MOCK_CHAT) {
      const imageUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '')
        reader.onerror = () => reject(new Error('이미지를 읽지 못했습니다.'))
        reader.readAsDataURL(attachment.file)
      })
      uploaded = {
        imageUrl,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        size: attachment.size,
      }
    } else {
      uploaded = await uploadChatImage(
        authSession.accessToken,
        selectedRoom.id,
        attachment.file,
      )
    }

    const now = new Date()

    const time = `${String(
      now.getHours(),
    ).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`

    const clientMessageKey =
      globalThis.crypto?.randomUUID?.() ??
      `image-${userProfile.id}-${now.getTime()}`

    const messageId = USE_MOCK_CHAT
      ? Date.now()
      : `pending-${clientMessageKey}`

    const unreadCount =
      Math.max(
        0,
        members.length - 1,
      )

    const newMessage = {
      id: messageId,
      senderId:
        userProfile.id,
      senderName:
        userProfile.nickname,
      content:
        uploaded.fileName ||
        '사진',
      sentAt: time,
      type: 'IMAGE',
      imageUrl:
        uploaded.imageUrl,
      imageMimeType:
        uploaded.mimeType,
      imageSize:
        uploaded.size,
      unreadCount,
      replyToId,
      clientMessageKey,
      pending: !USE_MOCK_CHAT,
    }

    setMessagesByRoom(
      (previous) => ({
        ...previous,
        [selectedRoom.id]: [
          ...(previous[
            selectedRoom.id
          ] ?? []),
          newMessage,
        ],
      }),
    )

    setRooms((previous) =>
      previous.map((room) =>
        room.id ===
        selectedRoom.id
          ? {
              ...room,
              lastMessage:
                '사진을 보냈습니다.',
            }
          : room,
      ),
    )

    setReplyTarget(null)
    setEditingMessage(null)

    if (USE_MOCK_CHAT && unreadCount > 0) {
      scheduleMockReadReceipts(
        selectedRoom.id,
        messageId,
      )
    }

    if (!USE_MOCK_CHAT) {
      const sent = sendRealtimeMessage({
        roomId: selectedRoom.id,
        messageType: 'IMAGE',
        content: uploaded.fileName || '사진',
        imageUrl: uploaded.serverImageUrl ?? uploaded.imageUrl,
        imageMimeType: uploaded.mimeType,
        imageSize: uploaded.size,
        replyToMessageId: replyToId,
        clientMessageKey,
      })

      if (!sent) {
        updateMessageInRoom(selectedRoom.id, messageId, (message) => ({
          ...message,
          pending: false,
          failed: true,
        }))
        throw new Error('실시간 채팅 연결을 확인한 뒤 다시 보내주세요.')
      }
    }
  }

  const handleReplyMessage = (
    message,
  ) => {
    if (
      !message ||
      message.deleted
    ) {
      return
    }

    setEditingMessage(null)
    setReplyTarget(message)
  }

  const handleEditMessage = (
    message,
  ) => {
    if (
      !message ||
      message.deleted ||
      message.senderId !==
        userProfile.id
    ) {
      return
    }

    setReplyTarget(null)
    setEditingMessage(message)
    setEditMessageDraft(
      message.content,
    )
    setModal('EDIT_MESSAGE')
  }

  const handleSaveEdit = async (
    messageId,
    content,
  ) => {
    if (!selectedRoom) {
      return
    }

    const roomId = selectedRoom.id

    try {
      const saved = USE_MOCK_CHAT
        ? { content, edited: true, deleted: false }
        : await editChatMessage(
            authSession.accessToken,
            roomId,
            messageId,
            content,
          )

      updateMessageInRoom(
        roomId,
        messageId,
        (message) => {
          if (message.senderId !== userProfile.id || message.deleted) return message
          return { ...message, ...saved, content, edited: true, pending: false }
        },
      )
    } catch (error) {
      window.alert(error?.message || '메시지를 수정하지 못했습니다.')
      return false
    }

    setEditingMessage(null)
    setEditMessageDraft('')
    setReplyTarget(null)

    setRooms((previous) =>
      previous.map((room) => {
        if (
          room.id !==
          selectedRoom.id
        ) {
          return room
        }

        const roomMessages =
          messagesByRoom[
            selectedRoom.id
          ] ?? []

        const lastTextMessage =
          [...roomMessages]
            .reverse()
            .find(
              (message) =>
                message.type ===
                'TEXT' &&
                !message.deleted,
            )

        if (
          lastTextMessage?.id !==
          messageId
        ) {
          return room
        }

        return {
          ...room,
          lastMessage:
            content,
        }
      }),
    )

    return true
  }

  const requestDeleteMessage = (
    message,
  ) => {
    if (
      !message ||
      message.deleted ||
      message.senderId !==
        userProfile.id
    ) {
      return
    }

    setDeleteMessageTarget(
      message,
    )

    setModal(
      'DELETE_MESSAGE',
    )
  }

  const confirmDeleteMessage =
    async () => {
      if (
        !selectedRoom ||
        !deleteMessageTarget
      ) {
        setModal(null)
        return
      }

      const messageId =
        deleteMessageTarget.id

      try {
        if (!USE_MOCK_CHAT) {
          await deleteChatMessage(
            authSession.accessToken,
            selectedRoom.id,
            messageId,
          )
        }
      } catch (error) {
        window.alert(error?.message || '메시지를 삭제하지 못했습니다.')
        return
      }

      updateMessageInRoom(
        selectedRoom.id,
        messageId,
        (message) => ({
          ...message,
          content: '',
          deleted: true,
          edited: false,
        }),
      )

      if (
        editingMessage?.id ===
        messageId
      ) {
        setEditingMessage(
          null,
        )
      }

      if (
        replyTarget?.id ===
        messageId
      ) {
        setReplyTarget(
          null,
        )
      }

      setDeleteMessageTarget(
        null,
      )

      setModal(null)
    }

  const cancelMessageContext =
    () => {
      setReplyTarget(null)
      setEditingMessage(null)
    }

  const handleToggleReaction = (
    messageId,
    emoji,
  ) => {
    if (!selectedRoom) {
      return
    }

    updateMessageInRoom(
      selectedRoom.id,
      messageId,
      (message) => {
        if (
          message.deleted
        ) {
          return message
        }

        const reactions = {
          ...(
            message.reactions ??
            {}
          ),
        }

        const currentUsers =
          Array.isArray(
            reactions[
              emoji
            ],
          )
            ? [
                ...reactions[
                  emoji
                ],
              ]
            : []

        const alreadyReacted =
          currentUsers.includes(
            userProfile.id,
          )

        const nextUsers =
          alreadyReacted
            ? currentUsers.filter(
                (userId) =>
                  userId !==
                  userProfile.id,
              )
            : [
                ...currentUsers,
                userProfile.id,
              ]

        if (
          nextUsers.length ===
          0
        ) {
          delete reactions[
            emoji
          ]
        } else {
          reactions[
            emoji
          ] = nextUsers
        }

        return {
          ...message,
          reactions,
        }
      },
    )

    if (!USE_MOCK_CHAT) {
      sendRealtimeReaction({
        roomId: selectedRoom.id,
        messageId,
        emoji,
      })
    }
  }


  const handleRecommend =
    () => {
      if (
        !selectedRoom ||
        !roomTheme.aiSupported ||
        aiAnalyzingRoomId !==
          null
      ) {
        return
      }

      const targetRoomId =
        selectedRoom.id

      setAiAnalyzingRoomId(
        targetRoomId,
      )

      setTimeout(() => {
        setAiAnalyzingRoomId(
          null,
        )

        setMessagesByRoom(
          (previous) => ({
            ...previous,

            [targetRoomId]: [
              ...(previous[
                targetRoomId
              ] ?? []),

              {
                id: Date.now(),
                type:
                  'AI_RESULT',
                movies:
                  mockAiMovies,
              },
            ],
          }),
        )
      }, 3500)
    }

  const handleCreateRoom = async ({
    name,
    topicType,
    maxMembers,
  }) => {
    if (!USE_MOCK_CHAT && authSession?.accessToken) {
      try {
        const newRoom = await createChatRoom(authSession.accessToken, {
          name,
          topicType,
          maxMembers,
        })

        setRooms((previous) => [
          newRoom,
          ...previous.filter((room) => room.id !== newRoom.id),
        ])
        setMessagesByRoom((previous) => ({
          ...previous,
          [newRoom.id]: previous[newRoom.id] ?? [],
        }))
        setModal(null)
        setActiveMenu('chat')
        setSelectedRoomId(newRoom.id)
        setWorkspaceMode('chat')
        return
      } catch (error) {
        console.error('채팅방 생성 실패:', error)
        window.alert(error?.message ?? '채팅방을 만들지 못했습니다.')
        return
      }
    }

    const newRoomId =
      rooms.length > 0
        ? Math.max(
            ...rooms.map(
              (room) =>
                room.id,
            ),
          ) + 1
        : 1

    const newRoom = {
      id: newRoomId,
      name,
      topicType,

      lastMessage:
        '새 채팅방이 생성되었습니다.',

      unreadCount: 0,
      memberCount: 1,
      maxMembers,
    }

    setRooms((previous) => [
      newRoom,
      ...previous,
    ])

    setMessagesByRoom(
      (previous) => ({
        ...previous,

        [newRoomId]: [
          {
            id: Date.now(),

            senderId: 0,

            senderName:
              'System',

            content:
              `${userProfile.nickname}님이 채팅방을 만들었습니다.`,

            sentAt: '',

            type: 'SYSTEM',
          },
        ],
      }),
    )

    setModal(null)
    setActiveMenu('chat')
    setSelectedRoomId(
      newRoomId,
    )
    setWorkspaceMode('chat')
  }

  const handleKickMember = (
    member,
    reason = '',
  ) => {
    if (!member) {
      return
    }

    const kickPayload = {
      type: 'MEMBER_KICKED',
      eventId: `kick-${selectedRoomId}-${member.id}-${Date.now()}`,
      roomId: selectedRoom?.id ?? selectedRoomId,
      roomName: selectedRoom?.name ?? '채팅방',
      memberId: member.id,
      memberName: member.nickname,
      reason: reason.trim(),
    }

    window.dispatchEvent(
      new CustomEvent('meetuplog:room-member-event', { detail: kickPayload }),
    )

    if ('BroadcastChannel' in window) {
      const roomEventChannel = new BroadcastChannel('meetuplog-room-events')
      roomEventChannel.postMessage(kickPayload)
      roomEventChannel.close()
    }

    setKickTarget(null)
  }

  const handleInviteFriend = async (friend) => {
    if (!friend || !selectedRoomId) return

    try {
      if (!USE_MOCK_CHAT) {
        await sendRoomMemberInvite(authSession.accessToken, selectedRoomId, friend.id)
      }
      setPendingInvitesByRoom((previous) => {
        const roomInvites = previous[selectedRoomId] ?? []
        if (roomInvites.includes(friend.id)) return previous
        return { ...previous, [selectedRoomId]: [...roomInvites, friend.id] }
      })
    } catch (error) {
      window.alert(error.message)
    }
  }

  const issueRoomInviteLink = async () => {
    if (!selectedRoomId || inviteLinkBusy) return
    setInviteLinkBusy(true)
    try {
      const link = USE_MOCK_CHAT
        ? { invitePath: '/invite/demo-token', maxUses: 50 }
        : await createRoomInviteLink(authSession.accessToken, selectedRoomId, {
            expiresInHours: 24,
            maxUses: 50,
          })
      setInviteLinksByRoom((previous) => ({ ...previous, [selectedRoomId]: link }))
      return link
    } finally {
      setInviteLinkBusy(false)
    }
  }

  const handleCreateInviteLink = async () => {
    try {
      await issueRoomInviteLink()
    } catch (error) {
      window.alert(error.message)
    }
  }

  const handleLoadActiveInviteLink = async () => {
    if (!selectedRoomId || USE_MOCK_CHAT) return inviteLinksByRoom[selectedRoomId] ?? null
    const activeLink = await getActiveRoomInviteLink(
      authSession.accessToken,
      selectedRoomId,
    )
    setInviteLinksByRoom((previous) => {
      const current = previous[selectedRoomId]
      const next = activeLink && current?.inviteId === activeLink.inviteId
        ? { ...activeLink, invitePath: current.invitePath, inviteToken: current.inviteToken }
        : activeLink
      return { ...previous, [selectedRoomId]: next }
    })
    return activeLink
  }

  const handleRevokeInviteLink = async () => {
    const inviteLink = inviteLinksByRoom[selectedRoomId]
    if (!inviteLink?.inviteId) return
    if (!USE_MOCK_CHAT) {
      await revokeRoomInviteLink(
        authSession.accessToken,
        selectedRoomId,
        inviteLink.inviteId,
      )
    }
    setInviteLinksByRoom((previous) => ({ ...previous, [selectedRoomId]: null }))
  }

  const handleUpdateRoomNotification = async (mode) => {
    let setting
    if (USE_MOCK_CHAT) {
      const now = Date.now()
      const durations = {
        MUTE_30_MINUTES: 30 * 60 * 1000,
        MUTE_1_HOUR: 60 * 60 * 1000,
        MUTE_2_HOURS: 2 * 60 * 60 * 1000,
      }
      setting = {
        notificationSetting: mode === 'MUTE_UNTIL_ENABLED' ? 'OFF' : 'ALL',
        mutedUntil: durations[mode]
          ? new Date(now + durations[mode]).toISOString()
          : null,
        muted: mode !== 'ENABLED',
      }
    } else {
      setting = await updateRoomNotificationSetting(
        authSession.accessToken,
        selectedRoomId,
        mode,
      )
    }

    setRooms((previous) => previous.map((room) => (
      room.id === selectedRoomId
        ? {
            ...room,
            notificationSetting: setting.notificationSetting,
            notificationMutedUntil: setting.mutedUntil,
            notificationsMuted: setting.muted,
          }
        : room
    )))
  }

  const handleLoadRoomNotification = async () => {
    if (USE_MOCK_CHAT) return
    const setting = await getRoomNotificationSetting(
      authSession.accessToken,
      selectedRoomId,
    )
    setRooms((previous) => previous.map((room) => (
      room.id === selectedRoomId
        ? {
            ...room,
            notificationSetting: setting.notificationSetting,
            notificationMutedUntil: setting.mutedUntil,
            notificationsMuted: setting.muted,
          }
        : room
    )))
  }

  const handleRenameRoom = async (roomName) => {
    const updatedRoom = USE_MOCK_CHAT
      ? { ...selectedRoom, name: roomName }
      : await updateChatRoom(authSession.accessToken, selectedRoomId, roomName)
    setRooms((previous) => previous.map((room) => (
      room.id === selectedRoomId ? { ...room, ...updatedRoom } : room
    )))
  }

  const removeRoomFromWorkspace = (roomId) => {
    setRooms((previous) => previous.filter((room) => room.id !== roomId))
    setMessagesByRoom((previous) => {
      const next = { ...previous }
      delete next[roomId]
      return next
    })
    setSelectedRoomId(null)
    setModal(null)
    setWorkspaceMode(isGuest ? 'chat' : 'home')
  }

  const handleDeleteRoom = async () => {
    const roomId = selectedRoomId
    if (!USE_MOCK_CHAT) {
      await deleteChatRoom(authSession.accessToken, roomId)
    }
    removeRoomFromWorkspace(roomId)
  }

  const handleLeaveRoom = async () => {
    const roomId = selectedRoomId
    if (!USE_MOCK_CHAT) {
      await leaveChatRoom(authSession.accessToken, roomId)
    }
    removeRoomFromWorkspace(roomId)
    if (isGuest) onLogout?.()
  }

  const handleAcceptNotification = async (notification) => {
    if (!notification?.actionable) return
    setNotificationActionBusyId(notification.id)
    try {
      if (notification.actionKind === 'FRIEND_REQUEST') {
        const friend = await acceptFriendRequest(authSession.accessToken, notification.referenceId)
        setBaseFriends((previous) => (
          previous.some((item) => item.id === friend.id) ? previous : [...previous, friend]
        ))
      } else if (notification.actionKind === 'ROOM_INVITE') {
        const room = normalizeRoom(
          await acceptRoomMemberInvite(authSession.accessToken, notification.referenceId),
        )
        setRooms((previous) => (
          previous.some((item) => item.id === room.id)
            ? previous.map((item) => item.id === room.id ? room : item)
            : [room, ...previous]
        ))
      }
      setNotifications((previous) => previous.filter((item) => item.id !== notification.id))
    } catch (error) {
      window.alert(error.message)
    } finally {
      setNotificationActionBusyId(null)
    }
  }

  const handleRejectNotification = async (notification) => {
    if (!notification?.actionable) return
    setNotificationActionBusyId(notification.id)
    try {
      if (notification.actionKind === 'FRIEND_REQUEST') {
        await rejectFriendRequest(authSession.accessToken, notification.referenceId)
      } else if (notification.actionKind === 'ROOM_INVITE') {
        await rejectRoomMemberInvite(authSession.accessToken, notification.referenceId)
      }
      setNotifications((previous) => previous.filter((item) => item.id !== notification.id))
    } catch (error) {
      window.alert(error.message)
    } finally {
      setNotificationActionBusyId(null)
    }
  }

  const handleRemoveFriend = async (friend) => {
    if (!window.confirm(`${friend.nickname}님을 친구 목록에서 삭제할까요?`)) return
    try {
      await removeFriend(authSession.accessToken, friend.id)
      setBaseFriends((previous) => previous.filter((item) => item.id !== friend.id))
    } catch (error) {
      window.alert(error.message)
    }
  }

  const handleBlockFriend = async (friend) => {
    const reason = window.prompt(`${friend.nickname}님을 차단할 사유를 입력하세요. (선택)`, '')
    if (reason === null) return
    try {
      await blockFriend(authSession.accessToken, friend.id, reason)
      setBaseFriends((previous) => previous.filter((item) => item.id !== friend.id))
    } catch (error) {
      window.alert(error.message)
    }
  }

  const handleDeleteNotification =
    (notificationId) => {
      setNotifications(
        (previous) =>
          previous.filter(
            (notification) =>
              notification.id !==
              notificationId,
          ),
      )
    }

  const renderMainShell = () => {
    /*
     * CHAT
     */
    if (
      workspaceMode ===
        'chat' &&
      selectedRoom
    ) {
      return (
        <div
          className="chat-room-stage"
          key={selectedRoom.id}
        >
          <ChatHeader
            room={selectedRoom}
            theme={roomTheme}
            memberCount={
              members.length
            }
            isOwner={isOwner}
            onBack={isGuest ? null : handleHome}
            onOpenMembers={() =>
              setMemberDrawerOpen(
                true,
              )
            }
            onOpenRoomMenu={() => setModal('ROOM_MENU')}
          />

          <div className="chat-body">
            <div className="conversation-column">
              <div className="theme-decoration" />

              <MessageList
                messages={
                  currentMessages
                }
                currentUserId={
                  userProfile.id
                }
                onAiDetail={(
                  movie,
                ) =>
                  setAiDetailMovie(
                    movie,
                  )
                }
                onReplyMessage={
                  handleReplyMessage
                }
                onEditMessage={
                  handleEditMessage
                }
                onDeleteMessage={
                  requestDeleteMessage
                }
                onToggleReaction={
                  handleToggleReaction
                }
              />

              <TypingIndicator
                typingUsers={
                  typingUsers
                }
                aiAnalyzing={
                  aiAnalyzing
                }
              />

              <MessageComposer
                onSend={
                  handleSend
                }
                onSendImage={
                  handleSendImage
                }
                onSaveEdit={
                  handleSaveEdit
                }
                onRecommend={
                  handleRecommend
                }
                onTypingChange={
                  handleTypingChange
                }
                onCancelContext={
                  cancelMessageContext
                }
                replyTarget={
                  replyTarget
                }
                editingMessage={
                  modal === 'EDIT_MESSAGE'
                    ? null
                    : editingMessage
                }
                aiSupported={
                  roomTheme.aiSupported
                }
                aiAnalyzing={
                  aiAnalyzing
                }
              />
            </div>

            <MemberPanel
              members={members}
              typingUsers={
                participantTypingUsers
              }
              isOwner={isOwner}
              variant="desktop"
              onRequestKick={
                setKickTarget
              }
              friends={friends}
              onInviteFriend={handleInviteFriend}
              pendingInviteIds={pendingInvitesByRoom[selectedRoomId] ?? []}
              inviteLink={inviteLinksByRoom[selectedRoomId]}
              inviteLinkBusy={inviteLinkBusy}
              onCreateInviteLink={handleCreateInviteLink}
            />
          </div>
        </div>
      )
    }

    /*
     * PROFILE EDIT
     */
    if (
      workspaceMode ===
      'profile-edit'
    ) {
      return (
        <div className="chat-room-stage utility-room-stage">
          <header className="chat-header utility-workspace-header">
            <div className="chat-header-left">
              <div className="chat-room-avatar utility-header-avatar">
                <PencilIcon />
              </div>

              <div className="chat-room-info">
                <div className="chat-room-title-row">
                  <h2>
                    프로필 편집
                  </h2>
                </div>

                <div className="room-theme-description">
                  다른 사람에게 보이는 프로필 정보를 관리합니다
                </div>
              </div>
            </div>

            <button
              type="button"
              className="utility-close-button"
              onClick={
                closeWorkspacePage
              }
            >
              <CloseIcon />
            </button>
          </header>

          <div className="chat-body">
            <div className="conversation-column utility-conversation-column">
              <ProfileEditWorkspace
                user={
                  userProfile
                }
                onBack={
                  closeWorkspacePage
                }
                onSave={
                  handleProfileSave
                }
                onUploadProfileImage={(file) =>
                  uploadProfileImage(
                    authSession.accessToken,
                    file,
                  ).then((profile) => {
                    setUserProfile((previous) => ({
                      ...previous,
                      ...profile,
                      role: previous.role,
                      presence: previous.presence,
                    }))
                    return profile
                  })
                }
                onRemoveProfileImage={() =>
                  removeProfileImage(
                    authSession.accessToken,
                  ).then((profile) => {
                    setUserProfile((previous) => ({
                      ...previous,
                      ...profile,
                      role: previous.role,
                      presence: previous.presence,
                    }))
                    return profile
                  })
                }
                onChangePassword={(values) =>
                  changeMyPassword(
                    authSession.accessToken,
                    values,
                  )
                }
                onDeleteAccount={() =>
                  {
                    setAccountActionError('')
                    setModal('DELETE_ACCOUNT')
                  }
                }
                onUnlinkKakao={() => {
                  setAccountActionError('')
                  setModal('UNLINK_KAKAO')
                }}
                onConvertGuest={
                  handleGuestConversion
                }
              />
            </div>
          </div>
        </div>
      )
    }

    /*
     * FRIEND ADD
     */
    if (
      workspaceMode ===
      'friend-add'
    ) {
      return (
        <div className="chat-room-stage utility-room-stage">
          <header className="chat-header utility-workspace-header">
            <div className="chat-header-left">
              <div className="chat-room-avatar utility-header-avatar">
                <UserPlusIcon />
              </div>

              <div className="chat-room-info">
                <div className="chat-room-title-row">
                  <h2>
                    친구 추가
                  </h2>
                </div>

                <div className="room-theme-description">
                  닉네임이나 이메일로 친구를 찾아보세요
                </div>
              </div>
            </div>

            <button
              type="button"
              className="utility-close-button"
              onClick={
                closeWorkspacePage
              }
            >
              <CloseIcon />
            </button>
          </header>

          <div className="chat-body">
            <div className="conversation-column utility-conversation-column">
              <FriendAddWorkspace
                onBack={
                  closeWorkspacePage
                }
                accessToken={authSession?.accessToken}
                onRequestSent={() => refreshSocialData().catch(() => {})}
              />
            </div>
          </div>
        </div>
      )
    }

    /*
     * NOTIFICATIONS
     */
    if (
      workspaceMode ===
      'notifications'
    ) {
      return (
        <div className="chat-room-stage utility-room-stage">
          <header className="chat-header utility-workspace-header">
            <div className="chat-header-left">
              <div className="chat-room-avatar utility-header-avatar">
                <BellIcon />
              </div>

              <div className="chat-room-info">
                <div className="chat-room-title-row">
                  <h2>알림</h2>
                </div>

                <div className="room-theme-description">
                  MeetupLog의 새로운 소식을 확인하세요
                </div>
              </div>
            </div>

            <button
              type="button"
              className="utility-close-button"
              onClick={
                closeWorkspacePage
              }
            >
              <CloseIcon />
            </button>
          </header>

          <div className="chat-body">
            <div className="conversation-column utility-conversation-column">
              <NotificationsWorkspace
                notifications={
                  notifications
                }
                onBack={
                  closeWorkspacePage
                }
                onDelete={
                  handleDeleteNotification
                }
                onDeleteAll={() =>
                  setNotifications(
                    [],
                  )
                }
                onMarkAllRead={() =>
                  setNotifications(
                    (previous) =>
                      previous.map(
                        (
                          notification,
                        ) => ({
                          ...notification,
                          read: true,
                        }),
                      ),
                  )
                }
                onAccept={handleAcceptNotification}
                onReject={handleRejectNotification}
                actionBusyId={notificationActionBusyId}
              />
            </div>
          </div>
        </div>
      )
    }

    /*
     * HOME
     */
    return (
      <div className="chat-room-stage home-room-stage">
        <header className="chat-header home-workspace-header">
          <div className="chat-header-left">
            <div className="chat-room-avatar home-header-avatar">
              M
            </div>

            <div className="chat-room-info">
              <div className="chat-room-title-row">
                <h2>
                  MeetupLog
                </h2>
              </div>

              <div className="room-theme-description">
                대화를 시작하고 모임의 결정을 만들어보세요
              </div>
            </div>
          </div>

        </header>

        <div className="chat-body">
          <div className="conversation-column main-home-column">
            <WorkspaceHome
              user={userProfile}
              rooms={rooms}
              onSelectRoom={
                handleSelectRoom
              }
              onCreateRoom={() =>
                setModal(
                  'CREATE_ROOM',
                )
              }
            />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="chat-page"
      data-theme={roomTheme.key}
      data-color-mode={
        colorMode
      }
      data-chat-connection={
        chatConnectionState
      }
      style={{
        '--theme-accent':
          roomTheme.accent,

        '--theme-accent-rgb':
          roomTheme.accentRgb,

        '--theme-accent-soft':
          roomTheme.accentSoft,

        '--theme-background':
          roomTheme.background,
      }}
    >
      <GlobalThemeToggle
        mode={
          colorMode
        }
        onToggle={() =>
          setColorMode(
            (previous) =>
              previous ===
              'light'
                ? 'dark'
                : 'light',
          )
        }
      />

      <ChatSidebar
        rooms={rooms}
        friends={friends}
        selectedRoomId={
          selectedRoomId
        }
        onSelectRoom={
          handleSelectRoom
        }
        activeMenu={
          activeMenu
        }
        onChangeMenu={
          handleChangeMenu
        }
        currentUser={
          userProfile
        }
        isGuest={isGuest}
        unreadNotificationCount={
          unreadNotificationCount
        }
        onHome={
          handleHome
        }
        onCreateRoom={() =>
          setModal(
            'CREATE_ROOM',
          )
        }
        onAddFriend={() =>
          openWorkspacePage(
            'friend-add',
          )
        }
        onRemoveFriend={handleRemoveFriend}
        onBlockFriend={handleBlockFriend}
        onNotifications={() =>
          openWorkspacePage(
            'notifications',
          )
        }
        onEditProfile={() =>
          openWorkspacePage(
            'profile-edit',
          )
        }
        onPresenceChange={
          handlePresenceChange
        }
        onLogout={() =>
          setModal('LOGOUT')
        }
      />

      <section className="chat-main">
        {renderMainShell()}
      </section>

      {memberDrawerOpen &&
        selectedRoom && (
          <div className="member-drawer-layer">
            <button
              type="button"
              className="member-drawer-backdrop"
              aria-label="참여자 목록 닫기"
              onClick={() =>
                setMemberDrawerOpen(
                  false,
                )
              }
            />

            <MemberPanel
              members={members}
              typingUsers={
                participantTypingUsers
              }
              isOwner={isOwner}
              variant="drawer"
              onClose={() =>
                setMemberDrawerOpen(
                  false,
                )
              }
              onRequestKick={(
                member,
              ) => {
                setMemberDrawerOpen(
                  false,
                )

                setKickTarget(
                  member,
                )
              }}
              friends={friends}
              onInviteFriend={handleInviteFriend}
              pendingInviteIds={pendingInvitesByRoom[selectedRoomId] ?? []}
              inviteLink={inviteLinksByRoom[selectedRoomId]}
              inviteLinkBusy={inviteLinkBusy}
              onCreateInviteLink={handleCreateInviteLink}
            />
          </div>
        )}

      <CreateRoomModal
        open={
          modal ===
          'CREATE_ROOM'
        }
        onClose={() =>
          setModal(null)
        }
        onCreate={
          handleCreateRoom
        }
      />

      <KickMemberModal
        open={
          kickTarget !== null
        }
        member={kickTarget}
        onClose={() =>
          setKickTarget(null)
        }
        onConfirm={
          handleKickMember
        }
      />

      <KickedMemberNoticeModal
        notice={kickedNotice}
        onConfirm={() => setKickedNotice(null)}
      />

      <AppModal
        open={
          modal === 'LOGOUT'
        }
        title={isGuest ? '게스트 참여 종료' : '로그아웃'}
        subtitle={isGuest ? '초대받은 채팅방에서 나갑니다.' : '현재 MeetupLog 세션을 안전하게 종료합니다.'}
        eyebrow={isGuest ? 'GUEST SESSION' : 'ACCOUNT SESSION'}
        icon={<LogoutIcon />}
        className="logout-modal"
        onClose={() =>
          setModal(null)
        }
        size="small"
      >
        <div className="logout-confirm">
          <div className="logout-confirm-message">
            <strong>
              {isGuest ? '초대방에서 나갈까요?' : '정말 로그아웃할까요?'}
            </strong>

            <p>
              {isGuest
                ? '게스트 세션이 종료되며, 다시 참여하려면 초대 링크가 필요합니다.'
                : '이 기기의 로그인 상태가 해제되고 로그인 화면으로 이동합니다.'}
            </p>
          </div>

          <div className="modal-action-row">
            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                setModal(null)
              }
            >
              취소
            </button>

            <button
              type="button"
              className="primary-action"
              onClick={() => {
                setModal(null)
                onLogout?.()
              }}
            >
              <LogoutIcon />
              {isGuest ? '나가기' : '로그아웃'}
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal
        open={modal === 'UNLINK_KAKAO'}
        title="카카오 연동 해제"
        subtitle="카카오 계정과 MeetupLog의 연결을 해제합니다."
        eyebrow="KAKAO ACCOUNT"
        onClose={() => {
          if (!accountActionSubmitting) setModal(null)
        }}
        size="small"
      >
        <div className="delete-account-confirm">
          <div className="delete-account-warning">!</div>

          <strong>카카오 연동을 해제할까요?</strong>

          <p>
            연동 해제 후 현재 세션이 종료됩니다. 다시 이용하려면 카카오 연결을
            새로 진행해야 합니다.
          </p>

          {accountActionError && (
            <div className="profile-password-status error" role="alert">
              {accountActionError}
            </div>
          )}

          <div className="modal-action-row">
            <button
              type="button"
              className="secondary-action"
              disabled={accountActionSubmitting}
              onClick={() => setModal(null)}
            >
              취소
            </button>

            <button
              type="button"
              className="danger-action"
              disabled={accountActionSubmitting}
              onClick={async () => {
                setAccountActionSubmitting(true)
                setAccountActionError('')

                try {
                  await unlinkKakao(authSession.accessToken)
                  setModal(null)
                  onLogout?.()
                } catch (error) {
                  setAccountActionError(
                    error?.message || '카카오 연동을 해제하지 못했습니다.',
                  )
                } finally {
                  setAccountActionSubmitting(false)
                }
              }}
            >
              {accountActionSubmitting ? '해제 중...' : '연동 해제'}
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal
        open={
          modal ===
          'DELETE_ACCOUNT'
        }
        title="회원탈퇴"
        subtitle="이 작업은 되돌릴 수 없습니다."
        onClose={() =>
          setModal(null)
        }
        size="small"
      >
        <div className="delete-account-confirm">
          <div className="delete-account-warning">
            !
          </div>

          <strong>
            MeetupLog 계정을 삭제할까요?
          </strong>

          <p>
            가입 정보와 개인 데이터가 삭제되며 복구할 수 없습니다.
          </p>

          {accountActionError && (
            <div className="profile-password-status error" role="alert">
              {accountActionError}
            </div>
          )}

          <div className="modal-action-row">
            <button
              type="button"
              className="secondary-action"
              onClick={() =>
                setModal(null)
              }
            >
              취소
            </button>

            <button
              type="button"
              className="danger-action"
              disabled={accountActionSubmitting}
              onClick={async () => {
                setAccountActionSubmitting(true)
                setAccountActionError('')

                try {
                  await deleteMyAccount(authSession.accessToken)
                  setModal(null)
                  onLogout?.()
                } catch (error) {
                  setAccountActionError(
                    error?.message || '회원탈퇴를 처리하지 못했습니다.',
                  )
                } finally {
                  setAccountActionSubmitting(false)
                }
              }}
            >
              {accountActionSubmitting ? '처리 중...' : '회원탈퇴'}
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal
        open={
          modal ===
          'EDIT_MESSAGE'
        }
        title="메시지 수정"
        icon={<PencilIcon />}
        className="message-action-modal"
        onClose={() => {
          setEditingMessage(null)
          setEditMessageDraft('')
          setModal(null)
        }}
        size="small"
      >
        <div className="message-edit-confirm">
          <label className="message-edit-field">
            <span>
              수정할 내용
              <small>{editMessageDraft.length}/1000</small>
            </span>

            <textarea
              value={editMessageDraft}
              maxLength={1000}
              autoFocus
              onChange={(event) =>
                setEditMessageDraft(event.target.value)
              }
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter' &&
                  !event.shiftKey &&
                  editMessageDraft.trim() &&
                  editMessageDraft.trim() !== editingMessage?.content
                ) {
                  event.preventDefault()
                  handleSaveEdit(
                    editingMessage.id,
                    editMessageDraft.trim(),
                  )
                  setModal(null)
                }
              }}
            />
          </label>

          <div className="modal-action-row">
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setEditingMessage(null)
                setEditMessageDraft('')
                setModal(null)
              }}
            >
              취소
            </button>

            <button
              type="button"
              className="primary-action"
              disabled={
                !editMessageDraft.trim() ||
                editMessageDraft.trim() === editingMessage?.content
              }
              onClick={() => {
                handleSaveEdit(
                  editingMessage.id,
                  editMessageDraft.trim(),
                )
                setModal(null)
              }}
            >
              <PencilIcon />
              수정 저장
            </button>
          </div>
        </div>
      </AppModal>

      <AppModal
        open={
          modal ===
          'DELETE_MESSAGE'
        }
        title="메시지 삭제"
        icon={<TrashIcon />}
        className="message-action-modal message-delete-modal"
        onClose={() => {
          setDeleteMessageTarget(
            null,
          )

          setModal(null)
        }}
        size="small"
      >
        <div className="delete-message-confirm">
          <div className="delete-message-preview">
            <span>삭제할 메시지</span>
            <p>{deleteMessageTarget?.content}</p>
          </div>

          <div className="modal-action-row">
            <button
              type="button"
              className="secondary-action"
              onClick={() => {
                setDeleteMessageTarget(
                  null,
                )

                setModal(null)
              }}
            >
              취소
            </button>

            <button
              type="button"
              className="danger-action"
              onClick={
                confirmDeleteMessage
              }
            >
              <TrashIcon />
              삭제
            </button>
          </div>
        </div>
      </AppModal>

      <RoomMenuModal
        open={modal === 'ROOM_MENU'}
        room={selectedRoom}
        memberCount={members.length || selectedRoom?.memberCount || 0}
        isOwner={isOwner}
        inviteLink={inviteLinksByRoom[selectedRoomId]}
        onClose={() => setModal(null)}
        onLoadInviteLink={handleLoadActiveInviteLink}
        onCreateInviteLink={issueRoomInviteLink}
        onRevokeInviteLink={handleRevokeInviteLink}
        onLoadNotification={handleLoadRoomNotification}
        onUpdateNotification={handleUpdateRoomNotification}
        onRenameRoom={handleRenameRoom}
        onDeleteRoom={handleDeleteRoom}
        onLeaveRoom={handleLeaveRoom}
      />

      <AppModal
        open={
          aiDetailMovie !== null
        }
        title="추천 상세"
        subtitle="Meetup AI가 계산한 후보의 상세 정보입니다."
        onClose={() =>
          setAiDetailMovie(null)
        }
      >
        {aiDetailMovie && (
          <div className="ai-detail-modal">
            <div className="ai-detail-poster">
              🎬
            </div>

            <h3>
              {
                aiDetailMovie.title
              }
            </h3>

            <p>
              {
                aiDetailMovie.genres
              }
            </p>

            <div className="ai-detail-score">
              <strong>
                {
                  aiDetailMovie.score
                }
              </strong>

              <span>
                그룹 적합도
              </span>
            </div>

            <p className="ai-detail-description">
              실제 구현에서는 영화 메타데이터와 사용자별 선호 점수,
              추천 근거를 이 영역에서 상세하게 보여줍니다.
            </p>
          </div>
        )}
      </AppModal>
    </div>
  )
}

export default ChatMainPage
