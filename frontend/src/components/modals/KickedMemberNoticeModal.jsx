import AppModal from '../common/AppModal'

const KickedMemberNoticeModal = ({ notice, onConfirm }) => (
  <AppModal
    open={notice !== null}
    title="채팅방에서 내보내졌습니다"
    subtitle="방장에 의해 참여가 종료되었습니다."
    onClose={onConfirm}
    size="small"
  >
    {notice && (
      <div className="kicked-member-notice">
        <div className="kicked-notice-icon">!</div>
        <strong>‘{notice.roomName}’ 채팅방에서 내보내졌어요.</strong>
        <p>더 이상 이 채팅방의 대화와 참여자 정보를 확인할 수 없습니다.</p>

        {notice.reason && (
          <div className="kicked-reason-message">
            <span>방장이 전달한 사유</span>
            <p>{notice.reason}</p>
          </div>
        )}

        <button type="button" className="primary-action full-width-action" onClick={onConfirm}>확인</button>
      </div>
    )}
  </AppModal>
)

export default KickedMemberNoticeModal
