import {
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

const getPresenceIdentity = (person) => {
  if (person?.accountId) {
    return `account:${person.accountId}`
  }

  if (person?.email) {
    return `email:${person.email.toLocaleLowerCase()}`
  }

  return person?.id != null
    ? `id:${person.id}`
    : null
}

const createPresenceDirectory = (...groups) => {
  const directory = {}

  groups.flat().forEach((person) => {
    const identity = getPresenceIdentity(person)

    if (identity && PRESENCE_KEYS.has(person?.presence)) {
      directory[identity] = person.presence
    }
  })

  return directory
}

const ChatMainPage = ({
  authSession,
  onLogout,
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
    useState(sessionRooms)

  const [baseFriends] =
    useState(
      isGuest ? [] : initialFriends,
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

  const [activeMenu, setActiveMenu] =
    useState('chat')

  const friends = useMemo(
    () => baseFriends.map((friend) => ({
      ...friend,
      presence:
        presenceDirectory[getPresenceIdentity(friend)] ??
        friend.presence,
    })),
    [baseFriends, presenceDirectory],
  )

  useEffect(() => {
    const currentIdentity = getPresenceIdentity(sessionUser)

    const applyRealtimePresence = (payload) => {
      const identity =
        payload?.identity ??
        getPresenceIdentity(payload)
      const presence = payload?.presence

      if (!identity || !PRESENCE_KEYS.has(presence)) {
        return
      }

      setPresenceDirectory((previous) => ({
        ...previous,
        [identity]: presence,
      }))

      if (identity === currentIdentity) {
        setUserProfile((previous) => ({
          ...previous,
          presence,
        }))
      }
    }

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
  }, [])

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
    sessionMessages,
  )

  const [
    notifications,
    setNotifications,
  ] = useState(
    initialNotifications,
  )

  const [pendingInvitesByRoom, setPendingInvitesByRoom] = useState({})

  /*
   * 다른 사용자 입력 상태 Mock.
   */
  const [typingUsers] = useState([
    {
      id: 2,
      nickname: '민수',
    },
  ])

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
              presence:
                presenceDirectory[getPresenceIdentity(member)] ??
                member.presence,
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

  const isOwner =
    userProfile.role ===
    'OWNER'

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

    const identity = getPresenceIdentity(userProfile)

    setUserProfile(
      (previous) => ({
        ...previous,
        presence,
      }),
    )

    if (identity) {
      setPresenceDirectory((previous) => ({
        ...previous,
        [identity]: presence,
      }))

      const payload = {
        identity,
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
  }

  const handleProfileSave = (
    values,
  ) => {
    setUserProfile(
      (previous) => ({
        ...previous,
        ...values,
      }),
    )

    setWorkspaceMode(
      returnWorkspaceMode,
    )
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
    if (!selectedRoom) {
      return
    }

    const now =
      new Date()

    const time = `${String(
      now.getHours(),
    ).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`

    const messageId =
      Date.now()

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

      content,

      sentAt: time,

      type: 'TEXT',

      unreadCount,

      replyToId,
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
                content,
            }
          : room,
      ),
    )

    setReplyTarget(null)
    setEditingMessage(null)

    if (
      unreadCount > 0
    ) {
      scheduleMockReadReceipts(
        selectedRoom.id,
        messageId,
      )
    }
  }

  const handleSendImage = (
    attachment,
    replyToId = null,
  ) => {
    if (
      !selectedRoom ||
      !attachment?.imageUrl
    ) {
      return
    }

    const now = new Date()

    const time = `${String(
      now.getHours(),
    ).padStart(2, '0')}:${String(
      now.getMinutes(),
    ).padStart(2, '0')}`

    const messageId =
      Date.now()

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
        attachment.fileName ||
        '사진',
      sentAt: time,
      type: 'IMAGE',
      imageUrl:
        attachment.imageUrl,
      imageMimeType:
        attachment.mimeType,
      imageSize:
        attachment.size,
      unreadCount,
      replyToId,
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

    if (
      unreadCount > 0
    ) {
      scheduleMockReadReceipts(
        selectedRoom.id,
        messageId,
      )
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

  const handleSaveEdit = (
    messageId,
    content,
  ) => {
    if (!selectedRoom) {
      return
    }

    updateMessageInRoom(
      selectedRoom.id,
      messageId,
      (message) => {
        if (
          message.senderId !==
            userProfile.id ||
          message.deleted
        ) {
          return message
        }

        return {
          ...message,
          content,
          edited: true,
        }
      },
    )

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
    () => {
      if (
        !selectedRoom ||
        !deleteMessageTarget
      ) {
        setModal(null)
        return
      }

      const messageId =
        deleteMessageTarget.id

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

  const handleCreateRoom = ({
    name,
    topicType,
    maxMembers,
  }) => {
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

  const handleInviteFriend = (friend) => {
    if (!friend || !selectedRoomId) return

    setPendingInvitesByRoom((previous) => {
      const roomInvites = previous[selectedRoomId] ?? []
      if (roomInvites.includes(friend.id)) return previous

      return {
        ...previous,
        [selectedRoomId]: [...roomInvites, friend.id],
      }
    })
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
            onOpenRoomMenu={isGuest
              ? null
              : () => setModal('ROOM_MENU')}
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
                  setLocalTyping
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
                onChangePassword={
                  changeMyPassword
                }
                onDeleteAccount={() =>
                  setModal(
                    'DELETE_ACCOUNT',
                  )
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
              onClick={() => {
                alert(
                  '회원탈퇴 API 연결 단계에서 실제 삭제 처리를 구현합니다.',
                )

                setModal(null)
              }}
            >
              회원탈퇴
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
        subtitle="전송한 메시지의 내용을 변경합니다."
        eyebrow="MESSAGE ACTION"
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

          <div className="message-action-note">
            <span>i</span>
            <p>수정한 메시지에는 대화 상대가 확인할 수 있도록 ‘수정됨’ 표시가 남습니다.</p>
          </div>

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
        subtitle="삭제 후에는 메시지 내용을 복구할 수 없습니다."
        eyebrow="MESSAGE ACTION"
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

          <div className="message-action-note danger">
            <span>!</span>
            <p>대화 위치는 유지되지만 내용은 ‘삭제된 메시지입니다’로 대체됩니다.</p>
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

      <AppModal
        open={
          modal ===
          'ROOM_MENU'
        }
        title={
          selectedRoom?.name ??
          '채팅방'
        }
        subtitle="채팅방 설정과 관리 기능입니다."
        onClose={() =>
          setModal(null)
        }
        size="small"
      >
        <div className="room-menu-list">
          <button type="button">
            채팅방 정보
          </button>

          <button type="button">
            초대 링크 관리
          </button>

          <button type="button">
            알림 설정
          </button>

          {isOwner && (
            <button type="button">
              채팅방 설정
            </button>
          )}
        </div>
      </AppModal>

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
