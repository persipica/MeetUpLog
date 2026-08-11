const UserAvatar = ({
  user,
  className = '',
}) => {
  const initial =
    user?.nickname?.slice(0, 1) ??
    '?'

  return (
    <span
      className={`user-avatar ${className}`}
    >
      {user?.profileImageUrl ? (
        <img
          src={user.profileImageUrl}
          alt={`${user.nickname} 프로필`}
        />
      ) : (
        <span>{initial}</span>
      )}
    </span>
  )
}

export default UserAvatar
