const ChatHeader = ({ room, theme, memberCount, isOwner, onBack, onOpenMembers, onOpenRoomMenu }) => {
  const handleCopyInvite = async () => {
    const inviteUrl = `${window.location.origin}/invite/demo-token`
    try {
      await navigator.clipboard.writeText(inviteUrl)
      alert('초대 링크를 복사했습니다.')
    } catch {
      alert(`초대 링크\n${inviteUrl}`)
    }
  }

  return (
    <header className="chat-header">
      <div className="chat-header-left">
        <button type="button" className="mobile-back-button" onClick={onBack} aria-label="메인 화면으로 돌아가기">←</button>
        <div className="chat-room-avatar">{theme.icon}</div>
        <div className="chat-room-info">
          <div className="chat-room-title-row"><h2>{room.name}</h2>{isOwner && <span className="owner-badge">방장</span>}</div>
          <div className="room-theme-description"><span>{theme.subtitle}</span><span className="header-dot">·</span><span>{memberCount}명 참여</span></div>
        </div>
      </div>

      <div className="chat-header-actions">
        <button type="button" className="member-count-button" onClick={onOpenMembers}><span>👥</span><span>{memberCount}</span></button>
        <button type="button" className="invite-button" onClick={handleCopyInvite}><span>🔗</span><span className="invite-button-label">초대</span></button>
        <button type="button" className="header-more-button" onClick={onOpenRoomMenu} aria-label="채팅방 메뉴">⋯</button>
      </div>
    </header>
  )
}

export default ChatHeader
