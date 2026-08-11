import AppModal from '../common/AppModal'

const NotificationsModal = ({ open, notifications, onClose, onReadAll }) => (
  <AppModal open={open} title="알림" subtitle="채팅방 초대, 친구 요청과 모임의 중요한 변경사항을 확인합니다." onClose={onClose} size="large">
    <div className="notification-modal-toolbar"><span>최근 알림 {notifications.length}개</span><button type="button" onClick={onReadAll}>모두 읽음</button></div>
    <div className="notification-list">
      {notifications.map((notification) => (
        <article key={notification.id} className={`notification-item ${notification.read ? 'read' : 'unread'}`}>
          <div className="notification-icon">{notification.type === 'INVITE' ? '✉' : notification.type === 'FRIEND' ? '👤' : '✓'}</div>
          <div className="notification-body"><strong>{notification.title}</strong><p>{notification.body}</p><span>{notification.time}</span></div>
          {!notification.read && <span className="notification-dot" />}
        </article>
      ))}
    </div>
  </AppModal>
)

export default NotificationsModal
