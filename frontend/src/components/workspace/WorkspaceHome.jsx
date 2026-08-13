import {
  getRoomTheme,
} from '../../config/roomThemes'

import {
  ArrowRightIcon,
  PlusIcon,
  UsersIcon,
} from '../common/Icons'

const WorkspaceHome = ({
  user,
  rooms,
  onSelectRoom,
  onCreateRoom,
}) => {
  const recentRooms = rooms.slice(0, 3)

  return (
    <main className="workspace-home">
      <div
        className="main-home-ambient"
        aria-hidden="true"
      />

      <div className="main-home-content">
        <section className="main-home-hero">
          <div className="main-home-hero-copy">
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
              <PlusIcon />
              새 채팅방 만들기
            </button>
          </div>

          <div
            className="main-home-visual"
            aria-hidden="true"
          >
            <div className="meetup-orbit">
              <span className="meetup-orbit-ring ring-one" />
              <span className="meetup-orbit-ring ring-two" />
              <span className="meetup-orbit-node node-movie">🎬</span>
              <span className="meetup-orbit-node node-game">🎮</span>
              <span className="meetup-orbit-node node-food">🍽️</span>
              <span className="meetup-orbit-core">M</span>
            </div>

            <div className="main-home-visual-copy">
              <strong>함께 고르는 대화</strong>
              <span>{rooms.length}개의 모임이 이어지고 있어요</span>
            </div>
          </div>
        </section>

        {recentRooms.length > 0 && (
          <section className="main-home-recent">
            <div className="main-home-section-title">
              <div>
                <span>RECENT</span>
                <h2>최근 대화</h2>
              </div>

              <small>
                {rooms.length}개의 채팅방
              </small>
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
                    <span className="main-home-room-accent" />

                    <div className="main-home-room-card-top">
                      <span className="main-home-room-icon">
                        {theme.icon}
                      </span>

                      {room.unreadCount > 0 && (
                        <strong className="main-home-room-unread">
                          {room.unreadCount}
                        </strong>
                      )}
                    </div>

                    <h3>{room.name}</h3>
                    <p>{room.lastMessage}</p>

                    <footer>
                      <span>
                        {theme.label}
                        <i />
                        <UsersIcon />
                        {room.memberCount}
                      </span>

                      <span className="main-home-room-open">
                        열기
                        <ArrowRightIcon />
                      </span>
                    </footer>
                  </button>
                )
              })}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

export default WorkspaceHome
