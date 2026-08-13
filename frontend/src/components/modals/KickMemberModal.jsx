import { useEffect, useState } from 'react'

import AppModal from '../common/AppModal'

const MAX_REASON_LENGTH = 200

const KickMemberModal = ({ open, member, onClose, onConfirm }) => {
  const [reason, setReason] = useState('')

  useEffect(() => {
    if (open) setReason('')
  }, [open, member?.id])

  const handleSubmit = (event) => {
    event.preventDefault()
    onConfirm?.(member, reason.trim())
  }

  return (
    <AppModal
      open={open}
      title="참여자 내보내기"
      subtitle="강퇴된 사용자는 방장의 차단 해제 전까지 이 방에 다시 참여할 수 없습니다."
      onClose={onClose}
      size="small"
    >
      <form className="confirm-modal-content kick-member-form" onSubmit={handleSubmit}>
        <div className="confirm-member-avatar">{member?.nickname?.slice(0, 1) ?? '?'}</div>
        <p><strong>{member?.nickname}</strong>님을<br />이 채팅방에서 내보낼까요?</p>

        <label className="kick-reason-field">
          <span className="kick-reason-label">
            <strong>강퇴 사유</strong>
            <em>선택사항</em>
          </span>
          <textarea
            value={reason}
            maxLength={MAX_REASON_LENGTH}
            placeholder="상대방에게 전달할 사유를 입력하세요."
            onChange={(event) => setReason(event.target.value)}
          />
          <span className="kick-reason-meta">
            {reason.trim() ? '입력한 사유가 상대방에게 표시됩니다.' : '입력하지 않아도 강퇴할 수 있습니다.'}
            <small>{reason.length}/{MAX_REASON_LENGTH}</small>
          </span>
        </label>

        <div className="kick-warning-card">
          <span>!</span>
          <p>강퇴하면 해당 사용자는 즉시 채팅방에서 나가며, 입력한 사유가 있을 때만 안내 화면에 표시됩니다.</p>
        </div>

        <div className="modal-action-row">
          <button type="button" className="secondary-action" onClick={onClose}>취소</button>
          <button type="submit" className="danger-action">강퇴</button>
        </div>
      </form>
    </AppModal>
  )
}

export default KickMemberModal
