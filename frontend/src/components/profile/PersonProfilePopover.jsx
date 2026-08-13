import {
  useRef,
} from 'react'

import {
  createPortal,
} from 'react-dom'

import PresenceOrb from '../common/PresenceOrb'
import PresenceBanner from '../common/PresenceBanner'
import UserAvatar from '../common/UserAvatar'

import {
  getPresence,
} from '../../config/presence'

import useAnchoredPopover from '../../hooks/useAnchoredPopover'

const PersonProfilePopover = ({
  open,
  user,
  onClose,
  anchorElement,
  preferredSide = 'right',
  contextLabel,
}) => {
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
    mode: 'side',
    preferredSide,
    width: 296,
    estimatedHeight: 246,
  })

  if (
    !open ||
    !user ||
    typeof document ===
      'undefined'
  ) {
    return null
  }

  const presence =
    getPresence(
      user.presence,
    )

  return createPortal(
    <>
      <button
        type="button"
        className="person-profile-backdrop ios-popover-backdrop"
        aria-label="프로필 닫기"
        onClick={onClose}
      />

      <section
        ref={floatingRef}
        className={[
          'person-profile-popover',
          'ios-floating-popover',
          mobile
            ? 'ios-popover-mobile'
            : 'ios-popover-desktop',
          `ios-popover-side-${side}`,
        ].join(' ')}
        style={style}
        role="dialog"
        aria-label={`${user.nickname} 프로필`}
      >
        <PresenceBanner
          presence={user.presence}
          size="large"
          className="person-profile-banner"
        />

        <div className="person-profile-main">
          <div className="person-profile-avatar-wrap">
            <UserAvatar
              user={user}
              className="person-profile-avatar"
            />

            <PresenceOrb
              presence={
                user.presence
              }
              size="small"
              animated
            />
          </div>

          <div className="person-profile-copy">
            <div className="person-profile-name-row">
              <strong>
                {
                  user.nickname
                }
              </strong>

              {user.role ===
                'OWNER' && (
                <span className="person-profile-role owner">
                  방장
                </span>
              )}

              {user.role ===
                'GUEST' && (
                <span className="person-profile-role guest">
                  게스트
                </span>
              )}
            </div>

            <span className="person-profile-presence">
              {
                presence.label
              }
            </span>

            {contextLabel && (
              <span className="person-profile-context">
                {
                  contextLabel
                }
              </span>
            )}
          </div>
        </div>

        <section className="person-profile-status">
          <span>
            상태 메시지
          </span>

          <p>
            {user.statusMessage ||
              '설정된 상태 메시지가 없습니다.'}
          </p>
        </section>
      </section>
    </>,
    document.body,
  )
}

export default PersonProfilePopover
