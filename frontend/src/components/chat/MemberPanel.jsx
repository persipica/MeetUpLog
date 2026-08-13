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
import {
  CloseIcon,
  LinkIcon,
  MoreIcon,
  PlusIcon,
  SearchIcon,
} from '../common/Icons'

const MemberPanel = ({
  members,
  typingUsers = [],
  isOwner,
  variant = 'desktop',
  onClose,
  onRequestKick,
  friends = [],
  onInviteFriend,
  pendingInviteIds = [],
}) => {
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteTab, setInviteTab] = useState('friends')
  const [inviteSearch, setInviteSearch] = useState('')
  const [copied, setCopied] = useState(false)
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

  const inviteCandidates = useMemo(() => {
    const memberNames = new Set(members.map((member) => member.nickname))
    const keyword = inviteSearch.trim().toLocaleLowerCase()
    return friends.filter((friend) => {
      if (memberNames.has(friend.nickname)) return false
      if (!keyword) return true
      return [friend.nickname, friend.email].filter(Boolean).some((value) =>
        value.toLocaleLowerCase().includes(keyword),
      )
    })
  }, [friends, inviteSearch, members])

  const copyInviteLink = async () => {
    const inviteUrl = `${window.location.origin}/invite/demo-token`
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
    } catch {
      window.prompt('아래 초대 링크를 복사하세요.', inviteUrl)
    }
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

        {inviteOpen ? (
          <button type="button" className="member-close-button" aria-label="참여자 목록으로 돌아가기" onClick={() => setInviteOpen(false)}><CloseIcon /></button>
        ) : variant === 'drawer' ? (
          <button
            type="button"
            className="member-close-button"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        ) : (
          isOwner && (
            <button
              type="button"
              className="member-add-button"
              aria-label="참여자 초대"
              onClick={() => {
                closeProfile()
                setInviteOpen(true)
              }}
            >
              <PlusIcon />
            </button>
          )
        )}
      </div>

      {inviteOpen ? (
        <section className="member-invite-view" aria-label="참여자 초대">
          <div className="member-invite-title">
            <strong>참여자 초대</strong>
            <span>친구를 찾거나 링크를 공유하세요.</span>
          </div>
          <div className="member-invite-tabs" role="tablist">
            <button type="button" className={inviteTab === 'friends' ? 'active' : ''} onClick={() => setInviteTab('friends')}>기존 친구</button>
            <button type="button" className={inviteTab === 'link' ? 'active' : ''} onClick={() => setInviteTab('link')}>초대 링크</button>
          </div>
          {inviteTab === 'friends' ? (
            <div className="member-invite-friends">
              <label className="member-invite-search">
                <span><SearchIcon /></span>
                <input value={inviteSearch} onChange={(event) => setInviteSearch(event.target.value)} placeholder="친구 이름 또는 이메일 검색" autoFocus />
              </label>
              <span className="member-invite-count">초대 가능한 친구 {inviteCandidates.length}</span>
              <div className="member-invite-results">
                {inviteCandidates.map((friend) => (
                  <div className="member-invite-result" key={friend.id}>
                    <UserAvatar user={friend} className="member-avatar" />
                    <div><strong>{friend.nickname}</strong><span>{friend.email || friend.statusMessage || 'MeetupLog 친구'}</span></div>
                    <button
                      type="button"
                      className={pendingInviteIds.includes(friend.id) ? 'pending' : ''}
                      disabled={pendingInviteIds.includes(friend.id)}
                      onClick={() => onInviteFriend?.(friend)}
                    >
                      {pendingInviteIds.includes(friend.id) ? '초대 보냄' : '초대'}
                    </button>
                  </div>
                ))}
                {inviteCandidates.length === 0 && <p className="member-invite-empty">검색 결과가 없거나 이미 참여 중인 친구예요.</p>}
              </div>
            </div>
          ) : (
            <div className="member-invite-link">
              <div className="member-invite-link-icon"><LinkIcon /></div>
              <strong>초대 링크 공유</strong>
              <p>링크를 받은 사람은 이 채팅방에 바로 참여할 수 있어요.</p>
              <div className="member-invite-link-value"><span>/invite/demo-token</span><button type="button" onClick={copyInviteLink}>{copied ? '복사됨' : '복사'}</button></div>
            </div>
          )}
        </section>
      ) : <div className="member-list">
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
                      <MoreIcon />
                    </button>
                  )}
              </div>
            )
          },
        )}
      </div>}

      {!inviteOpen && <div className="member-panel-footer">
        <p>
          초대 링크를 공유하면
          <br />
          게스트도 바로 참여할 수 있어요.
        </p>
      </div>}

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
