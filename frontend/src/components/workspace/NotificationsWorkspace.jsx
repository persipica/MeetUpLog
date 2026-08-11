const NotificationsWorkspace = ({
  notifications,
  onBack,
  onDelete,
  onDeleteAll,
  onMarkAllRead,
}) => {
  const unreadCount = notifications.filter(
    (notification) => !notification.read,
  ).length

  return (
    <main className="notifications-workspace">
      <button
        type="button"
        className="workspace-mobile-back"
        onClick={onBack}
      >
        ← 돌아가기
      </button>

      <header className="workspace-section-header notifications-header">
        <div>
          <span>NOTIFICATIONS</span>
          <h1>알림</h1>
          <p>
            채팅방 초대, 친구 요청과 모임의 중요한 변경사항을 한곳에서 확인합니다.
          </p>
        </div>

        <div className="notifications-actions">
          <button
            type="button"
            className="workspace-secondary-button"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
          >
            모두 읽음
          </button>

          <button
            type="button"
            className="workspace-danger-button"
            onClick={onDeleteAll}
            disabled={notifications.length === 0}
          >
            알림 모두 지우기
          </button>
        </div>
      </header>

      <section className="notifications-summary">
        <div>
          <span>전체</span>
          <strong>{notifications.length}</strong>
        </div>

        <div>
          <span>읽지 않음</span>
          <strong>{unreadCount}</strong>
        </div>
      </section>

      <section className="workspace-notification-list">
        {notifications.length === 0 ? (
          <div className="notifications-empty">
            <span>✓</span>
            <strong>새 알림이 없습니다</strong>
            <p>새로운 소식이 생기면 이곳에 표시됩니다.</p>
          </div>
        ) : (
          notifications.map((notification) => (
            <article
              key={notification.id}
              className={`workspace-notification-item ${
                notification.read ? 'read' : 'unread'
              }`}
            >
              <div className="workspace-notification-icon">
                {notification.type === 'INVITE'
                  ? '✉'
                  : notification.type === 'FRIEND'
                    ? '👤'
                    : '✓'}
              </div>

              <div className="workspace-notification-body">
                <div>
                  <strong>{notification.title}</strong>

                  {!notification.read && (
                    <span className="workspace-new-badge">NEW</span>
                  )}
                </div>

                <p>{notification.body}</p>
                <span>{notification.time}</span>
              </div>

              <button
                type="button"
                className="notification-delete-button"
                aria-label={`${notification.title} 알림 지우기`}
                onClick={() => onDelete(notification.id)}
              >
                ×
              </button>
            </article>
          ))
        )}
      </section>
    </main>
  )
}

export default NotificationsWorkspace
