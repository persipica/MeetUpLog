import {
  useRef,
  useState,
} from 'react'

import {
  createPortal,
} from 'react-dom'

import PresenceOrb from '../common/PresenceOrb'
import PresenceBanner from '../common/PresenceBanner'
import UserAvatar from '../common/UserAvatar'
import {
  LogoutIcon,
  PencilIcon,
  UserPlusIcon,
} from '../common/Icons'

import {
  PRESENCE,
  getPresence,
} from '../../config/presence'

import useAnchoredPopover from '../../hooks/useAnchoredPopover'

const ProfilePopover = ({
  open,
  user,
  anchorElement,
  onClose,
  onEditProfile,
  onPresenceChange,
  onLogout,
  isGuest = false,
}) => {
  const [
    presenceMenuOpen,
    setPresenceMenuOpen,
  ] = useState(false)

  const floatingRef =
    useRef(null)

  const {
    style,
    side,
    mobile,
  } = useAnchoredPopover({
    open,
    anchorElement,
    floatingRef,
    mode: 'above',
    preferredSide: 'above',
    width: 304,
    estimatedHeight:
      presenceMenuOpen
        ? 500
        : 360,
    refreshKey:
      presenceMenuOpen,
  })

  if (
    !open ||
    !user ||
    typeof document ===
      'undefined'
  ) {
    return null
  }

  const userPresence = user.presence ?? 'ONLINE'
  const currentPresence = getPresence(userPresence)
  const isGuestAccount =
    isGuest || user.accountType === 'GUEST'

  const closePopover = () => {
    setPresenceMenuOpen(
      false,
    )

    onClose()
  }

  return createPortal(
    <>
      <button
        type="button"
        className="profile-popover-backdrop ios-popover-backdrop"
        aria-label="프로필 메뉴 닫기"
        onClick={
          closePopover
        }
      />

      <section
        ref={floatingRef}
        className={[
          'profile-popover',
          'own-profile-popover',
          'ios-floating-popover',
          mobile
            ? 'ios-popover-mobile'
            : 'ios-popover-desktop',
          `ios-popover-side-${side}`,
        ].join(' ')}
        style={style}
      >
        <PresenceBanner
          presence={userPresence}
          size="large"
          className="profile-popover-banner"
        />

        <div className="profile-popover-user">
          <div className="profile-popover-avatar-wrap">
            <UserAvatar
              user={user}
              className="profile-popover-avatar"
            />

            <PresenceOrb
              presence={userPresence}
              size="small"
              animated
            />
          </div>

          <div>
            <strong>
              {user.nickname}
            </strong>

            <span>
              {user.statusMessage ||
                '상태 메시지가 없습니다.'}
            </span>
          </div>
        </div>

        <div className="profile-popover-menu">
          <button
            type="button"
            className="profile-popover-action"
            onClick={() => {
              onEditProfile?.()
              closePopover()
            }}
          >
            <span className="profile-action-icon">
              {isGuestAccount ? <UserPlusIcon /> : <PencilIcon />}
            </span>

            <div>
              <strong>
                {isGuestAccount ? '일반회원으로 전환' : '프로필 편집'}
              </strong>
            </div>

            <span className="profile-action-chevron">
              ›
            </span>
          </button>

          {!isGuestAccount && <button
            type="button"
            className="profile-popover-action"
            onClick={() =>
              setPresenceMenuOpen(
                (previous) =>
                  !previous,
              )
            }
          >
            <span
              className={`profile-action-icon presence presence-option-${currentPresence.key}`}
            >
              <PresenceOrb
                presence={userPresence}
                size="small"
                animated
              />
            </span>

            <div>
              <strong>{currentPresence.label}</strong>
            </div>

            <span
              className={`profile-action-chevron ${
                presenceMenuOpen
                  ? 'opened'
                  : ''
              }`}
            >
              ›
            </span>
          </button>}

          {!isGuestAccount && <div
            className={`presence-select-menu ${
              presenceMenuOpen
                ? 'open'
                : ''
            }`}
          >
            {Object.entries(PRESENCE).map(
              ([key, presence]) => (
                <button
                  key={key}
                  type="button"
                  className={
                    userPresence === key
                      ? 'selected'
                      : ''
                  }
                  onClick={() => {
                    onPresenceChange(key)
                    setPresenceMenuOpen(false)
                  }}
                >
                  <span
                    className={`presence-option-icon presence-option-${presence.key}`}
                  >
                    <PresenceOrb
                      presence={key}
                      size="small"
                      animated={false}
                    />
                  </span>

                  <div>
                    <strong>{presence.label}</strong>
                  </div>

                  {userPresence === key && (
                    <i>✓</i>
                  )}
                </button>
              ),
            )}
          </div>}

          <button
            type="button"
            className="profile-popover-action logout"
            onClick={() => {
              onLogout()
              closePopover()
            }}
          >
            <span className="profile-action-icon">
              <LogoutIcon />
            </span>

            <div>
              <strong>{isGuestAccount ? '게스트 나가기' : '로그아웃'}</strong>
            </div>
          </button>
        </div>
      </section>
    </>,
    document.body,
  )
}

export default ProfilePopover
