import {
  PencilIcon,
  ReplyIcon,
  TrashIcon,
} from '../common/Icons'

const QUICK_REACTIONS = [
  '✅',
  '❤️',
  '👍',
  '😂',
  '👀',
]

const EMOJI_GRAPHEME_PATTERN =
  /^(?:[\p{Extended_Pictographic}\p{Regional_Indicator}\u0023\u002A\u0030-\u0039\uFE0F\u200D\u20E3\u{1F3FB}-\u{1F3FF}])+$/u

const getEmojiOnlyInfo = (
  content,
) => {
  const normalized =
    content?.trim()

  if (!normalized) {
    return null
  }

  let graphemes = []

  if (
    typeof Intl !==
      'undefined' &&
    Intl.Segmenter
  ) {
    const segmenter =
      new Intl.Segmenter(
        undefined,
        {
          granularity:
            'grapheme',
        },
      )

    graphemes =
      Array.from(
        segmenter.segment(
          normalized,
        ),
        (part) =>
          part.segment,
      ).filter(
        (part) =>
          part.trim().length >
          0,
      )
  } else {
    graphemes =
      Array.from(
        normalized,
      ).filter(
        (part) =>
          part.trim().length >
          0,
      )
  }

  if (
    graphemes.length ===
      0 ||
    graphemes.length >
      5 ||
    !graphemes.every(
      (part) =>
        EMOJI_GRAPHEME_PATTERN.test(
          part,
        ),
    )
  ) {
    return null
  }

  return {
    count:
      graphemes.length,
  }
}

const truncate = (
  value,
  length = 52,
) => {
  if (!value) {
    return ''
  }

  if (
    value.length <=
    length
  ) {
    return value
  }

  return `${value.slice(
    0,
    length,
  )}…`
}

const MessageMeta = ({
  message,
}) => {
  return (
    <div className="message-meta">
      {Number(
        message.unreadCount,
      ) > 0 && (
        <span
          className="message-unread-count"
          title={`${message.unreadCount}명이 아직 읽지 않음`}
        >
          {
            message.unreadCount
          }
        </span>
      )}

      {message.edited &&
        !message.deleted && (
          <span className="message-edited-label">
            (수정됨)
          </span>
        )}

      <span className="message-time">
        {message.sentAt}
      </span>
    </div>
  )
}

const MessageReactions = ({
  message,
  currentUserId,
  onToggleReaction,
}) => {
  const reactions =
    message.reactions ?? {}

  const visible =
    Object.entries(
      reactions,
    ).filter(
      ([
        ,
        userIds,
      ]) =>
        Array.isArray(
          userIds,
        ) &&
        userIds.length > 0,
    )

  if (
    visible.length === 0
  ) {
    return null
  }

  return (
    <div className="message-reaction-chips">
      {visible.map(
        ([
          emoji,
          userIds,
        ]) => {
          const reacted =
            userIds.includes(
              currentUserId,
            )

          return (
            <button
              key={`${emoji}-${userIds.length}`}
              type="button"
              className={`message-reaction-chip reaction-chip-enter ${
                reacted
                  ? 'reacted'
                  : ''
              }`}
              title={`${emoji} ${userIds.length}명`}
              onClick={(
                event,
              ) => {
                event.stopPropagation()

                onToggleReaction?.(
                  message.id,
                  emoji,
                )
              }}
            >
              <span>
                {emoji}
              </span>

              <strong>
                {
                  userIds.length
                }
              </strong>
            </button>
          )
        },
      )}
    </div>
  )
}

const MessageBubble = ({
  message,
  mine,
  selected,
  currentUserId,
  replyMessage,
  onSelect,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
  onJumpToMessage,
}) => {
  if (
    message.type ===
    'SYSTEM'
  ) {
    const eventType =
      message.systemEvent?.toLowerCase() ?? 'info'

    return (
      <div
        className={`system-message system-event-notice system-event-${eventType}`}
        role="status"
        aria-live="polite"
      >
        <span className="system-event-dot" aria-hidden="true" />
        <span>{message.content}</span>
      </div>
    )
  }

  const canInteract =
    !message.deleted

  const handleSelect = () => {
    if (!canInteract) {
      return
    }

    onSelect?.()
  }

  const reactions =
    message.reactions ??
    {}

  /*
   * 답장 Preview가 없는 순수 Emoji 메시지만
   * 말풍선 없이 크게 표시한다.
   * 답장 메시지는 원문 구조가 필요하므로 일반 Bubble 유지.
   */
  const emojiOnlyInfo =
    !message.deleted &&
    message.type ===
      'TEXT' &&
    !message.replyToId
      ? getEmojiOnlyInfo(
          message.content,
        )
      : null

  const emojiOnly =
    Boolean(
      emojiOnlyInfo,
    )

  const emojiCountClass =
    emojiOnly
      ? `emoji-count-${Math.min(
          emojiOnlyInfo.count,
          4,
        )}`
      : ''

  return (
    <div
      className={[
        'message-row',
        mine
          ? 'mine'
          : '',
        selected
          ? 'message-selected'
          : '',
        message.deleted
          ? 'message-deleted'
          : '',
        emojiOnly
          ? 'message-emoji-only'
          : '',
        emojiCountClass,
      ].join(' ')}
    >
      {!mine && (
        <div className="message-avatar">
          {
            message.senderName.slice(
              0,
              1,
            )
          }
        </div>
      )}

      <div className="message-area">
        {!mine && (
          <span className="sender-name">
            {
              message.senderName
            }
          </span>
        )}

        <div className="message-content-row">
          {mine && (
            <MessageMeta
              message={message}
            />
          )}

          <div className="message-bubble-shell">
            <div
              className={`message-bubble ${
                emojiOnly
                  ? 'emoji-only-bubble'
                  : ''
              }`}
              role={
                canInteract
                  ? 'button'
                  : undefined
              }
              tabIndex={
                canInteract
                  ? 0
                  : undefined
              }
              onClick={
                handleSelect
              }
              onKeyDown={(
                event,
              ) => {
                if (
                  !canInteract
                ) {
                  return
                }

                if (
                  event.key ===
                    'Enter' ||
                  event.key ===
                    ' '
                ) {
                  event.preventDefault()
                  handleSelect()
                }
              }}
            >
              {message.replyToId && (
                <button
                  type="button"
                  className="message-reply-preview"
                  onClick={(
                    event,
                  ) => {
                    event.stopPropagation()

                    onJumpToMessage?.(
                      message.replyToId,
                    )
                  }}
                >
                  <span className="reply-preview-accent" />

                  <span className="reply-preview-copy">
                    <strong>
                      {replyMessage
                        ? replyMessage.senderName
                        : '원문 메시지'}
                    </strong>

                    <span>
                      {replyMessage
                        ? replyMessage.deleted
                          ? '삭제된 메시지입니다.'
                          : truncate(
                              replyMessage.content,
                            )
                        : '원문을 찾을 수 없습니다.'}
                    </span>
                  </span>
                </button>
              )}

              <span
                className={[
                  message.deleted
                    ? 'deleted-message-copy'
                    : '',
                  emojiOnly
                    ? 'message-emoji-only-content'
                    : '',
                ].join(' ')}
              >
                {message.deleted
                  ? '삭제된 메시지입니다.'
                  : message.type ===
                        'IMAGE' &&
                      message.imageUrl
                    ? (
                        <span className="message-image-attachment">
                          <img
                            src={
                              message.imageUrl
                            }
                            alt={
                              message.content ||
                              '전송한 이미지'
                            }
                            loading="lazy"
                          />

                          <span>
                            {message.content ||
                              '사진'}
                          </span>
                        </span>
                      )
                    : message.content}
              </span>
            </div>

            {!message.deleted && (
              <MessageReactions
                message={{
                  ...message,
                  reactions,
                }}
                currentUserId={
                  currentUserId
                }
                onToggleReaction={
                  onToggleReaction
                }
              />
            )}

            {selected &&
              canInteract && (
                <div
                  className={[
                    'message-action-menu',
                    mine
                      ? 'mine'
                      : '',
                  ].join(' ')}
                  onClick={(
                    event,
                  ) =>
                    event.stopPropagation()
                  }
                >
                  <div className="message-quick-reactions">
                    {QUICK_REACTIONS.map(
                      (emoji) => {
                        const reacted =
                          (
                            reactions[
                              emoji
                            ] ??
                            []
                          ).includes(
                            currentUserId,
                          )

                        return (
                          <button
                            key={
                              emoji
                            }
                            type="button"
                            className={`message-quick-reaction ${
                              reacted
                                ? 'reacted'
                                : ''
                            }`}
                            title={`${emoji} 반응`}
                            onClick={() =>
                              onToggleReaction?.(
                                message.id,
                                emoji,
                              )
                            }
                          >
                            {
                              emoji
                            }
                          </button>
                        )
                      },
                    )}
                  </div>

                  <div className="message-action-divider" />

                  <div className="message-action-buttons">
                    <button
                      type="button"
                      className="message-action-button"
                      onClick={() =>
                        onReply?.(
                          message,
                        )
                      }
                    >
                      <ReplyIcon />
                      <span>
                        답장
                      </span>
                    </button>

                    {mine &&
                      message.type ===
                        'TEXT' && (
                      <>
                        <button
                          type="button"
                          className="message-action-button"
                          onClick={() =>
                            onEdit?.(
                              message,
                            )
                          }
                        >
                          <PencilIcon />
                          <span>
                            수정
                          </span>
                        </button>

                        <button
                          type="button"
                          className="message-action-button danger"
                          onClick={() =>
                            onDelete?.(
                              message,
                            )
                          }
                        >
                          <TrashIcon />
                          <span>
                            삭제
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
          </div>

          {!mine && (
            <MessageMeta
              message={message}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export default MessageBubble
