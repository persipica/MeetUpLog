const encodeHeader = (value) => String(value)
  .replace(/\\/g, '\\\\')
  .replace(/\r/g, '\\r')
  .replace(/\n/g, '\\n')
  .replace(/:/g, '\\c')

const decodeHeader = (value) => String(value)
  .replace(/\\c/g, ':')
  .replace(/\\n/g, '\n')
  .replace(/\\r/g, '\r')
  .replace(/\\\\/g, '\\')

const makeFrame = (command, headers = {}, body = '') => {
  const normalizedBody = body == null ? '' : String(body)
  const entries = Object.entries({
    ...headers,
    ...(normalizedBody ? { 'content-length': new TextEncoder().encode(normalizedBody).length } : {}),
  })

  return `${command}\n${entries
    .map(([key, value]) => `${encodeHeader(key)}:${encodeHeader(value)}`)
    .join('\n')}\n\n${normalizedBody}\0`
}

const parseFrame = (raw) => {
  const clean = raw.replace(/^\n+/, '')
  const divider = clean.indexOf('\n\n')
  if (divider < 0) return null

  const head = clean.slice(0, divider).split('\n')
  const command = head.shift()
  const headers = {}

  head.forEach((line) => {
    const separator = line.indexOf(':')
    if (separator < 0) return
    headers[decodeHeader(line.slice(0, separator))] = decodeHeader(line.slice(separator + 1))
  })

  return {
    command,
    headers,
    body: clean.slice(divider + 2),
  }
}

export class StompClient {
  constructor({ url, onConnect, onDisconnect, onError, onMessage }) {
    this.url = url
    this.onConnect = onConnect
    this.onDisconnect = onDisconnect
    this.onError = onError
    this.onMessage = onMessage
    this.socket = null
    this.connected = false
    this.buffer = ''
    this.subscriptions = new Map()
    this.nextSubscriptionId = 1
  }

  connect() {
    if (this.socket) return

    const socket = new WebSocket(this.url, ['v12.stomp', 'v11.stomp', 'v10.stomp'])
    this.socket = socket

    socket.addEventListener('open', () => {
      socket.send(makeFrame('CONNECT', {
        'accept-version': '1.2',
        host: window.location.host,
        'heart-beat': '0,0',
      }))
    })

    socket.addEventListener('message', (event) => this.handleData(String(event.data ?? '')))
    socket.addEventListener('error', () => this.onError?.(new Error('WebSocket 연결 오류가 발생했습니다.')))
    socket.addEventListener('close', (event) => {
      this.connected = false
      this.socket = null
      this.onDisconnect?.(event)
    })
  }

  handleData(data) {
    this.buffer += data

    while (this.buffer.includes('\0')) {
      const end = this.buffer.indexOf('\0')
      const rawFrame = this.buffer.slice(0, end)
      this.buffer = this.buffer.slice(end + 1)
      if (!rawFrame.trim()) continue

      const frame = parseFrame(rawFrame)
      if (!frame) continue

      if (frame.command === 'CONNECTED') {
        this.connected = true
        this.onConnect?.(frame)
      } else if (frame.command === 'MESSAGE') {
        let payload = frame.body
        try {
          payload = JSON.parse(frame.body)
        } catch {
          // Text payloads are valid STOMP messages too.
        }
        this.onMessage?.(frame.headers.destination, payload, frame)
      } else if (frame.command === 'ERROR') {
        this.onError?.(new Error(frame.headers.message ?? frame.body ?? 'STOMP 오류'))
      }
    }
  }

  subscribe(destination) {
    if (!this.connected || this.subscriptions.has(destination)) return null
    const id = `sub-${this.nextSubscriptionId++}`
    this.subscriptions.set(destination, id)
    this.socket.send(makeFrame('SUBSCRIBE', { id, destination, ack: 'auto' }))
    return id
  }

  unsubscribe(destination) {
    const id = this.subscriptions.get(destination)
    if (!id) return false

    if (this.connected && this.socket) {
      this.socket.send(makeFrame('UNSUBSCRIBE', { id }))
    }
    this.subscriptions.delete(destination)
    return true
  }

  send(destination, payload) {
    if (!this.connected || !this.socket) return false
    this.socket.send(makeFrame('SEND', {
      destination,
      'content-type': 'application/json;charset=UTF-8',
    }, JSON.stringify(payload)))
    return true
  }

  disconnect() {
    if (!this.socket) return
    if (this.connected) this.socket.send(makeFrame('DISCONNECT'))
    this.connected = false
    this.subscriptions.clear()
    this.socket.close(1000, 'client disconnect')
    this.socket = null
  }
}

export const buildWebSocketUrl = (ticket) => {
  const configured = import.meta.env.VITE_CHAT_WS_URL?.trim()
  const base = configured || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`
  const url = new URL(base, window.location.href)
  url.searchParams.set('ticket', ticket)
  return url.toString()
}
