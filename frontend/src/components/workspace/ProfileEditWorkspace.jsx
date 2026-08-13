import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import UserAvatar from '../common/UserAvatar'
import PresenceBanner from '../common/PresenceBanner'

import {
  CheckIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
  MailIcon,
  ShieldIcon,
} from '../common/Icons'

import {
  getPresence,
} from '../../config/presence'

const PASSWORD_MIN_LENGTH = 8

const PasswordField = ({
  id,
  label,
  value,
  placeholder,
  autoComplete,
  visible,
  error,
  onChange,
  onToggle,
}) => (
  <label
    className={`profile-password-field ${
      error ? 'invalid' : ''
    }`}
    htmlFor={id}
  >
    <span>{label}</span>

    <div>
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(event) =>
          onChange(event.target.value)
        }
      />

      <button
        type="button"
        aria-label={
          visible
            ? `${label} 숨기기`
            : `${label} 보기`
        }
        onClick={onToggle}
      >
        {visible ? (
          <EyeOffIcon />
        ) : (
          <EyeIcon />
        )}
      </button>
    </div>

    {error && (
      <small role="alert">{error}</small>
    )}
  </label>
)

const ProfileEditWorkspace = ({
  user,
  onBack,
  onSave,
  onChangePassword,
  onDeleteAccount,
}) => {
  const fileInputRef = useRef(null)

  const [nickname, setNickname] = useState(
    user.nickname,
  )
  const [statusMessage, setStatusMessage] = useState(
    user.statusMessage ?? '',
  )
  const [profileImageUrl, setProfileImageUrl] = useState(
    user.profileImageUrl ?? null,
  )

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordVisible, setPasswordVisible] = useState({
    current: false,
    next: false,
    confirm: false,
  })
  const [passwordErrors, setPasswordErrors] = useState({})
  const [passwordStatus, setPasswordStatus] = useState(null)
  const [passwordSubmitting, setPasswordSubmitting] = useState(false)

  useEffect(() => {
    setNickname(user.nickname)
    setStatusMessage(user.statusMessage ?? '')
    setProfileImageUrl(user.profileImageUrl ?? null)
  }, [user])

  const previewUser = {
    ...user,
    nickname: nickname || user.nickname,
    statusMessage,
    profileImageUrl,
  }

  const presence = getPresence(user.presence)

  const passwordRules = useMemo(
    () => ({
      length:
        newPassword.length >=
        PASSWORD_MIN_LENGTH,
      letter: /[A-Za-z]/.test(newPassword),
      number: /\d/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword),
    }),
    [newPassword],
  )

  const handleImageChange = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      setProfileImageUrl(reader.result)
    }

    reader.readAsDataURL(file)
  }

  const updatePasswordValue = (
    field,
    value,
    setter,
  ) => {
    setter(value)
    setPasswordStatus(null)
    setPasswordErrors((previous) => ({
      ...previous,
      [field]: '',
    }))
  }

  const validatePassword = () => {
    const errors = {}

    if (!currentPassword) {
      errors.current = '현재 비밀번호를 입력해 주세요.'
    }

    if (!newPassword) {
      errors.next = '새 비밀번호를 입력해 주세요.'
    } else if (
      !passwordRules.length ||
      !passwordRules.letter ||
      !passwordRules.number ||
      !passwordRules.special
    ) {
      errors.next =
        '8자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.'
    } else if (newPassword === currentPassword) {
      errors.next =
        '현재 비밀번호와 다른 비밀번호를 입력해 주세요.'
    }

    if (!confirmPassword) {
      errors.confirm = '새 비밀번호를 한 번 더 입력해 주세요.'
    } else if (newPassword !== confirmPassword) {
      errors.confirm = '새 비밀번호가 일치하지 않습니다.'
    }

    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()
    setPasswordStatus(null)

    if (!validatePassword()) {
      return
    }

    setPasswordSubmitting(true)

    try {
      await onChangePassword?.({
        currentPassword,
        newPassword,
      })

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordErrors({})
      setPasswordStatus({
        type: 'success',
        message: '비밀번호가 안전하게 변경되었습니다.',
      })
    } catch (error) {
      if (error?.field === 'currentPassword') {
        setPasswordErrors({
          current: error.message,
        })
      } else {
        setPasswordStatus({
          type: 'error',
          message:
            error?.message ||
            '비밀번호를 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.',
        })
      }
    } finally {
      setPasswordSubmitting(false)
    }
  }

  return (
    <main className="profile-edit-workspace">
      <header className="profile-edit-page-heading">
        <span>PROFILE</span>
        <h1>프로필 및 계정</h1>
        <p>
          공개 프로필과 로그인 보안 정보를 한곳에서 관리합니다.
        </p>
      </header>

      <div className="profile-edit-layout">
        <aside className="profile-edit-preview">
          <PresenceBanner
            presence={user.presence}
            size="hero"
            className="profile-preview-banner"
          />

          <div className="profile-preview-card">
            <div className="profile-preview-avatar-wrap">
              <UserAvatar
                user={previewUser}
                className="profile-edit-avatar"
              />
            </div>

            <strong>{previewUser.nickname}</strong>

            <span className="profile-preview-presence">
              {presence.label}
            </span>

            <p>
              {statusMessage ||
                '상태 메시지가 없습니다.'}
            </p>
          </div>
        </aside>

        <div className="profile-edit-content">
          <section className="profile-setting-card profile-basic-card">
            <header className="profile-card-heading">
              <div>
                <span>PUBLIC PROFILE</span>
                <h2>공개 프로필</h2>
                <p>다른 사용자에게 보이는 정보입니다.</p>
              </div>
            </header>

            <div className="profile-photo-control">
              <UserAvatar
                user={previewUser}
                className="profile-photo-control-avatar"
              />

              <div className="profile-photo-copy">
                <strong>프로필 사진</strong>
                <span>JPG 또는 PNG 이미지를 사용할 수 있어요.</span>

                <div className="profile-photo-actions">
                  <button
                    type="button"
                    className="profile-unified-button primary"
                    onClick={() =>
                      fileInputRef.current?.click()
                    }
                  >
                    사진 변경
                  </button>

                  {profileImageUrl && (
                    <button
                      type="button"
                      className="profile-unified-button secondary"
                      onClick={() =>
                        setProfileImageUrl(null)
                      }
                    >
                      제거
                    </button>
                  )}
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                hidden
                onChange={handleImageChange}
              />
            </div>

            <div className="profile-field-grid">
              <label className="profile-text-field" htmlFor="editNickname">
                <span>
                  닉네임
                  <small>{nickname.length}/50</small>
                </span>

                <input
                  id="editNickname"
                  value={nickname}
                  maxLength={50}
                  placeholder="닉네임을 입력하세요"
                  onChange={(event) =>
                    setNickname(event.target.value)
                  }
                />
              </label>

              <label className="profile-text-field profile-status-field" htmlFor="editStatusMessage">
                <span>
                  상태 메시지
                  <small>{statusMessage.length}/120</small>
                </span>

                <textarea
                  id="editStatusMessage"
                  value={statusMessage}
                  maxLength={120}
                  rows={3}
                  placeholder="지금 무엇을 하고 있는지 알려보세요."
                  onChange={(event) =>
                    setStatusMessage(event.target.value)
                  }
                />
              </label>
            </div>

            <div className="profile-edit-actions">
              <button
                type="button"
                className="profile-unified-button secondary"
                onClick={onBack}
              >
                취소
              </button>

              <button
                type="button"
                className="profile-unified-button primary"
                disabled={!nickname.trim()}
                onClick={() =>
                  onSave({
                    nickname: nickname.trim(),
                    statusMessage: statusMessage.trim(),
                    profileImageUrl,
                  })
                }
              >
                프로필 저장
              </button>
            </div>
          </section>

          <section className="profile-setting-card profile-security-card">
            <header className="profile-card-heading">
              <div className="profile-card-heading-icon">
                <ShieldIcon />
              </div>

              <div>
                <span>ACCOUNT SECURITY</span>
                <h2>계정 및 보안</h2>
                <p>로그인 이메일을 확인하고 비밀번호를 변경합니다.</p>
              </div>
            </header>

            <div className="profile-email-row">
              <span className="profile-email-icon">
                <MailIcon />
              </span>

              <div>
                <span>로그인 이메일</span>
                <strong>{user.email}</strong>
              </div>

              <span className="profile-readonly-badge">
                변경 불가
              </span>
            </div>

            <form
              className="profile-password-form"
              onSubmit={handlePasswordSubmit}
              noValidate
            >
              <div className="profile-password-title">
                <span className="profile-password-icon">
                  <LockIcon />
                </span>

                <div>
                  <strong>비밀번호 변경</strong>
                  <span>현재 비밀번호 확인 후 새 비밀번호가 적용됩니다.</span>
                </div>
              </div>

              <PasswordField
                id="currentPassword"
                label="현재 비밀번호"
                value={currentPassword}
                placeholder="현재 비밀번호"
                autoComplete="current-password"
                visible={passwordVisible.current}
                error={passwordErrors.current}
                onChange={(value) =>
                  updatePasswordValue(
                    'current',
                    value,
                    setCurrentPassword,
                  )
                }
                onToggle={() =>
                  setPasswordVisible((previous) => ({
                    ...previous,
                    current: !previous.current,
                  }))
                }
              />

              <PasswordField
                id="newPassword"
                label="새 비밀번호"
                value={newPassword}
                placeholder="새 비밀번호"
                autoComplete="new-password"
                visible={passwordVisible.next}
                error={passwordErrors.next}
                onChange={(value) =>
                  updatePasswordValue(
                    'next',
                    value,
                    setNewPassword,
                  )
                }
                onToggle={() =>
                  setPasswordVisible((previous) => ({
                    ...previous,
                    next: !previous.next,
                  }))
                }
              />

              <div className="profile-password-rules">
                <span className={passwordRules.length ? 'valid' : ''}>
                  <CheckIcon /> 8자 이상
                </span>
                <span className={passwordRules.letter ? 'valid' : ''}>
                  <CheckIcon /> 영문
                </span>
                <span className={passwordRules.number ? 'valid' : ''}>
                  <CheckIcon /> 숫자
                </span>
                <span className={passwordRules.special ? 'valid' : ''}>
                  <CheckIcon /> 특수문자
                </span>
              </div>

              <PasswordField
                id="confirmPassword"
                label="새 비밀번호 확인"
                value={confirmPassword}
                placeholder="새 비밀번호 다시 입력"
                autoComplete="new-password"
                visible={passwordVisible.confirm}
                error={passwordErrors.confirm}
                onChange={(value) =>
                  updatePasswordValue(
                    'confirm',
                    value,
                    setConfirmPassword,
                  )
                }
                onToggle={() =>
                  setPasswordVisible((previous) => ({
                    ...previous,
                    confirm: !previous.confirm,
                  }))
                }
              />

              {passwordStatus && (
                <div
                  className={`profile-password-status ${passwordStatus.type}`}
                  role="status"
                >
                  {passwordStatus.type === 'success' && (
                    <CheckIcon />
                  )}
                  <span>{passwordStatus.message}</span>
                </div>
              )}

              <button
                type="submit"
                className="profile-password-submit profile-unified-button primary"
                disabled={passwordSubmitting}
              >
                {passwordSubmitting
                  ? '확인 중...'
                  : '비밀번호 변경'}
              </button>
            </form>
          </section>

          <section className="profile-danger-zone">
            <div>
              <strong>회원탈퇴</strong>
              <p>계정을 삭제하면 복구할 수 없습니다.</p>
            </div>

            <button
              type="button"
              className="profile-unified-button danger"
              onClick={onDeleteAccount}
            >
              회원탈퇴
            </button>
          </section>
        </div>
      </div>
    </main>
  )
}

export default ProfileEditWorkspace
