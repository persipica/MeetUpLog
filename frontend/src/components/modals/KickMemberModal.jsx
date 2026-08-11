import AppModal from '../common/AppModal'

const KickMemberModal = ({ open, member, onClose, onConfirm }) => (
  <AppModal open={open} title="참여자 강퇴" subtitle="강퇴된 사용자는 방장의 차단 해제 전까지 이 방에 다시 참여할 수 없습니다." onClose={onClose} size="small">
    <div className="confirm-modal-content">
      <div className="confirm-member-avatar">{member?.nickname?.slice(0, 1) ?? '?'}</div>
      <p><strong>{member?.nickname}</strong>님을<br />이 채팅방에서 강퇴할까요?</p>
      <div className="modal-action-row"><button type="button" className="secondary-action" onClick={onClose}>취소</button><button type="button" className="danger-action" onClick={() => onConfirm(member)}>강퇴</button></div>
    </div>
  </AppModal>
)

export default KickMemberModal
