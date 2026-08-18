import {
  useEffect,
  useState,
} from 'react'

const UserAvatar = ({
  user,
  className = '',
}) => {
  const profileImageUrl =
    user?.profileImageUrl ??
    user?.profile_image_url ??
    null

  const [imageFailed, setImageFailed] =
    useState(false)

  useEffect(() => {
    setImageFailed(false)
  }, [profileImageUrl])

  const initial =
    user?.nickname?.slice(0, 1) ??
    '?'

  return (
    <span
      className={`user-avatar ${className}`}
    >
      {profileImageUrl && !imageFailed ? (
        <img
          src={profileImageUrl}
          alt={`${user?.nickname ?? '사용자'} 프로필`}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  )
}

export default UserAvatar
