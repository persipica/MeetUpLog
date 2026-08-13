import {
  MoreIcon,
  PlusIcon,
  SearchIcon,
} from '../common/Icons'
import PresenceOrb from '../common/PresenceOrb'
import UserAvatar from '../common/UserAvatar'

import {
  getPresence,
} from '../../config/presence'

const FriendsWorkspace = ({ friends, onAddFriend }) => (
  <main className="friends-workspace">
    <header className="workspace-section-header">
      <div><span>FRIENDS</span><h1>친구</h1><p>함께 모임을 만들 사람들을 관리합니다.</p></div>
      <button type="button" className="workspace-primary-button" onClick={onAddFriend}><PlusIcon /> 친구 추가</button>
    </header>

    <div className="friend-search-box"><span><SearchIcon /></span><input type="search" placeholder="친구 검색" /></div>

    <section className="friend-grid">
      {friends.map((friend) => {
        const presence = getPresence(friend.presence)

        return (
          <article key={friend.id} className="friend-card">
            <div className="friend-card-avatar">
              <UserAvatar user={friend} />
              <PresenceOrb presence={friend.presence} size="mini" animated />
            </div>
            <div className="friend-card-info">
              <strong>{friend.nickname}</strong>
              <span>{friend.statusMessage || presence.label}</span>
              <small>{presence.label}</small>
            </div>
            <button type="button" aria-label={`${friend.nickname} 더보기`}><MoreIcon /></button>
          </article>
        )
      })}
    </section>
  </main>
)

export default FriendsWorkspace
