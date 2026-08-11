import { useMemo, useState } from 'react'
import AppModal from '../common/AppModal'
import { ROOM_THEMES } from '../../config/roomThemes'

const CATEGORY_KEYS = ['MOVIE', 'GAME', 'FOOD', 'TRAVEL', 'ETC']

const CreateRoomModal = ({ open, onClose, onCreate }) => {
  const [name, setName] = useState('')
  const [topicType, setTopicType] = useState('MOVIE')
  const [maxMembers, setMaxMembers] = useState(8)
  const selectedTheme = useMemo(() => ROOM_THEMES[topicType], [topicType])

  const handleCreate = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onCreate({ name: trimmed, topicType, maxMembers })
    setName('')
    setTopicType('MOVIE')
    setMaxMembers(8)
  }

  return (
    <AppModal open={open} title="새 채팅방 만들기" subtitle="모임의 목적에 맞는 카테고리를 고르면 채팅방 테마도 함께 바뀝니다." onClose={onClose} size="large">
      <div className="create-room-form">
        <section>
          <label className="form-label" htmlFor="roomName">채팅방 이름</label>
          <input id="roomName" className="form-input" value={name} maxLength={100} placeholder="예: 주말 영화방" onChange={(event) => setName(event.target.value)} />
        </section>

        <section>
          <span className="form-label">카테고리</span>
          <div className="category-grid">
            {CATEGORY_KEYS.map((key) => {
              const theme = ROOM_THEMES[key]
              return (
                <button key={key} type="button" className={`category-card ${topicType === key ? 'selected' : ''}`} style={{ '--category-accent': theme.accent, '--category-soft': theme.accentSoft }} onClick={() => setTopicType(key)}>
                  <span className="category-card-icon">{theme.icon}</span><strong>{theme.label}</strong><small>{theme.subtitle}</small>
                </button>
              )
            })}
          </div>
        </section>

        <section className="room-options-row">
          <div>
            <label className="form-label" htmlFor="maxMembers">최대 인원</label>
            <select id="maxMembers" className="form-input" value={maxMembers} onChange={(event) => setMaxMembers(Number(event.target.value))}>
              {[4, 6, 8, 10, 12, 16, 20].map((number) => <option key={number} value={number}>{number}명</option>)}
            </select>
          </div>

          <div className="room-theme-preview" style={{ '--preview-accent': selectedTheme.accent, '--preview-soft': selectedTheme.accentSoft }}>
            <span>{selectedTheme.icon}</span><div><strong>{name.trim() || '새 채팅방'}</strong><small>{selectedTheme.subtitle}</small></div>
          </div>
        </section>

        <footer className="modal-action-row">
          <button type="button" className="secondary-action" onClick={onClose}>취소</button>
          <button type="button" className="primary-action" disabled={!name.trim()} onClick={handleCreate}>채팅방 만들기</button>
        </footer>
      </div>
    </AppModal>
  )
}

export default CreateRoomModal
