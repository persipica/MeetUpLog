import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'

import {
  CloseIcon,
  ImageIcon,
  PlusIcon,
  SearchIcon,
  SmileIcon,
  SparklesIcon,
} from '../common/Icons'

const EMOJIS = [
  { emoji: '😀', keywords: '웃음 미소 happy smile grin' },
  { emoji: '😃', keywords: '웃음 미소 happy smile' },
  { emoji: '😄', keywords: '웃음 미소 happy smile' },
  { emoji: '😁', keywords: '웃음 미소 grin happy' },
  { emoji: '😆', keywords: '웃음 재미 laugh funny' },
  { emoji: '😂', keywords: '웃음 눈물 laugh tears funny' },
  { emoji: '🤣', keywords: '폭소 웃음 rofl laugh funny' },
  { emoji: '🥹', keywords: '감동 눈물 울음 touched tears' },
  { emoji: '😊', keywords: '미소 행복 smile happy' },
  { emoji: '🙂', keywords: '미소 smile' },
  { emoji: '🙃', keywords: '거꾸로 장난 upside silly' },
  { emoji: '😉', keywords: '윙크 wink' },
  { emoji: '😍', keywords: '사랑 하트 love heart eyes' },
  { emoji: '🥰', keywords: '사랑 하트 love hearts' },
  { emoji: '😘', keywords: '키스 사랑 kiss love' },
  { emoji: '😎', keywords: '선글라스 멋 cool sunglasses' },
  { emoji: '🤩', keywords: '별 눈 star excited' },
  { emoji: '🥳', keywords: '축하 파티 party celebration' },
  { emoji: '😋', keywords: '맛있다 음식 yummy delicious' },
  { emoji: '😛', keywords: '메롱 장난 tongue' },
  { emoji: '🤪', keywords: '장난 crazy silly' },
  { emoji: '🤔', keywords: '생각 고민 think thinking' },
  { emoji: '🫡', keywords: '경례 확인 salute respect' },
  { emoji: '🤗', keywords: '포옹 hug' },
  { emoji: '🤭', keywords: '웃음 입 가림 giggle' },
  { emoji: '🫢', keywords: '놀람 입 surprise' },
  { emoji: '🫣', keywords: '몰래 보기 peek' },
  { emoji: '😐', keywords: '무표정 neutral' },
  { emoji: '😑', keywords: '무표정 귀찮음 expressionless' },
  { emoji: '😶', keywords: '침묵 silent' },
  { emoji: '🙄', keywords: '눈 굴림 roll eyes' },
  { emoji: '😏', keywords: '씨익 smirk' },
  { emoji: '😒', keywords: '별로 불만 unamused' },
  { emoji: '😔', keywords: '슬픔 sad' },
  { emoji: '🥺', keywords: '부탁 슬픔 pleading' },
  { emoji: '😢', keywords: '울음 눈물 sad cry' },
  { emoji: '😭', keywords: '울음 눈물 cry tears' },
  { emoji: '😤', keywords: '화남 씩씩 angry' },
  { emoji: '😡', keywords: '화남 angry mad' },
  { emoji: '🤬', keywords: '화남 욕 angry curse' },
  { emoji: '😱', keywords: '비명 놀람 scream shock' },
  { emoji: '😨', keywords: '무서움 scared' },
  { emoji: '😴', keywords: '잠 수면 sleep sleepy' },
  { emoji: '🤤', keywords: '침 맛있다 drool' },
  { emoji: '🤒', keywords: '아픔 열 sick fever' },
  { emoji: '🤧', keywords: '감기 재채기 sneeze sick' },
  { emoji: '🤢', keywords: '메스꺼움 sick nausea' },
  { emoji: '🤮', keywords: '토함 sick vomit' },
  { emoji: '😵', keywords: '어지러움 dizzy' },
  { emoji: '🤯', keywords: '충격 머리 폭발 mind blown' },

  { emoji: '👍', keywords: '좋아요 따봉 yes good like thumb' },
  { emoji: '👎', keywords: '싫어요 no dislike thumb' },
  { emoji: '👌', keywords: '오케이 확인 ok good' },
  { emoji: '✌️', keywords: '브이 승리 peace victory' },
  { emoji: '🤞', keywords: '행운 fingers crossed luck' },
  { emoji: '🤟', keywords: '사랑 손 love hand' },
  { emoji: '🤘', keywords: '락 rock hand' },
  { emoji: '👏', keywords: '박수 clap applause' },
  { emoji: '🙌', keywords: '만세 축하 raise hands' },
  { emoji: '🫶', keywords: '하트 손 사랑 heart hands love' },
  { emoji: '🙏', keywords: '부탁 감사 기도 please thanks pray' },
  { emoji: '🤝', keywords: '악수 합의 handshake agreement' },
  { emoji: '💪', keywords: '힘 근육 화이팅 strong muscle' },
  { emoji: '👊', keywords: '주먹 fist bump' },
  { emoji: '✊', keywords: '주먹 힘 fist' },
  { emoji: '👋', keywords: '안녕 손 wave hello bye' },
  { emoji: '🫰', keywords: '손가락 하트 finger heart' },
  { emoji: '👀', keywords: '눈 보기 eyes look' },
  { emoji: '👂', keywords: '귀 듣기 ear listen' },

  { emoji: '❤️', keywords: '하트 사랑 red heart love' },
  { emoji: '🩷', keywords: '핑크 하트 사랑 pink heart' },
  { emoji: '🧡', keywords: '주황 하트 사랑 orange heart' },
  { emoji: '💛', keywords: '노랑 하트 yellow heart' },
  { emoji: '💚', keywords: '초록 하트 green heart' },
  { emoji: '💙', keywords: '파랑 하트 blue heart' },
  { emoji: '💜', keywords: '보라 하트 purple heart' },
  { emoji: '🖤', keywords: '검정 하트 black heart' },
  { emoji: '🤍', keywords: '하양 하트 white heart' },
  { emoji: '💔', keywords: '깨진 하트 이별 broken heart' },
  { emoji: '💕', keywords: '하트 사랑 hearts love' },
  { emoji: '💖', keywords: '반짝 하트 sparkle heart' },
  { emoji: '💯', keywords: '백점 완벽 100 perfect' },
  { emoji: '💢', keywords: '화남 angry symbol' },
  { emoji: '💥', keywords: '폭발 boom explosion' },
  { emoji: '💫', keywords: '별 빙글 dizzy star' },
  { emoji: '✨', keywords: '반짝 별 sparkle shine' },
  { emoji: '🔥', keywords: '불 최고 fire hot' },
  { emoji: '⭐', keywords: '별 star favorite' },
  { emoji: '🌟', keywords: '별 반짝 star glow' },
  { emoji: '✅', keywords: '체크 확인 완료 check done yes' },
  { emoji: '❌', keywords: '엑스 아니오 취소 x no cancel' },
  { emoji: '⭕', keywords: '동그라미 맞음 circle correct' },
  { emoji: '❗', keywords: '느낌표 중요 exclamation important' },
  { emoji: '❓', keywords: '물음표 질문 question' },

  { emoji: '🎉', keywords: '축하 파티 confetti celebration' },
  { emoji: '🎊', keywords: '축하 파티 confetti celebration' },
  { emoji: '🎂', keywords: '생일 케이크 birthday cake' },
  { emoji: '🎁', keywords: '선물 gift present' },
  { emoji: '🏆', keywords: '우승 트로피 trophy winner' },
  { emoji: '🥇', keywords: '금메달 1등 gold medal' },
  { emoji: '🎯', keywords: '목표 다트 target' },
  { emoji: '🎮', keywords: '게임 game controller' },
  { emoji: '🎲', keywords: '주사위 보드게임 dice game' },
  { emoji: '🎬', keywords: '영화 movie cinema clapper' },
  { emoji: '🎵', keywords: '음악 music note' },
  { emoji: '🎸', keywords: '기타 음악 guitar music' },
  { emoji: '📸', keywords: '카메라 사진 camera photo' },
  { emoji: '💻', keywords: '컴퓨터 개발 laptop computer dev' },
  { emoji: '📱', keywords: '휴대폰 스마트폰 phone mobile' },
  { emoji: '💡', keywords: '아이디어 전구 idea light' },
  { emoji: '📌', keywords: '핀 고정 pin' },
  { emoji: '📅', keywords: '달력 일정 calendar schedule' },

  { emoji: '🍕', keywords: '피자 음식 pizza food' },
  { emoji: '🍔', keywords: '햄버거 음식 burger food' },
  { emoji: '🍟', keywords: '감자튀김 음식 fries food' },
  { emoji: '🌭', keywords: '핫도그 음식 hotdog food' },
  { emoji: '🍿', keywords: '팝콘 영화 popcorn movie food' },
  { emoji: '🍜', keywords: '라면 국수 음식 noodles ramen' },
  { emoji: '🍣', keywords: '초밥 스시 음식 sushi food' },
  { emoji: '🍗', keywords: '치킨 닭 음식 chicken food' },
  { emoji: '🥩', keywords: '고기 스테이크 meat steak' },
  { emoji: '🥗', keywords: '샐러드 음식 salad food' },
  { emoji: '🍰', keywords: '케이크 디저트 cake dessert' },
  { emoji: '🍩', keywords: '도넛 디저트 donut dessert' },
  { emoji: '🍪', keywords: '쿠키 디저트 cookie' },
  { emoji: '☕', keywords: '커피 카페 coffee cafe' },
  { emoji: '🍺', keywords: '맥주 beer drink' },
  { emoji: '🥤', keywords: '음료 drink soda' },

  { emoji: '☀️', keywords: '해 날씨 맑음 sun sunny weather' },
  { emoji: '🌙', keywords: '달 밤 moon night' },
  { emoji: '⭐', keywords: '별 밤 star night' },
  { emoji: '☁️', keywords: '구름 날씨 cloud weather' },
  { emoji: '🌧️', keywords: '비 날씨 rain weather' },
  { emoji: '❄️', keywords: '눈 겨울 snow winter' },
  { emoji: '🌈', keywords: '무지개 rainbow' },
  { emoji: '🌊', keywords: '바다 파도 sea ocean wave' },
  { emoji: '🏖️', keywords: '바다 여행 beach travel' },
  { emoji: '🏕️', keywords: '캠핑 여행 camping travel' },
  { emoji: '✈️', keywords: '비행기 여행 airplane travel' },
  { emoji: '🚗', keywords: '자동차 차 car' },
  { emoji: '🚆', keywords: '기차 여행 train travel' },
  { emoji: '🗺️', keywords: '지도 여행 map travel' },
]

const truncate = (
  value,
  length = 72,
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

const MessageComposer = ({
  onSend,
  onSendImage,
  onSaveEdit,
  onRecommend,
  onTypingChange,
  onCancelContext,
  replyTarget,
  editingMessage,
  aiSupported,
  aiAnalyzing,
}) => {
  const [
    message,
    setMessage,
  ] = useState('')

  const [
    menuOpen,
    setMenuOpen,
  ] = useState(false)

  const [
    emojiOpen,
    setEmojiOpen,
  ] = useState(false)

  const [
    emojiQuery,
    setEmojiQuery,
  ] = useState('')

  const [
    imageProcessing,
    setImageProcessing,
  ] = useState(false)

  const [
    imageError,
    setImageError,
  ] = useState('')

  const textareaRef =
    useRef(null)

  const emojiSearchRef =
    useRef(null)

  const imageInputRef =
    useRef(null)

  const previousEditingIdRef =
    useRef(null)

  const filteredEmojis =
    useMemo(() => {
      const query =
        emojiQuery
          .trim()
          .toLowerCase()

      if (!query) {
        return EMOJIS
      }

      return EMOJIS.filter(
        (item) =>
          item.emoji.includes(
            query,
          ) ||
          item.keywords
            .toLowerCase()
            .includes(
              query,
            ),
      )
    }, [
      emojiQuery,
    ])

  const isTyping =
    message.length > 0

  useEffect(() => {
    onTypingChange?.(
      isTyping,
    )
  }, [
    isTyping,
    onTypingChange,
  ])

  useEffect(
    () => () => {
      onTypingChange?.(
        false,
      )
    },
    [onTypingChange],
  )

  useEffect(() => {
    const previousId =
      previousEditingIdRef.current

    if (
      editingMessage
    ) {
      setMessage(
        editingMessage.content,
      )

      requestAnimationFrame(
        () => {
          textareaRef.current?.focus()
        },
      )
    } else if (
      previousId
    ) {
      setMessage('')
    }

    previousEditingIdRef.current =
      editingMessage?.id ??
      null
  }, [
    editingMessage,
  ])

  useEffect(() => {
    if (
      replyTarget &&
      !editingMessage
    ) {
      requestAnimationFrame(
        () => {
          textareaRef.current?.focus()
        },
      )
    }
  }, [
    replyTarget,
    editingMessage,
  ])

  useEffect(() => {
    if (
      emojiOpen
    ) {
      requestAnimationFrame(
        () => {
          emojiSearchRef.current?.focus()
        },
      )
    } else {
      setEmojiQuery('')
    }
  }, [
    emojiOpen,
  ])

  const clearContext = () => {
    if (
      editingMessage
    ) {
      setMessage('')
    }

    onCancelContext?.()
  }

  const insertEmoji = (
    emoji,
  ) => {
    const textarea =
      textareaRef.current

    if (!textarea) {
      setMessage(
        (previous) =>
          `${previous}${emoji}`,
      )

      return
    }

    const start =
      textarea.selectionStart ??
      message.length

    const end =
      textarea.selectionEnd ??
      start

    const next =
      `${message.slice(
        0,
        start,
      )}${emoji}${message.slice(
        end,
      )}`

    const nextCaret =
      start +
      emoji.length

    setMessage(next)

    requestAnimationFrame(
      () => {
        textarea.focus()

        textarea.setSelectionRange(
          nextCaret,
          nextCaret,
        )
      },
    )
  }

  const sendMessage = () => {
    const value =
      message.trim()

    if (!value) {
      return
    }

    setMessage('')
    setEmojiOpen(false)

    onTypingChange?.(
      false,
    )

    if (
      editingMessage
    ) {
      onSaveEdit?.(
        editingMessage.id,
        value,
      )
    } else {
      onSend(
        value,
        replyTarget?.id ??
          null,
      )
    }

    onCancelContext?.()
  }

  const handleImageSelect = (
    event,
  ) => {
    const file =
      event.target.files?.[0]

    event.target.value = ''

    if (!file) {
      return
    }

    const allowedTypes =
      new Set([
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
      ])

    if (
      !allowedTypes.has(
        file.type,
      )
    ) {
      setImageError(
        'JPG, PNG, GIF, WEBP 이미지만 보낼 수 있습니다.',
      )
      return
    }

    if (
      file.size >
      10 * 1024 * 1024
    ) {
      setImageError(
        '이미지는 10MB 이하만 보낼 수 있습니다.',
      )
      return
    }

    setImageError('')
    setImageProcessing(true)

    const reader =
      new FileReader()

    reader.onload = () => {
      const imageUrl =
        typeof reader.result ===
        'string'
          ? reader.result
          : ''

      setImageProcessing(false)

      if (!imageUrl) {
        setImageError(
          '이미지를 읽지 못했습니다. 다시 시도해주세요.',
        )
        return
      }

      onSendImage?.(
        {
          fileName:
            file.name,
          mimeType:
            file.type,
          size: file.size,
          imageUrl,
        },
        replyTarget?.id ??
          null,
      )

      onCancelContext?.()
    }

    reader.onerror = () => {
      setImageProcessing(false)
      setImageError(
        '이미지를 읽지 못했습니다. 다시 시도해주세요.',
      )
    }

    reader.readAsDataURL(file)
  }

  const handleKeyDown = (
    event,
  ) => {
    if (
      event.key ===
        'Escape' &&
      emojiOpen
    ) {
      setEmojiOpen(false)
      return
    }

    if (
      event.key ===
        'Escape' &&
      (replyTarget ||
        editingMessage)
    ) {
      event.preventDefault()
      clearContext()
      return
    }

    if (
      event.key === 'Enter' &&
      !event.shiftKey
    ) {
      event.preventDefault()
      sendMessage()
    }
  }

  const contextTarget =
    editingMessage ??
    replyTarget

  return (
    <>
      {(menuOpen ||
        emojiOpen) && (
        <button
          type="button"
          className="composer-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => {
            setMenuOpen(false)
            setEmojiOpen(false)
          }}
        />
      )}

      <div className="composer-wrapper">
        {menuOpen && (
          <div className="composer-menu liquid-floating-menu">
            <div className="mobile-sheet-handle" />

            <button
              type="button"
              className={`composer-action ${
                !aiSupported
                  ? 'disabled'
                  : ''
              }`}
              disabled={
                !aiSupported ||
                aiAnalyzing
              }
              onClick={() => {
                onRecommend?.()
                setMenuOpen(
                  false,
                )
              }}
            >
              <span className="composer-action-icon ai">
                <SparklesIcon />
              </span>

              <strong>
                {aiAnalyzing
                  ? '분석 중'
                  : 'AI 추천'}
              </strong>
            </button>

            <button
              type="button"
              className={`composer-action ${
                imageProcessing ||
                editingMessage
                  ? 'disabled'
                  : ''
              }`}
              disabled={
                imageProcessing ||
                Boolean(
                  editingMessage,
                )
              }
              onClick={() => {
                setMenuOpen(
                  false,
                )

                imageInputRef.current?.click()
              }}
            >
              <span className="composer-action-icon image">
                <ImageIcon />
              </span>

              <strong>
                {imageProcessing
                  ? '처리 중'
                  : '이미지'}
              </strong>
            </button>

            <button
              type="button"
              className="mobile-sheet-cancel"
              onClick={() =>
                setMenuOpen(
                  false,
                )
              }
            >
              취소
            </button>
          </div>
        )}

        {emojiOpen && (
          <div className="composer-emoji-picker">
            <div className="emoji-picker-header">
              <strong>
                이모티콘
              </strong>

              <button
                type="button"
                onClick={() =>
                  setEmojiOpen(
                    false,
                  )
                }
                aria-label="이모티콘 닫기"
              >
                <CloseIcon />
              </button>
            </div>

            <label className="emoji-picker-search">
              <span>
                <SearchIcon />
              </span>

              <input
                ref={
                  emojiSearchRef
                }
                value={
                  emojiQuery
                }
                type="search"
                placeholder="이모티콘 검색"
                onChange={(
                  event,
                ) =>
                  setEmojiQuery(
                    event.target.value,
                  )
                }
                onKeyDown={(
                  event,
                ) => {
                  if (
                    event.key ===
                    'Escape'
                  ) {
                    setEmojiOpen(
                      false,
                    )
                  }
                }}
              />

              {emojiQuery && (
                <button
                  type="button"
                  className="emoji-search-clear"
                  onClick={() =>
                    setEmojiQuery(
                      '',
                    )
                  }
                  aria-label="검색어 지우기"
                >
                  <CloseIcon />
                </button>
              )}
            </label>

            <div className="emoji-picker-scroll">
              {filteredEmojis.length >
              0 ? (
                <div className="emoji-picker-grid">
                  {filteredEmojis.map(
                    (
                      item,
                      index,
                    ) => (
                      <button
                        key={`${item.emoji}-${index}`}
                        type="button"
                        title={
                          item.keywords
                        }
                        onClick={() =>
                          insertEmoji(
                            item.emoji,
                          )
                        }
                        aria-label={`${item.emoji} 입력`}
                      >
                        {
                          item.emoji
                        }
                      </button>
                    ),
                  )}
                </div>
              ) : (
                <div className="emoji-picker-empty">
                  <span>
                    🔎
                  </span>

                  <strong>
                    검색 결과가 없습니다
                  </strong>

                  <p>
                    다른 단어로 검색해보세요.
                  </p>
                </div>
              )}
            </div>

            <div className="emoji-picker-footer">
              <span>
                {
                  filteredEmojis.length
                }개
              </span>

              <span>
                클릭하면 현재 커서 위치에 입력됩니다.
              </span>
            </div>
          </div>
        )}

        {contextTarget && (
          <div
            className={[
              'composer-context-bar',
              editingMessage
                ? 'editing'
                : 'replying',
            ].join(' ')}
          >
            <span className="composer-context-accent" />

            <div className="composer-context-copy">
              <strong>
                {editingMessage
                  ? '메시지 수정'
                  : `${replyTarget.senderName}님에게 답장`}
              </strong>

              <span>
                {truncate(
                  contextTarget.content,
                )}
              </span>
            </div>

            <button
              type="button"
              className="composer-context-close"
              aria-label={
                editingMessage
                  ? '수정 취소'
                  : '답장 취소'
              }
              onClick={
                clearContext
              }
            >
              <CloseIcon />
            </button>
          </div>
        )}

        <input
          ref={imageInputRef}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          tabIndex={-1}
          onChange={
            handleImageSelect
          }
        />

        {imageError && (
          <div
            className="composer-inline-error"
            role="alert"
          >
            <span>{imageError}</span>

            <button
              type="button"
              aria-label="오류 메시지 닫기"
              onClick={() =>
                setImageError('')
              }
            >
              <CloseIcon />
            </button>
          </div>
        )}

        <div className="message-composer">
          <button
            type="button"
            className={`composer-plus-button ${
              menuOpen
                ? 'opened'
                : ''
            }`}
            onClick={() => {
              setEmojiOpen(false)

              setMenuOpen(
                (previous) =>
                  !previous,
              )
            }}
            aria-label="채팅 도구"
          >
            <PlusIcon />
          </button>

          <textarea
            ref={textareaRef}
            rows={1}
            value={message}
            placeholder={
              editingMessage
                ? '메시지를 수정하세요'
                : replyTarget
                  ? '답장을 입력하세요'
                  : '메시지를 입력하세요'
            }
            onChange={(
              event,
            ) =>
              setMessage(
                event.target.value,
              )
            }
            onKeyDown={
              handleKeyDown
            }
          />

          <button
            type="button"
            className={`composer-emoji-button ${
              emojiOpen
                ? 'opened'
                : ''
            }`}
            onClick={() => {
              setMenuOpen(false)

              setEmojiOpen(
                (previous) =>
                  !previous,
              )
            }}
            aria-label="이모티콘"
          >
            <SmileIcon />
          </button>

          <button
            type="button"
            className="send-button"
            disabled={
              !message.trim()
            }
            onClick={
              sendMessage
            }
            aria-label={
              editingMessage
                ? '수정 완료'
                : '메시지 보내기'
            }
          >
            {editingMessage ? (
              <span className="send-edit-check">
                ✓
              </span>
            ) : (
              <svg
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  d="M4 12L20 4L15 20L11.5 13L4 12Z"
                  fill="currentColor"
                />
              </svg>
            )}
          </button>
        </div>
      </div>
    </>
  )
}

export default MessageComposer
