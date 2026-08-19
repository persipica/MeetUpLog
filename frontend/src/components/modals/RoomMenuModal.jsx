import {
  useEffect,
  useMemo,
  useState,
} from 'react'

import AppModal from '../common/AppModal'
import {
  BellIcon,
  BellOffIcon,
  LinkIcon,
  PencilIcon,
  TrashIcon,
  UsersIcon,
} from '../common/Icons'

const CATEGORY_LABELS = {
  MOVIE: '영화',
  GAME: '게임',
  FOOD: '음식',
  TRAVEL: '여행',
  ETC: '기타',
}

const NOTIFICATION_OPTIONS = [
  ['MUTE_30_MINUTES', '30분 동안 끄기'],
  ['MUTE_1_HOUR', '1시간 동안 끄기'],
  ['MUTE_2_HOURS', '2시간 동안 끄기'],
  ['MUTE_UNTIL_ENABLED', '다시 켜기까지 끄기'],
]

const formatDateTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const RoomMenuModal = ({
  open,
  room,
  memberCount,
  isOwner,
  inviteLink,
  onClose,
  onLoadInviteLink,
  onCreateInviteLink,
  onRevokeInviteLink,
  onLoadNotification,
  onUpdateNotification,
  onRenameRoom,
  onDeleteRoom,
  onLeaveRoom,
}) => {
  const [view, setView] = useState('ROOT')
  const [roomName, setRoomName] = useState(room?.name ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)

  useEffect(() => {
    if (!open) return
    setView('ROOT')
    setRoomName(room?.name ?? '')
    setBusy(false)
    setError('')
    setCopied(false)
    setConfirmAction(null)
  }, [open, room?.id, room?.name])

  const mutedLabel = useMemo(() => {
    if (!room?.notificationsMuted) return '알림 켜짐'
    if (room.notificationSetting === 'OFF') return '다시 켤 때까지 꺼짐'
    const until = formatDateTime(room.notificationMutedUntil)
    return until ? `${until}까지 꺼짐` : '알림 꺼짐'
  }, [room?.notificationMutedUntil, room?.notificationSetting, room?.notificationsMuted])

  if (!room) return null

  const runAction = async (action) => {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (actionError) {
      setError(actionError?.message || '요청을 처리하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const moveTo = (nextView) => {
    setError('')
    setConfirmAction(null)
    setView(nextView)
    if (nextView === 'INVITE') {
      runAction(() => onLoadInviteLink?.())
    }
    if (nextView === 'NOTIFICATIONS') {
      runAction(() => onLoadNotification?.())
    }
  }

  const copyInviteLink = async () => {
    if (!inviteLink?.invitePath) return
    await navigator.clipboard.writeText(`${window.location.origin}${inviteLink.invitePath}`)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const renderRoot = () => (
    <div className="room-menu-list">
      <button type="button" onClick={() => moveTo('INFO')}>
        <UsersIcon />
        <span>채팅방 정보</span>
        <i>›</i>
      </button>

      {isOwner && (
        <button type="button" onClick={() => moveTo('INVITE')}>
          <LinkIcon />
          <span>초대 링크 관리</span>
          <i>›</i>
        </button>
      )}

      <button type="button" onClick={() => moveTo('NOTIFICATIONS')}>
        {room.notificationsMuted ? <BellOffIcon /> : <BellIcon />}
        <span>알림 설정</span>
        <em className={room.notificationsMuted ? 'muted' : ''}>{mutedLabel}</em>
        <i>›</i>
      </button>

      <button type="button" onClick={() => moveTo(isOwner ? 'SETTINGS' : 'LEAVE')}>
        {isOwner ? <PencilIcon /> : <span className="room-menu-leave-icon">↗</span>}
        <span>{isOwner ? '채팅방 설정' : '채팅방 나가기'}</span>
        <i>›</i>
      </button>
    </div>
  )

  const renderInfo = () => (
    <div className="room-menu-section">
      <div className="room-info-hero">
        <div className="room-info-icon">{room.topicType === 'MOVIE' ? '🎬' : '💬'}</div>
        <strong>{room.name}</strong>
        <span>{room.description || '함께 이야기를 나누는 채팅방입니다.'}</span>
      </div>
      <dl className="room-info-grid">
        <div><dt>카테고리</dt><dd>{CATEGORY_LABELS[room.topicType] ?? room.topicType}</dd></div>
        <div><dt>참여 인원</dt><dd>{memberCount} / {room.maxMembers}명</dd></div>
        <div><dt>방장</dt><dd>{room.createdByNickname || '확인 중'}</dd></div>
        <div><dt>채팅방 유형</dt><dd>{room.roomType === 'GROUP' ? '그룹 채팅' : room.roomType}</dd></div>
      </dl>
    </div>
  )

  const renderInvite = () => (
    <div className="room-menu-section">
      <div className="room-setting-card invite-management-card">
        <span className="room-setting-label">현재 초대 링크</span>
        {inviteLink?.inviteId ? (
          <>
            <div className="room-invite-current">
              <LinkIcon />
              <span>{inviteLink.invitePath || '활성 링크'}</span>
              {inviteLink.invitePath && (
                <button type="button" onClick={copyInviteLink}>{copied ? '복사됨' : '복사'}</button>
              )}
            </div>
            <small>
              {inviteLink.invitePath
                ? `${formatDateTime(inviteLink.expiresAt)}까지 · ${inviteLink.usedCount ?? 0}/${inviteLink.maxUses ?? 50}회 사용`
                : '기존 링크 주소는 보안상 다시 표시되지 않습니다. 재발급하면 새 주소를 확인할 수 있습니다.'}
            </small>
          </>
        ) : (
          <p className="room-setting-empty">사용 중인 초대 링크가 없습니다.</p>
        )}
      </div>

      <div className="room-menu-action-grid">
        {inviteLink?.inviteId && (
          <button
            type="button"
            className="secondary-action"
            disabled={busy}
            onClick={() => runAction(onRevokeInviteLink)}
          >
            링크 폐기
          </button>
        )}
        <button
          type="button"
          className="primary-action"
          disabled={busy}
          onClick={() => runAction(onCreateInviteLink)}
        >
          {inviteLink?.inviteId ? '새 링크 재발급' : '초대 링크 발급'}
        </button>
      </div>
    </div>
  )

  const renderNotifications = () => (
    <div className="room-menu-section">
      <div className={`room-notification-status ${room.notificationsMuted ? 'muted' : 'enabled'}`}>
        {room.notificationsMuted ? <BellOffIcon /> : <BellIcon />}
        <div><strong>{mutedLabel}</strong></div>
      </div>

      <div className="room-notification-options">
        {room.notificationsMuted && (
          <button
            type="button"
            className="notification-enable"
            disabled={busy}
            onClick={() => runAction(() => onUpdateNotification('ENABLED'))}
          >
            알림 다시 켜기
          </button>
        )}
        {NOTIFICATION_OPTIONS.map(([mode, label]) => (
          <button
            key={mode}
            type="button"
            disabled={busy}
            onClick={() => runAction(() => onUpdateNotification(mode))}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )

  const renderSettings = () => (
    <div className="room-menu-section">
      <label className="room-setting-field readonly">
        <span>카테고리</span>
        <input value={CATEGORY_LABELS[room.topicType] ?? room.topicType} readOnly />
      </label>
      <label className="room-setting-field">
        <span>채팅방 이름 <small>{roomName.length}/100</small></span>
        <input
          value={roomName}
          maxLength={100}
          onChange={(event) => setRoomName(event.target.value)}
        />
      </label>
      <button
        type="button"
        className="primary-action full-width-action"
        disabled={busy || !roomName.trim() || roomName.trim() === room.name}
        onClick={() => runAction(() => onRenameRoom(roomName.trim()))}
      >
        변경사항 저장
      </button>

      <div className="room-danger-zone">
        <div><strong>채팅방 삭제</strong><span>모든 참여자에게서 채팅방이 사라집니다.</span></div>
        {confirmAction === 'DELETE' ? (
          <div className="room-confirm-actions">
            <button type="button" className="secondary-action" onClick={() => setConfirmAction(null)}>취소</button>
            <button type="button" className="danger-action" disabled={busy} onClick={() => runAction(onDeleteRoom)}>삭제</button>
          </div>
        ) : (
          <button type="button" className="danger-action" onClick={() => setConfirmAction('DELETE')}><TrashIcon /> 삭제</button>
        )}
      </div>
    </div>
  )

  const renderLeave = () => (
    <div className="room-menu-section room-leave-section">
      <div className="room-leave-symbol">↗</div>
      <strong>{room.name}에서 나갈까요?</strong>
      <p>나간 뒤에는 새 초대가 있어야 다시 참여할 수 있습니다.</p>
      <div className="room-confirm-actions">
        <button type="button" className="secondary-action" onClick={() => setView('ROOT')}>취소</button>
        <button type="button" className="danger-action" disabled={busy} onClick={() => runAction(onLeaveRoom)}>나가기</button>
      </div>
    </div>
  )

  const titles = {
    ROOT: room.name,
    INFO: '채팅방 정보',
    INVITE: '초대 링크 관리',
    NOTIFICATIONS: '알림 설정',
    SETTINGS: '채팅방 설정',
    LEAVE: '채팅방 나가기',
  }

  return (
    <AppModal
      open={open}
      title={titles[view]}
      onClose={onClose}
      size="small"
      className="room-management-modal"
    >
      {view !== 'ROOT' && (
        <button type="button" className="room-menu-back" onClick={() => setView('ROOT')}>← 메뉴</button>
      )}
      {error && <div className="room-menu-error" role="alert">{error}</div>}
      {view === 'ROOT' && renderRoot()}
      {view === 'INFO' && renderInfo()}
      {view === 'INVITE' && renderInvite()}
      {view === 'NOTIFICATIONS' && renderNotifications()}
      {view === 'SETTINGS' && renderSettings()}
      {view === 'LEAVE' && renderLeave()}
    </AppModal>
  )
}

export default RoomMenuModal
