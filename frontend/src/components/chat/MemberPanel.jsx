import {
  useMemo,
  useState,
} from 'react'

import {
  getPresence,
} from '../../config/presence'

import PresenceOrb from '../common/PresenceOrb'
import UserAvatar from '../common/UserAvatar'
import PersonProfilePopover from '../profile/PersonProfilePopover'

const MemberPanel = ({
  members,
  typingUsers = [],
  isOwner,
  variant = 'desktop',
  onClose,
  onRequestKick,
}) => {
  const [
    selectedMemberId,
    setSelectedMemberId,
  ] = useState(null)

  const [
    memberProfileAnchorElement,
    setMemberProfileAnchorElement,
  ] = useState(null)

  const selectedMember =
    useMemo(
      () =>
        members.find(
          (member) =>
            member.id ===
            selectedMemberId,
        ) ?? null,
      [
        members,
        selectedMemberId,
      ],
    )

  const isTyping = (
    memberId,
  ) =>
    typingUsers.some(
      (user) =>
        user.id === memberId,
    )

  const closeProfile = () => {
    setSelectedMemberId(null)
    setMemberProfileAnchorElement(null)
  }

  return (
    <aside
      className={`member-panel ${variant}`}
    >
      <div className="member-panel-header">
        <div>
          <span>참여자</span>
          <strong>
            {members.length}
          </strong>
        </div>

        {variant === 'drawer' ? (
          <button
            type="button"
            className="member-close-button"
            onClick={onClose}
          >
            ×
          </button>
        ) : (
          isOwner && (
            <button
              type="button"
              className="member-add-button"
              aria-label="참여자 초대"
            >
              +
            </button>
          )
        )}
      </div>

      <div className="member-list">
        {members.map(
          (member) => {
            const typing =
              isTyping(
                member.id,
              )

            const presence =
              getPresence(
                member.presence,
              )

            const selected =
              selectedMemberId ===
              member.id

            return (
              <div
                className={[
                  'member-item',
                  typing
                    ? 'typing'
                    : '',
                  selected
                    ? 'profile-selected'
                    : '',
                ].join(' ')}
                key={member.id}
              >
                <button
                  type="button"
                  className="member-profile-button"
                  onClick={(event) => {
                    const alreadyOpen =
                      selectedMemberId ===
                      member.id

                    if (alreadyOpen) {
                      closeProfile()
                      return
                    }

                    setMemberProfileAnchorElement(
                      event.currentTarget
                        .closest(
                          '.member-item',
                        ) ??
                        event.currentTarget,
                    )

                    setSelectedMemberId(
                      member.id,
                    )
                  }}
                >
                  <div className="member-avatar-wrap">
                    <UserAvatar
                      user={member}
                      className="member-avatar"
                    />

                    {!typing && (
                      <PresenceOrb
                        presence={
                          member.presence
                        }
                        size="mini"
                        animated
                      />
                    )}

                    {typing && (
                      <span
                        className="member-typing-bubble"
                        aria-label={`${member.nickname}님 입력 중`}
                      >
                        <i />
                        <i />
                        <i />
                      </span>
                    )}
                  </div>

                  <div className="member-info">
                    <div>
                      <strong>
                        {
                          member.nickname
                        }
                      </strong>

                      {member.role ===
                        'OWNER' && (
                        <span className="mini-owner-badge">
                          방장
                        </span>
                      )}

                      {member.role ===
                        'GUEST' && (
                        <span className="guest-badge">
                          게스트
                        </span>
                      )}
                    </div>

                    <span
                      className={
                        typing
                          ? 'member-typing-text'
                          : ''
                      }
                    >
                      {typing
                        ? '입력 중...'
                        : presence.label}
                    </span>
                  </div>
                </button>

                {isOwner &&
                  member.role !==
                    'OWNER' && (
                    <button
                      type="button"
                      className="member-menu-button"
                      onClick={() => {
                        closeProfile()

                        onRequestKick(
                          member,
                        )
                      }}
                    >
                      ⋯
                    </button>
                  )}
              </div>
            )
          },
        )}
      </div>

      <div className="member-panel-footer">
        <p>
          초대 링크를 공유하면
          <br />
          게스트도 바로 참여할 수 있어요.
        </p>
      </div>

      <PersonProfilePopover
        open={
          selectedMember !== null
        }
        user={selectedMember}
        onClose={closeProfile}
        anchorElement={
          memberProfileAnchorElement
        }
        preferredSide={
          variant === 'drawer'
            ? 'left'
            : 'left'
        }
        contextLabel="채팅방 참여자"
      />
    </aside>
  )
}

export default MemberPanel
