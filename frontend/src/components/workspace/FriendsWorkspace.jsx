const FriendsWorkspace = ({ friends, onAddFriend }) => (
  <main className="friends-workspace">
    <header className="workspace-section-header">
      <div><span>FRIENDS</span><h1>친구</h1><p>함께 모임을 만들 사람들을 관리합니다.</p></div>
      <button type="button" className="workspace-primary-button" onClick={onAddFriend}>＋ 친구 추가</button>
    </header>

    <div className="friend-search-box"><span>⌕</span><input type="search" placeholder="친구 검색" /></div>

    <section className="friend-grid">
      {friends.map((friend) => (
        <article key={friend.id} className="friend-card">
          <div className="friend-card-avatar">{friend.nickname.slice(0, 1)}<span className={friend.online ? 'online active' : 'online'} /></div>
          <div className="friend-card-info"><strong>{friend.nickname}</strong><span>{friend.statusMessage || '상태 메시지가 없습니다.'}</span></div>
          <button type="button" aria-label={`${friend.nickname} 더보기`}>⋯</button>
        </article>
      ))}
    </section>
  </main>
)

export default FriendsWorkspace
