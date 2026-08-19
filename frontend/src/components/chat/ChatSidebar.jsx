import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  getRoomTheme,
} from '../../config/roomThemes'

import {
  getPresence,
} from '../../config/presence'

import PresenceOrb from '../common/PresenceOrb'
import UserAvatar from '../common/UserAvatar'
import {
  BellIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
  ShieldIcon,
  TrashIcon,
} from '../common/Icons'
import ProfilePopover from '../profile/ProfilePopover'
import PersonProfilePopover from '../profile/PersonProfilePopover'

const ChatSidebar = ({
  rooms,
  friends,
  selectedRoomId,
  onSelectRoom,
  activeMenu,
  onChangeMenu,
  currentUser,
  unreadNotificationCount,
  onHome,
  onCreateRoom,
  onAddFriend,
  onRemoveFriend,
  onBlockFriend,
  onNotifications,
  onEditProfile,
  onPresenceChange,
  onLogout,
  isGuest = false,
}) => {
  const [
    profileOpen,
    setProfileOpen,
  ] = useState(false)

  const [
    selectedFriendId,
    setSelectedFriendId,
  ] = useState(null)

  const [
    friendProfileAnchorElement,
    setFriendProfileAnchorElement,
  ] = useState(null)

  const [
    ownProfileAnchorElement,
    setOwnProfileAnchorElement,
  ] = useState(null)

  const [
    tabMotion,
    setTabMotion,
  ] = useState('')

  const [friendMenuId, setFriendMenuId] = useState(null)

  const previousMenuRef =
    useRef(activeMenu)

  useEffect(() => {
    if (friendMenuId === null) return undefined

    const closeFriendMenu = (event) => {
      if (
        event.target.closest?.('.sidebar-friend-context-menu') ||
        event.target.closest?.('.sidebar-friend-more')
      ) {
        return
      }
      setFriendMenuId(null)
    }

    document.addEventListener('pointerdown', closeFriendMenu)
    return () => document.removeEventListener('pointerdown', closeFriendMenu)
  }, [friendMenuId])

  useLayoutEffect(() => {
    const previousMenu =
      previousMenuRef.current

    if (previousMenu === activeMenu) {
      return undefined
    }

    setTabMotion(
      activeMenu === 'friend'
        ? 'is-moving-right'
        : 'is-moving-left',
    )
    previousMenuRef.current =
      activeMenu

    const motionTimer =
      window.setTimeout(
        () => setTabMotion(''),
        620,
      )

    return () =>
      window.clearTimeout(
        motionTimer,
      )
  }, [activeMenu])

  const currentPresence =
    getPresence(
      currentUser.presence,
    )

  const selectedFriend =
    useMemo(
      () =>
        friends.find(
          (friend) =>
            friend.id ===
            selectedFriendId,
        ) ?? null,
      [
        friends,
        selectedFriendId,
      ],
    )

  const closeFriendProfile =
    () => {
      setSelectedFriendId(null)
      setFriendProfileAnchorElement(null)
    }

  return (
    <aside className="chat-sidebar">
      <button
        type="button"
        className="sidebar-brand"
        onClick={onHome}
      >
        <div className="brand-mark">
          M
        </div>

        <div>
          <h1>MeetupLog</h1>
          <span>
            Decide together
          </span>
        </div>
      </button>

      {!isGuest ? <div
        className={`sidebar-tabs ${tabMotion}`}
        data-active={activeMenu}
        role="tablist"
        aria-label="사이드바 메뉴"
      >
        <span
          className="sidebar-tab-glider"
          aria-hidden="true"
        />
        <button
          type="button"
          role="tab"
          aria-selected={activeMenu === 'chat'}
          className={
            activeMenu === 'chat'
              ? 'active'
              : ''
          }
          onClick={() => {
            closeFriendProfile()
            onChangeMenu('chat')
          }}
        >
          채팅
          <span>{rooms.length}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeMenu === 'friend'}
          className={
            activeMenu === 'friend'
              ? 'active'
              : ''
          }
          onClick={() =>
            onChangeMenu('friend')
          }
        >
          친구
          <span>{friends.length}</span>
        </button>
      </div> : (
        <div className="sidebar-guest-pass">
          <span>GUEST PASS</span>
          <strong>초대방 전용</strong>
        </div>
      )}

      {activeMenu === 'chat' ? (
        <>
          <div className="sidebar-section-header">
            <div>
              <span>CHATS</span>
              <h2>최근 대화</h2>
            </div>

            {!isGuest && <button
              type="button"
              className="new-room-button"
              onClick={onCreateRoom}
              aria-label="새 채팅방 만들기"
            >
              <PlusIcon />
            </button>}
          </div>

          <label className="room-search">
            <span><SearchIcon /></span>

            <input
              type="search"
              placeholder="채팅방 검색"
            />
          </label>

          <div className="room-list">
            {rooms.map((room) => {
              const theme =
                getRoomTheme(
                  room.topicType,
                )

              return (
                <button
                  key={room.id}
                  type="button"
                  className={`room-item ${
                    selectedRoomId ===
                    room.id
                      ? 'selected'
                      : ''
                  }`}
                  style={{
                    '--room-accent':
                      theme.accent,
                    '--room-soft':
                      theme.accentSoft,
                  }}
                  onClick={() =>
                    onSelectRoom(
                      room.id,
                    )
                  }
                >
                  <div className="room-active-bar" />

                  <div className="room-avatar">
                    {theme.icon}
                  </div>

                  <div className="room-item-content">
                    <div className="room-item-top">
                      <strong>
                        {room.name}
                      </strong>

                      {room.unreadCount >
                        0 && (
                        <span className="unread-badge">
                          {
                            room.unreadCount
                          }
                        </span>
                      )}
                    </div>

                    <p>
                      {room.lastMessage}
                    </p>

                    <span className="room-category">
                      {theme.label}
                      {' · '}
                      {room.memberCount}명
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <>
          <div className="sidebar-section-header">
            <div>
              <span>FRIENDS</span>
              <h2>친구 목록</h2>
            </div>

            <button
              type="button"
              className="new-room-button"
              onClick={onAddFriend}
              aria-label="친구 추가"
            >
              <PlusIcon />
            </button>
          </div>

          <label className="room-search">
            <span><SearchIcon /></span>

            <input
              type="search"
              placeholder="친구 검색"
            />
          </label>

          <div className="sidebar-friend-list">
            {friends.map(
              (friend) => {
                const presence =
                  getPresence(
                    friend.presence,
                  )

                const selected =
                  selectedFriendId ===
                  friend.id

                return (
                  <div
                    className={[
                      'sidebar-friend-item',
                      selected
                        ? 'profile-selected'
                        : '',
                    ].join(' ')}
                    key={friend.id}
                  >
                    <button
                      type="button"
                      className="sidebar-friend-profile-button"
                      onClick={(event) => {
                        setProfileOpen(false)

                        const alreadyOpen =
                          selectedFriendId ===
                          friend.id

                        if (alreadyOpen) {
                          closeFriendProfile()
                          return
                        }

                        setFriendProfileAnchorElement(
                          event.currentTarget
                            .closest(
                              '.sidebar-friend-item',
                            ) ??
                            event.currentTarget,
                        )

                        setSelectedFriendId(
                          friend.id,
                        )
                      }}
                    >
                      <div className="sidebar-friend-avatar-wrap">
                        <UserAvatar
                          user={friend}
                          className="sidebar-friend-avatar"
                        />

                        <PresenceOrb
                          presence={
                            friend.presence
                          }
                          size="mini"
                          animated
                        />
                      </div>

                      <div className="sidebar-friend-info">
                        <strong>
                          {
                            friend.nickname
                          }
                        </strong>

                        <span>
                          {friend.statusMessage
                            ? `${friend.statusMessage} · ${presence.label}`
                            : presence.label}
                        </span>
                      </div>
                    </button>

                    <button
                      type="button"
                      className="sidebar-friend-more"
                      aria-label={`${friend.nickname} 더보기`}
                      onClick={() => setFriendMenuId((previous) => previous === friend.id ? null : friend.id)}
                    >
                      <MoreIcon />
                    </button>

                    {friendMenuId === friend.id && (
                      <div className="sidebar-friend-context-menu liquid-menu-surface">
                        <button type="button" onClick={() => { setFriendMenuId(null); onRemoveFriend?.(friend) }}>
                          <span><TrashIcon /></span>
                          <strong>친구 삭제</strong>
                        </button>
                        <button type="button" className="danger" onClick={() => { setFriendMenuId(null); onBlockFriend?.(friend) }}>
                          <span><ShieldIcon /></span>
                          <strong>차단</strong>
                        </button>
                      </div>
                    )}
                  </div>
                )
              },
            )}
          </div>
        </>
      )}

      {!isGuest && <div className="sidebar-utility-row">
        <button
          type="button"
          className="sidebar-utility-button"
          onClick={() => {
            closeFriendProfile()
            onNotifications()
          }}
        >
          <span><BellIcon /></span>
          <span>알림</span>

          {unreadNotificationCount >
            0 && (
            <strong>
              {
                unreadNotificationCount
              }
            </strong>
          )}
        </button>
      </div>}

      <div className="sidebar-profile-anchor">
        <button
          type="button"
          className="sidebar-user"
          onClick={(event) => {
            closeFriendProfile()

            setOwnProfileAnchorElement(
              event.currentTarget,
            )

            setProfileOpen(
              (previous) =>
                !previous,
            )
          }}
        >
          <div className="sidebar-user-avatar-wrap">
            <UserAvatar
              user={currentUser}
              className="sidebar-user-avatar"
            />

            <PresenceOrb
              presence={
                currentUser.presence
              }
              size="mini"
              animated
            />
          </div>

          <div className="sidebar-user-copy">
            <strong>
              {
                currentUser.nickname
              }
            </strong>

            <span>
              {
                currentPresence.label
              }
              {currentUser.statusMessage
                ? ` · ${currentUser.statusMessage}`
                : ''}
            </span>
          </div>

          <span className="sidebar-user-more">
            <MoreIcon />
          </span>
        </button>

        <ProfilePopover
          open={profileOpen}
          user={currentUser}
          anchorElement={
            ownProfileAnchorElement
          }
          onClose={() => {
            setProfileOpen(false)
            setOwnProfileAnchorElement(null)
          }}
          onEditProfile={
            onEditProfile
          }
          onPresenceChange={
            onPresenceChange
          }
          onLogout={onLogout}
          isGuest={isGuest}
        />
      </div>

      <PersonProfilePopover
        open={
          selectedFriend !== null
        }
        user={selectedFriend}
        onClose={
          closeFriendProfile
        }
        anchorElement={
          friendProfileAnchorElement
        }
        preferredSide="right"
        contextLabel="친구"
      />
    </aside>
  )
}

export default ChatSidebar
