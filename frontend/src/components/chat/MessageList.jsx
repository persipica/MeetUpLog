import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import MessageBubble from './MessageBubble'
import AiResultCard from './AiResultCard'

const MessageList = ({
  messages,
  currentUserId,
  onAiDetail,
  onReplyMessage,
  onEditMessage,
  onDeleteMessage,
  onToggleReaction,
}) => {
  const listRef =
    useRef(null)

  const messageRefs =
    useRef(
      new Map(),
    )

  const previousLastIdRef =
    useRef(null)

  const highlightTimerRef =
    useRef(null)

  const [
    selectedMessageId,
    setSelectedMessageId,
  ] = useState(null)

  const [
    highlightedMessageId,
    setHighlightedMessageId,
  ] = useState(null)

  const messageMap =
    useMemo(() => {
      return new Map(
        messages
          .filter(
            (message) =>
              message.type !==
              'AI_RESULT',
          )
          .map(
            (message) => [
              message.id,
              message,
            ],
          ),
      )
    }, [messages])

  /*
   * 새 메시지가 추가됐을 때만 Bottom으로 이동.
   * 수정/삭제처럼 기존 메시지가 바뀐 경우에는
   * 사용자가 보고 있던 위치를 유지한다.
   */
  useEffect(() => {
    const element =
      listRef.current

    if (!element) {
      return
    }

    const lastMessage =
      [...messages]
        .reverse()
        .find(Boolean)

    const lastId =
      lastMessage?.id ??
      null

    if (
      previousLastIdRef.current !==
      lastId
    ) {
      element.scrollTo({
        top:
          element.scrollHeight,
        behavior:
          previousLastIdRef.current ===
          null
            ? 'auto'
            : 'smooth',
      })

      previousLastIdRef.current =
        lastId
    }
  }, [messages])

  useEffect(() => {
    if (
      selectedMessageId &&
      !messages.some(
        (message) =>
          message.id ===
          selectedMessageId &&
          !message.deleted,
      )
    ) {
      setSelectedMessageId(
        null,
      )
    }
  }, [
    messages,
    selectedMessageId,
  ])

  useEffect(() => {
    if (!selectedMessageId) return undefined

    const closeFromOutside = (event) => {
      if (!listRef.current?.contains(event.target)) {
        setSelectedMessageId(null)
      }
    }

    document.addEventListener('pointerdown', closeFromOutside)
    return () => document.removeEventListener('pointerdown', closeFromOutside)
  }, [selectedMessageId])

  useEffect(() => {
    return () => {
      if (
        highlightTimerRef.current
      ) {
        window.clearTimeout(
          highlightTimerRef.current,
        )
      }
    }
  }, [])

  const jumpToMessage = (
    messageId,
  ) => {
    const list =
      listRef.current

    const element =
      messageRefs.current.get(
        messageId,
      )

    if (
      !list ||
      !element
    ) {
      return
    }

    const top =
      element.offsetTop -
      list.clientHeight /
        2 +
      element.offsetHeight /
        2

    list.scrollTo({
      top:
        Math.max(
          0,
          top,
        ),
      behavior:
        'smooth',
    })

    setHighlightedMessageId(
      messageId,
    )

    if (
      highlightTimerRef.current
    ) {
      window.clearTimeout(
        highlightTimerRef.current,
      )
    }

    highlightTimerRef.current =
      window.setTimeout(
        () =>
          setHighlightedMessageId(
            null,
          ),
        1500,
      )
  }

  return (
    <main
      ref={listRef}
      className="message-list"
      onClick={(event) => {
        if (
          !event.target.closest?.('.message-action-menu') &&
          !event.target.closest?.('.message-bubble')
        ) {
          setSelectedMessageId(
            null,
          )
        }
      }}
    >
      <div className="chat-date-divider">
        <span>오늘</span>
      </div>

      {messages.length ===
        0 && (
        <div className="room-start-message">
          <div className="room-start-icon">
            ✦
          </div>

          <strong>
            대화를 시작해보세요
          </strong>

          <p>
            모임에 대한 이야기를 나누고
            <br />
            함께 결정을 만들어가세요.
          </p>
        </div>
      )}

      {messages.map(
        (message) => {
          if (
            message.type ===
            'AI_RESULT'
          ) {
            return (
              <AiResultCard
                key={
                  message.id
                }
                movies={
                  message.movies
                }
                onDetail={
                  onAiDetail
                }
              />
            )
          }

          const selected =
            selectedMessageId ===
            message.id

          return (
            <div
              key={
                message.id
              }
              ref={(element) => {
                if (element) {
                  messageRefs.current.set(
                    message.id,
                    element,
                  )
                } else {
                  messageRefs.current.delete(
                    message.id,
                  )
                }
              }}
              className={[
                'message-anchor',
                highlightedMessageId ===
                message.id
                  ? 'message-jump-highlight'
                  : '',
              ].join(' ')}
            >
              <MessageBubble
                message={
                  message
                }
                mine={
                  message.senderId ===
                  currentUserId
                }
                selected={
                  selected
                }
                currentUserId={
                  currentUserId
                }
                replyMessage={
                  message.replyToId
                    ? messageMap.get(
                        message.replyToId,
                      )
                    : null
                }
                onSelect={() =>
                  setSelectedMessageId(
                    (previous) =>
                      previous ===
                      message.id
                        ? null
                        : message.id,
                  )
                }
                onReply={(
                  target,
                ) => {
                  setSelectedMessageId(
                    null,
                  )

                  onReplyMessage?.(
                    target,
                  )
                }}
                onEdit={(
                  target,
                ) => {
                  setSelectedMessageId(
                    null,
                  )

                  onEditMessage?.(
                    target,
                  )
                }}
                onDelete={(
                  target,
                ) => {
                  setSelectedMessageId(
                    null,
                  )

                  onDeleteMessage?.(
                    target,
                  )
                }}
                onToggleReaction={(
                  messageId,
                  emoji,
                ) => {
                  onToggleReaction?.(
                    messageId,
                    emoji,
                  )
                }}
                onJumpToMessage={
                  jumpToMessage
                }
              />
            </div>
          )
        },
      )}
    </main>
  )
}

export default MessageList
