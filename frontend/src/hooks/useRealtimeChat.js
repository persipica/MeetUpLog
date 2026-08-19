import { useCallback, useEffect, useRef, useState } from 'react'
import { createWebSocketTicket } from '../api/chatApi'
import { buildWebSocketUrl, StompClient } from '../realtime/stompClient'

const RECONNECT_DELAYS = [1000, 2000, 4000, 8000]

const useRealtimeChat = ({
  accessToken,
  roomIds,
  onMessage,
  onTyping,
  onReaction,
  onRead,
  onPresence,
  onRoomEvent,
}) => {
  const [connectionState, setConnectionState] = useState('idle')
  const clientRef = useRef(null)
  const reconnectTimerRef = useRef(null)
  const reconnectAttemptRef = useRef(0)
  const handlersRef = useRef({ onMessage, onTyping, onReaction, onRead, onPresence, onRoomEvent })
  const roomIdList = [...new Set(roomIds.filter(Boolean))]
    .map(String)
    .sort((a, b) => Number(a) - Number(b))
  const roomKey = roomIdList.join(',')
  const roomIdsRef = useRef(roomIdList)
  roomIdsRef.current = roomIdList

  const syncRoomSubscriptions = useCallback((client) => {
    if (!client?.connected) return

    const desired = new Set(
      roomIdsRef.current.flatMap((roomId) => [
        `/sub/room/${roomId}`,
        `/sub/room/${roomId}/typing`,
        `/sub/room/${roomId}/reactions`,
        `/sub/room/${roomId}/read`,
        `/sub/room/${roomId}/events`,
      ]),
    )

    Array.from(client.subscriptions.keys())
      .filter((destination) => destination.startsWith('/sub/room/'))
      .forEach((destination) => {
        if (!desired.has(destination)) client.unsubscribe(destination)
      })

    desired.forEach((destination) => client.subscribe(destination))
  }, [])

  useEffect(() => {
    handlersRef.current = { onMessage, onTyping, onReaction, onRead, onPresence, onRoomEvent }
  }, [onMessage, onTyping, onReaction, onRead, onPresence, onRoomEvent])

  useEffect(() => {
    if (!accessToken) {
      setConnectionState('idle')
      return undefined
    }

    let disposed = false
    let ticketController = null
    const connect = async () => {
      if (disposed) return

      setConnectionState(reconnectAttemptRef.current ? 'reconnecting' : 'connecting')

      try {
        ticketController?.abort()
        ticketController = new AbortController()

        const ticketResponse = await createWebSocketTicket(
          accessToken,
          ticketController.signal,
        )

        if (disposed) return

        const ticket = ticketResponse?.ticket
        if (!ticket) throw new Error('WebSocket 접속 티켓을 받지 못했습니다.')

        const client = new StompClient({
          url: buildWebSocketUrl(ticket),
          onConnect: () => {
            reconnectAttemptRef.current = 0
            setConnectionState('connected')
            client.subscribe('/sub/presence')
            syncRoomSubscriptions(client)
          },
          onMessage: (destination, payload) => {
            if (destination === '/sub/presence') {
              handlersRef.current.onPresence?.(payload)
            } else if (destination.endsWith('/typing')) {
              handlersRef.current.onTyping?.(payload)
            } else if (destination.endsWith('/reactions')) {
              handlersRef.current.onReaction?.(payload)
            } else if (destination.endsWith('/read')) {
              handlersRef.current.onRead?.(payload)
            } else if (destination.endsWith('/events')) {
              handlersRef.current.onRoomEvent?.(payload)
            } else {
              handlersRef.current.onMessage?.(payload)
            }
          },
          onError: (error) => {
            console.error('실시간 채팅 오류:', error)
            setConnectionState('error')
          },
          onDisconnect: (event) => {
            if (disposed || event?.code === 1000) return
            const attempt = Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)
            reconnectAttemptRef.current += 1
            setConnectionState('reconnecting')
            reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_DELAYS[attempt])
          },
        })

        clientRef.current = client
        client.connect()
      } catch (error) {
        if (disposed || error?.name === 'AbortError') return
        console.error('실시간 채팅 연결 실패:', error)
        setConnectionState('error')
        const attempt = Math.min(reconnectAttemptRef.current, RECONNECT_DELAYS.length - 1)
        reconnectAttemptRef.current += 1
        reconnectTimerRef.current = window.setTimeout(connect, RECONNECT_DELAYS[attempt])
      }
    }

    // StrictMode가 개발 중 effect를 즉시 재마운트하더라도
    // 첫 마운트의 티켓 요청은 발생하지 않도록 한 프레임 뒤에 연결한다.
    reconnectTimerRef.current = window.setTimeout(connect, 120)

    return () => {
      disposed = true
      ticketController?.abort()
      window.clearTimeout(reconnectTimerRef.current)
      clientRef.current?.disconnect()
      clientRef.current = null
    }
  }, [accessToken, syncRoomSubscriptions])

  useEffect(() => {
    syncRoomSubscriptions(clientRef.current)
  }, [roomKey, syncRoomSubscriptions])

  const sendMessage = useCallback((payload) =>
    clientRef.current?.send('/pub/chat/message', payload) ?? false, [])

  const sendTyping = useCallback((payload) =>
    clientRef.current?.send('/pub/chat/typing', payload) ?? false, [])

  const sendReaction = useCallback((payload) =>
    clientRef.current?.send('/pub/chat/reaction', payload) ?? false, [])

  const sendRead = useCallback((payload) =>
    clientRef.current?.send('/pub/chat/read', payload) ?? false, [])

  const sendPresence = useCallback((payload) =>
    clientRef.current?.send('/pub/presence', payload) ?? false, [])

  return {
    connectionState,
    sendMessage,
    sendTyping,
    sendReaction,
    sendRead,
    sendPresence,
  }
}

export default useRealtimeChat
