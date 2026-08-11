import {
  getRoomTheme,
} from '../../config/roomThemes'

const WorkspaceHome = ({
  user,
  rooms,
  onSelectRoom,
  onCreateRoom,
}) => {
  const recentRooms = rooms.slice(0, 3)

  return (
    <div className="main-home-content">
      <div
        className="main-home-ambient"
        aria-hidden="true"
      >
        <span />
        <span />
        <span />
      </div>

      <section className="main-home-hero">
        <span className="main-home-eyebrow">
          MEETUPLOG
        </span>

        <h1>
          안녕하세요,
          <br />
          {user.nickname}님.
        </h1>

        <p>
          대화를 시작하고 사람들의 의견을 모아
          <br />
          함께 더 좋은 결정을 만들어보세요.
        </p>

        <button
          type="button"
          className="main-home-create"
          onClick={onCreateRoom}
        >
          <span>＋</span>
          새 채팅방 만들기
        </button>
      </section>

      {recentRooms.length > 0 && (
        <section className="main-home-recent">
          <div className="main-home-section-title">
            <div>
              <span>RECENT</span>
              <h2>최근 대화</h2>
            </div>

            <span>
              {rooms.length}개의 채팅방
            </span>
          </div>

          <div className="main-home-room-grid">
            {recentRooms.map((room) => {
              const theme = getRoomTheme(
                room.topicType,
              )

              return (
                <button
                  key={room.id}
                  type="button"
                  className="main-home-room-card"
                  style={{
                    '--home-room-accent':
                      theme.accent,
                    '--home-room-soft':
                      theme.accentSoft,
                  }}
                  onClick={() =>
                    onSelectRoom(room.id)
                  }
                >
                  <div className="main-home-room-card-top">
                    <span>{theme.icon}</span>

                    {room.unreadCount > 0 && (
                      <strong>
                        {room.unreadCount}
                      </strong>
                    )}
                  </div>

                  <h3>{room.name}</h3>
                  <p>{room.lastMessage}</p>

                  <footer>
                    <span>
                      {theme.label}
                      {' · '}
                      👥 {room.memberCount}
                    </span>

                    <span>열기 →</span>
                  </footer>
                </button>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}

export default WorkspaceHome
