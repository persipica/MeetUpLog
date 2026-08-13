import {
  useMemo,
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
  onNotifications,
  onEditProfile,
  onPresenceChange,
  onLogout,
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

      <div className="sidebar-tabs">
        <button
          type="button"
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
      </div>

      {activeMenu === 'chat' ? (
        <>
          <div className="sidebar-section-header">
            <div>
              <span>CHATS</span>
              <h2>최근 대화</h2>
            </div>

            <button
              type="button"
              className="new-room-button"
              onClick={onCreateRoom}
              aria-label="새 채팅방 만들기"
            >
              <PlusIcon />
            </button>
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
                    >
                      <MoreIcon />
                    </button>
                  </div>
                )
              },
            )}
          </div>
        </>
      )}

      <div className="sidebar-utility-row">
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
      </div>

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
