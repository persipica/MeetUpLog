import {
  SearchIcon,
  UserPlusIcon,
} from '../common/Icons'

const FriendAddWorkspace = ({
  onBack,
}) => {
  return (
    <main className="friend-add-workspace">
      <button
        type="button"
        className="workspace-mobile-back"
        onClick={onBack}
      >
        ← 돌아가기
      </button>

      <header className="workspace-section-header">
        <div>
          <span>ADD FRIEND</span>
          <h1>친구 추가</h1>
          <p>
            닉네임이나 이메일로 MeetupLog 사용자를 찾아 친구 요청을 보낼 수 있어요.
          </p>
        </div>
      </header>

      <section className="friend-add-panel liquid-menu-surface">
        <label className="form-label" htmlFor="friendSearch">
          사용자 검색
        </label>

        <div className="friend-add-search liquid-menu-surface">
          <span><SearchIcon /></span>

          <input
            id="friendSearch"
            type="search"
            placeholder="닉네임 또는 이메일을 입력하세요"
          />

          <button
            type="button"
            onClick={() =>
              alert('친구 검색 API는 백엔드 연결 단계에서 구현합니다.')
            }
          >
            검색
          </button>
        </div>

        <div className="friend-add-guide liquid-menu-surface">
          <div className="friend-add-guide-icon"><UserPlusIcon /></div>

          <div>
            <strong>친구를 찾아보세요</strong>
            <p>
              검색 결과가 이 영역에 표시되고, 바로 친구 요청을 보낼 수 있게 됩니다.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}

export default FriendAddWorkspace
