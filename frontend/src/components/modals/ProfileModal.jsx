import { useState } from 'react'
import AppModal from '../common/AppModal'

const ProfileModal = ({ open, user, onClose }) => {
  const [nickname, setNickname] = useState(user.nickname)

  return (
    <AppModal open={open} title="내 프로필" subtitle="MeetupLog에서 표시할 기본 정보를 관리합니다." onClose={onClose}>
      <div className="profile-modal">
        <div className="profile-large-avatar">{nickname.slice(0, 1) || '?'}</div>
        <label className="form-label" htmlFor="profileNickname">닉네임</label>
        <input id="profileNickname" className="form-input" value={nickname} maxLength={50} onChange={(event) => setNickname(event.target.value)} />
        <label className="form-label" htmlFor="profileEmail">이메일</label>
        <input id="profileEmail" className="form-input" value={user.email} disabled />
        <footer className="modal-action-row"><button type="button" className="secondary-action" onClick={onClose}>닫기</button><button type="button" className="primary-action" onClick={() => { alert('프로필 저장 API는 백엔드 연결 단계에서 구현합니다.'); onClose() }}>저장</button></footer>
      </div>
    </AppModal>
  )
}

export default ProfileModal
