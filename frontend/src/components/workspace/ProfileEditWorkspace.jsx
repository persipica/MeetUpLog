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
  KakaoIcon,
  LockIcon,
  MailIcon,
  ShieldIcon,
  UserPlusIcon,
} from '../common/Icons'

import { getPresence } from '../../config/presence'

const PASSWORD_MIN_LENGTH = 8
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    className={`profile-password-field ${error ? 'invalid' : ''}`}
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
        onChange={(event) => onChange(event.target.value)}
      />
      <button
        type="button"
        aria-label={visible ? `${label} 숨기기` : `${label} 보기`}
        onClick={onToggle}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
    {error && <small role="alert">{error}</small>}
  </label>
)

const GuestConversionCard = ({ user, onConvertGuest }) => {
  const [expanded, setExpanded] = useState(false)
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState(user.nickname ?? '')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [visible, setVisible] = useState({ password: false, confirm: false })
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const validate = () => {
    const nextErrors = {}

    if (!EMAIL_PATTERN.test(email.trim())) {
      nextErrors.email = '올바른 이메일을 입력해 주세요.'
    }
    if (nickname.trim().length < 2) {
      nextErrors.nickname = '닉네임은 2자 이상 입력해 주세요.'
    }
    if (
      password.length < PASSWORD_MIN_LENGTH ||
      !/[A-Za-z]/.test(password) ||
      !/\d/.test(password) ||
      !/[^A-Za-z0-9]/.test(password)
    ) {
      nextErrors.password =
        '8자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.'
    }
    if (password !== passwordConfirm) {
      nextErrors.confirm = '비밀번호가 일치하지 않습니다.'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!validate()) return

    setSubmitting(true)
    try {
      await onConvertGuest?.({
        email: email.trim().toLowerCase(),
        nickname: nickname.trim(),
        password,
      })
    } catch (error) {
      setErrors({
        submit: error?.message || '일반 회원으로 전환하지 못했습니다.',
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="profile-setting-card profile-guest-conversion-card">
      <header className="profile-card-heading">
        <div className="profile-card-heading-icon"><UserPlusIcon /></div>
        <div>
          <span>GUEST UPGRADE</span>
          <h2>일반 회원으로 전환하기</h2>
          <p>현재 참여 중인 채팅방 기록을 유지한 채 정식 계정으로 전환합니다.</p>
        </div>
      </header>

      <div className="profile-guest-benefits">
        <span><CheckIcon /> 친구 추가와 알림 기능</span>
        <span><CheckIcon /> 새 채팅방 생성과 초대</span>
        <span><CheckIcon /> 프로필 및 계정 설정</span>
      </div>

      {!expanded ? (
        <button
          type="button"
          className="profile-unified-button primary profile-guest-start"
          onClick={() => setExpanded(true)}
        >
          <UserPlusIcon /> 일반회원으로 전환하기
        </button>
      ) : (
        <form className="profile-guest-conversion-form" onSubmit={handleSubmit} noValidate>
          <label
            className={`profile-text-field ${errors.email ? 'invalid' : ''}`}
            htmlFor="guestConvertEmail"
          >
            <span>이메일</span>
            <input
              id="guestConvertEmail"
              type="email"
              value={email}
              placeholder="로그인에 사용할 이메일"
              autoComplete="email"
              onChange={(event) => {
                setEmail(event.target.value)
                setErrors((previous) => ({ ...previous, email: '' }))
              }}
            />
            {errors.email && <small>{errors.email}</small>}
          </label>

          <label
            className={`profile-text-field ${errors.nickname ? 'invalid' : ''}`}
            htmlFor="guestConvertNickname"
          >
            <span>닉네임</span>
            <input
              id="guestConvertNickname"
              value={nickname}
              maxLength={50}
              onChange={(event) => {
                setNickname(event.target.value)
                setErrors((previous) => ({ ...previous, nickname: '' }))
              }}
            />
            {errors.nickname && <small>{errors.nickname}</small>}
          </label>

          <PasswordField
            id="guestConvertPassword"
            label="비밀번호"
            value={password}
            placeholder="영문, 숫자, 특수문자 포함 8자 이상"
            autoComplete="new-password"
            visible={visible.password}
            error={errors.password}
            onChange={(value) => {
              setPassword(value)
              setErrors((previous) => ({ ...previous, password: '' }))
            }}
            onToggle={() =>
              setVisible((previous) => ({
                ...previous,
                password: !previous.password,
              }))
            }
          />

          <PasswordField
            id="guestConvertPasswordConfirm"
            label="비밀번호 확인"
            value={passwordConfirm}
            placeholder="비밀번호를 한 번 더 입력"
            autoComplete="new-password"
            visible={visible.confirm}
            error={errors.confirm}
            onChange={(value) => {
              setPasswordConfirm(value)
              setErrors((previous) => ({ ...previous, confirm: '' }))
            }}
            onToggle={() =>
              setVisible((previous) => ({
                ...previous,
                confirm: !previous.confirm,
              }))
            }
          />

          {errors.submit && (
            <div className="profile-password-status error" role="alert">
              {errors.submit}
            </div>
          )}

          <div className="profile-edit-actions">
            <button
              type="button"
              className="profile-unified-button secondary"
              onClick={() => setExpanded(false)}
            >
              취소
            </button>
            <button
              type="submit"
              className="profile-unified-button primary"
              disabled={submitting}
            >
              {submitting ? '전환 중...' : '계정 전환'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

const ProfileEditWorkspace = ({
  user,
  onBack,
  onSave,
  onUploadProfileImage,
  onRemoveProfileImage,
  onChangePassword,
  onDeleteAccount,
  onUnlinkKakao,
  onConvertGuest,
}) => {
  const fileInputRef = useRef(null)
  const accountType = user.accountType ?? 'MEMBER'
  const isKakao = accountType === 'SOCIAL' || user.kakaoLinked === true
  const isGuest = accountType === 'GUEST'
  const isMember = !isKakao && !isGuest

  const [nickname, setNickname] = useState(user.nickname ?? '')
  const [statusMessage, setStatusMessage] = useState(user.statusMessage ?? '')
  const [profileImageUrl, setProfileImageUrl] = useState(user.profileImageUrl ?? null)
  const [profileSubmitting, setProfileSubmitting] = useState(false)
  const [profileStatus, setProfileStatus] = useState(null)
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
    setNickname(user.nickname ?? '')
    setStatusMessage(user.statusMessage ?? '')
    setProfileImageUrl(user.profileImageUrl ?? null)
  }, [user.nickname, user.statusMessage, user.profileImageUrl])

  const previewUser = {
    ...user,
    nickname: nickname || user.nickname,
    statusMessage,
    profileImageUrl,
  }
  const presence = getPresence(user.presence ?? 'ONLINE')

  const passwordRules = useMemo(
    () => ({
      length: newPassword.length >= PASSWORD_MIN_LENGTH,
      letter: /[A-Za-z]/.test(newPassword),
      number: /\d/.test(newPassword),
      special: /[^A-Za-z0-9]/.test(newPassword),
    }),
    [newPassword],
  )

  const handleImageChange = async (event) => {
    if (!isMember) return
    const file = event.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setProfileStatus({
        type: 'error',
        message: 'JPG 또는 PNG 이미지만 업로드할 수 있습니다.',
      })
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setProfileStatus({
        type: 'error',
        message: '프로필 이미지는 5MB 이하만 업로드할 수 있습니다.',
      })
      return
    }

    setProfileSubmitting(true)
    setProfileStatus(null)

    try {
      const uploaded = await onUploadProfileImage?.(file)
      if (uploaded?.profileImageUrl) {
        setProfileImageUrl(uploaded.profileImageUrl)
      }
    } catch (error) {
      setProfileStatus({
        type: 'error',
        message: error?.message || '프로필 사진을 업로드하지 못했습니다.',
      })
    } finally {
      setProfileSubmitting(false)
      event.target.value = ''
    }
  }

  const handleProfileSave = async () => {
    setProfileSubmitting(true)
    setProfileStatus(null)
    try {
      const values = isKakao
        ? { statusMessage: statusMessage.trim() }
        : {
            nickname: nickname.trim(),
            statusMessage: statusMessage.trim(),
            profileImageUrl,
          }

      await onSave?.(values)
      setProfileStatus({ type: 'success', message: '프로필이 저장되었습니다.' })
    } catch (error) {
      setProfileStatus({
        type: 'error',
        message: error?.message || '프로필을 저장하지 못했습니다.',
      })
    } finally {
      setProfileSubmitting(false)
    }
  }

  const handleRemoveProfileImage = async () => {
    if (!isMember) return

    setProfileSubmitting(true)
    setProfileStatus(null)

    try {
      const updated = await onRemoveProfileImage?.()
      setProfileImageUrl(updated?.profileImageUrl ?? null)
    } catch (error) {
      setProfileStatus({
        type: 'error',
        message: error?.message || '프로필 사진을 제거하지 못했습니다.',
      })
    } finally {
      setProfileSubmitting(false)
    }
  }

  const updatePasswordValue = (field, value, setter) => {
    setter(value)
    setPasswordStatus(null)
    setPasswordErrors((previous) => ({ ...previous, [field]: '' }))
  }

  const validatePassword = () => {
    const errors = {}
    if (!currentPassword) errors.current = '현재 비밀번호를 입력해 주세요.'
    if (!newPassword) {
      errors.next = '새 비밀번호를 입력해 주세요.'
    } else if (
      !passwordRules.length ||
      !passwordRules.letter ||
      !passwordRules.number ||
      !passwordRules.special
    ) {
      errors.next = '8자 이상이며 영문, 숫자, 특수문자를 포함해야 합니다.'
    } else if (newPassword === currentPassword) {
      errors.next = '현재 비밀번호와 다른 비밀번호를 입력해 주세요.'
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
    if (!validatePassword()) return

    setPasswordSubmitting(true)
    try {
      await onChangePassword?.({ currentPassword, newPassword })
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
        setPasswordErrors({ current: error.message })
      } else {
        setPasswordStatus({
          type: 'error',
          message: error?.message || '비밀번호를 변경하지 못했습니다.',
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
        <h1>{isGuest ? '게스트 계정' : '프로필 및 계정'}</h1>
        <p>
          {isGuest
            ? '일반 회원으로 전환하면 MeetupLog의 모든 기능을 이용할 수 있습니다.'
            : '공개 프로필과 로그인 보안 정보를 한곳에서 관리합니다.'}
        </p>
      </header>

      <div className="profile-edit-layout">
        <aside className="profile-edit-preview">
          <PresenceBanner
            presence={user.presence ?? 'ONLINE'}
            size="hero"
            className="profile-preview-banner"
          />
          <div className="profile-preview-card">
            <div className="profile-preview-avatar-wrap">
              <UserAvatar user={previewUser} className="profile-edit-avatar" />
            </div>
            <strong>{previewUser.nickname}</strong>
            <span className="profile-preview-presence">{presence.label}</span>
            <p>
              {statusMessage ||
                (isGuest ? '게스트로 참여 중' : '상태 메시지가 없습니다.')}
            </p>
          </div>
        </aside>

        <div className="profile-edit-content">
          {isGuest ? (
            <GuestConversionCard user={user} onConvertGuest={onConvertGuest} />
          ) : (
            <>
              <section className="profile-setting-card profile-basic-card">
                <header className="profile-card-heading">
                  <div>
                    <span>PUBLIC PROFILE</span>
                    <h2>공개 프로필</h2>
                    <p>
                      {isKakao
                        ? '카카오 프로필 정보와 MeetupLog 상태 메시지입니다.'
                        : '다른 사용자에게 보이는 정보입니다.'}
                    </p>
                  </div>
                </header>

                <div className="profile-photo-control">
                  <UserAvatar user={previewUser} className="profile-photo-control-avatar" />
                  <div className="profile-photo-copy">
                    <strong>{isKakao ? '카카오 프로필 사진' : '프로필 사진'}</strong>
                    <span>
                      {isKakao
                        ? '카카오에서 가져온 사진으로 MeetupLog에서는 변경할 수 없습니다.'
                        : 'JPG 또는 PNG 이미지를 사용할 수 있어요.'}
                    </span>
                    {isMember && (
                      <div className="profile-photo-actions">
                        <button
                          type="button"
                          className="profile-unified-button primary"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          사진 변경
                        </button>
                        {profileImageUrl && (
                          <button
                            type="button"
                            className="profile-unified-button secondary"
                            onClick={handleRemoveProfileImage}
                          >
                            제거
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {isKakao && (
                    <span className="profile-readonly-badge kakao">카카오에서 관리</span>
                  )}
                  {isMember && (
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png"
                      hidden
                      onChange={handleImageChange}
                    />
                  )}
                </div>

                <div className="profile-field-grid">
                  <label
                    className={`profile-text-field ${isKakao ? 'readonly' : ''}`}
                    htmlFor="editNickname"
                  >
                    <span>
                      닉네임
                      <small>
                        {isKakao ? '카카오에서 관리' : `${nickname.length}/50`}
                      </small>
                    </span>
                    <input
                      id="editNickname"
                      value={nickname}
                      maxLength={50}
                      readOnly={isKakao}
                      disabled={isKakao}
                      placeholder="닉네임을 입력하세요"
                      onChange={(event) => setNickname(event.target.value)}
                    />
                  </label>

                  <label
                    className="profile-text-field profile-status-field"
                    htmlFor="editStatusMessage"
                  >
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
                      onChange={(event) => setStatusMessage(event.target.value)}
                    />
                  </label>
                </div>

                {profileStatus && (
                  <div
                    className={`profile-password-status ${profileStatus.type}`}
                    role="status"
                  >
                    {profileStatus.type === 'success' && <CheckIcon />}
                    <span>{profileStatus.message}</span>
                  </div>
                )}

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
                    disabled={profileSubmitting || (isMember && !nickname.trim())}
                    onClick={handleProfileSave}
                  >
                    {profileSubmitting ? '저장 중...' : '프로필 저장'}
                  </button>
                </div>
              </section>

              <section className="profile-setting-card profile-security-card">
                <header className="profile-card-heading">
                  <div className="profile-card-heading-icon">
                    {isKakao ? <KakaoIcon /> : <ShieldIcon />}
                  </div>
                  <div>
                    <span>ACCOUNT SECURITY</span>
                    <h2>계정 및 보안</h2>
                    <p>
                      {isKakao
                        ? '현재 연동된 카카오 계정 정보입니다.'
                        : '로그인 이메일을 확인하고 비밀번호를 변경합니다.'}
                    </p>
                  </div>
                </header>

                <div className="profile-email-row">
                  <span className="profile-email-icon">
                    {isKakao ? <KakaoIcon /> : <MailIcon />}
                  </span>
                  <div>
                    <span>{isKakao ? '연동된 카카오 이메일' : '로그인 이메일'}</span>
                    <strong>{user.email || '이메일 정보를 제공받지 못했습니다.'}</strong>
                  </div>
                  <span className="profile-readonly-badge">
                    {isKakao ? '카카오 연동' : '변경 불가'}
                  </span>
                </div>

                {isKakao ? (
                  <div className="profile-kakao-notice">
                    <KakaoIcon />
                    <p>
                      비밀번호와 기본 프로필은 카카오에서 관리합니다.
                      MeetupLog에서는 상태 메시지만 변경할 수 있습니다.
                    </p>
                  </div>
                ) : (
                  <form className="profile-password-form" onSubmit={handlePasswordSubmit} noValidate>
                    <div className="profile-password-title">
                      <span className="profile-password-icon"><LockIcon /></span>
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
                        updatePasswordValue('current', value, setCurrentPassword)
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
                        updatePasswordValue('next', value, setNewPassword)
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
                        updatePasswordValue('confirm', value, setConfirmPassword)
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
                        {passwordStatus.type === 'success' && <CheckIcon />}
                        <span>{passwordStatus.message}</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="profile-password-submit profile-unified-button primary"
                      disabled={passwordSubmitting}
                    >
                      {passwordSubmitting ? '확인 중...' : '비밀번호 변경'}
                    </button>
                  </form>
                )}
              </section>

              <section className="profile-danger-zone">
                <div>
                  <strong>{isKakao ? '카카오 연동 해제' : '회원탈퇴'}</strong>
                  <p>
                    {isKakao
                      ? '카카오 연결과 MeetupLog 로그인 세션을 해제합니다.'
                      : '계정을 삭제하면 복구할 수 없습니다.'}
                  </p>
                </div>
                <button
                  type="button"
                  className="profile-unified-button danger"
                  onClick={isKakao ? onUnlinkKakao : onDeleteAccount}
                >
                  {isKakao ? '연동 해제' : '회원탈퇴'}
                </button>
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  )
}

export default ProfileEditWorkspace
