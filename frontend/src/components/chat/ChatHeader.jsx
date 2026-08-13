import {
  MoreIcon,
  UsersIcon,
} from '../common/Icons'

const ChatHeader = ({ room, theme, memberCount, isOwner, onBack, onOpenMembers, onOpenRoomMenu }) => {
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
        <button type="button" className="member-count-button" onClick={onOpenMembers}><UsersIcon /><span>{memberCount}</span></button>
        <button type="button" className="header-more-button" onClick={onOpenRoomMenu} aria-label="채팅방 메뉴"><MoreIcon /></button>
      </div>
    </header>
  )
}

export default ChatHeader
