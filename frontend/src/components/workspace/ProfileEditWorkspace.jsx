import {
  useEffect,
  useRef,
  useState,
} from 'react'

import UserAvatar from '../common/UserAvatar'
import PresenceOrb from '../common/PresenceOrb'

import {
  getPresence,
} from '../../config/presence'

const ProfileEditWorkspace = ({
  user,
  onBack,
  onSave,
  onDeleteAccount,
}) => {
  const fileInputRef =
    useRef(null)

  const [
    nickname,
    setNickname,
  ] = useState(
    user.nickname,
  )

  const [
    statusMessage,
    setStatusMessage,
  ] = useState(
    user.statusMessage ?? '',
  )

  const [
    profileImageUrl,
    setProfileImageUrl,
  ] = useState(
    user.profileImageUrl ?? null,
  )

  useEffect(() => {
    setNickname(
      user.nickname,
    )

    setStatusMessage(
      user.statusMessage ?? '',
    )

    setProfileImageUrl(
      user.profileImageUrl ?? null,
    )
  }, [user])

  const previewUser = {
    ...user,

    nickname:
      nickname ||
      user.nickname,

    statusMessage,

    profileImageUrl,
  }

  const handleImageChange = (
    event,
  ) => {
    const file =
      event.target.files?.[0]

    if (!file) {
      return
    }

    const reader =
      new FileReader()

    reader.onload = () => {
      setProfileImageUrl(
        reader.result,
      )
    }

    reader.readAsDataURL(
      file,
    )
  }

  const presence =
    getPresence(
      user.presence,
    )

  return (
    <div className="profile-edit-workspace">
      <section className="profile-edit-preview liquid-menu-surface">
        <div className="profile-preview-banner">
          <PresenceOrb
            presence={
              user.presence
            }
            size="hero"
            animated
          />
        </div>

        <div className="profile-preview-card">
          <div className="profile-preview-avatar-wrap">
            <UserAvatar
              user={
                previewUser
              }
              className="profile-edit-avatar"
            />
          </div>

          <strong>
            {
              previewUser.nickname
            }
          </strong>

          <span>
            {
              presence.label
            }
          </span>

          <p>
            {statusMessage ||
              '상태 메시지가 없습니다.'}
          </p>
        </div>
      </section>

      <section className="profile-edit-form">
        <header>
          <span>
            PROFILE
          </span>

          <h1>
            프로필 편집
          </h1>

          <p>
            다른 사람에게 표시되는 프로필 정보를 관리합니다.
          </p>
        </header>

        <div className="profile-settings-stack">
          <div className="profile-field-group profile-setting-card profile-photo-setting liquid-menu-surface">
            <div className="profile-setting-heading">
              <div>
                <strong>
                  프로필 사진
                </strong>

                <span>
                  계정에서 사용할 대표 이미지를 설정합니다.
                </span>
              </div>

              <small>
                JPG · PNG
              </small>
            </div>

            <div className="profile-photo-control">
              <UserAvatar
                user={
                  previewUser
                }
                className="profile-photo-control-avatar"
              />

              <div className="profile-photo-actions">
                <button
                  type="button"
                  className="profile-photo-button profile-unified-button primary"
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  사진 변경
                </button>

                {profileImageUrl && (
                  <button
                    type="button"
                    className="profile-photo-remove profile-unified-button secondary"
                    onClick={() =>
                      setProfileImageUrl(
                        null,
                      )
                    }
                  >
                    제거
                  </button>
                )}
              </div>

              <input
                ref={
                  fileInputRef
                }
                type="file"
                accept="image/*"
                hidden
                onChange={
                  handleImageChange
                }
              />
            </div>
          </div>

          <div className="profile-field-group profile-setting-card liquid-menu-surface">
            <div className="profile-setting-heading">
              <div>
                <strong>
                  닉네임
                </strong>

                <span>
                  친구와 참여자에게 표시되는 이름입니다.
                </span>
              </div>

              <small>
                {nickname.length}/50
              </small>
            </div>

            <input
              id="editNickname"
              value={nickname}
              maxLength={50}
              placeholder="닉네임을 입력하세요"
              onChange={(
                event,
              ) =>
                setNickname(
                  event.target.value,
                )
              }
            />
          </div>

          <div className="profile-field-group profile-setting-card liquid-menu-surface">
            <div className="profile-setting-heading">
              <div>
                <strong>
                  상태 메시지
                </strong>

                <span>
                  지금의 상태나 한마디를 표시합니다.
                </span>
              </div>

              <small>
                {
                  statusMessage.length
                }/120
              </small>
            </div>

            <textarea
              id="editStatusMessage"
              value={
                statusMessage
              }
              maxLength={120}
              rows={3}
              placeholder="지금 무엇을 하고 있는지 알려보세요."
              onChange={(
                event,
              ) =>
                setStatusMessage(
                  event.target.value,
                )
              }
            />
          </div>
        </div>

        <div className="profile-edit-actions">
          <button
            type="button"
            className="profile-edit-cancel profile-unified-button secondary"
            onClick={
              onBack
            }
          >
            취소
          </button>

          <button
            type="button"
            className="profile-edit-save profile-unified-button primary"
            disabled={
              !nickname.trim()
            }
            onClick={() =>
              onSave({
                nickname:
                  nickname.trim(),

                statusMessage:
                  statusMessage.trim(),

                profileImageUrl,
              })
            }
          >
            변경사항 저장
          </button>
        </div>

        <div className="profile-danger-zone liquid-menu-surface">
          <div>
            <strong>
              회원탈퇴
            </strong>

            <p>
              계정을 삭제하면 복구할 수 없습니다.
            </p>
          </div>

          <button
            type="button"
            className="profile-unified-button danger"
            onClick={
              onDeleteAccount
            }
          >
            회원탈퇴
          </button>
        </div>
      </section>
    </div>
  )
}

export default ProfileEditWorkspace
