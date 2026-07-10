type EventHandler = (event: AutomationEvent) => void

interface AutomationEvent {
  type: string
  sessionId?: string
  data: Record<string, unknown>
  timestamp: string
}

class WebSocketClient {
  private ws: WebSocket | null = null
  private handlers: Set<EventHandler> = new Set()
  private reconnectDelay = 1000
  private maxDelay = 30_000
  private shouldConnect = false
  // Bug #6 fix: store token so reconnect always uses the latest value
  private getToken: (() => string | null) | null = null

  connect(getToken: () => string | null) {
    this.shouldConnect = true
    this.getToken = getToken
    const token = getToken()
    if (token) this.open(token)
  }

  private open(token: string) {
    const url = `${import.meta.env.VITE_WS_URL ?? 'ws://localhost:8080/api/v1/ws'}?token=${token}`
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectDelay = 1000
      console.log('[ws] connected')
    }

    this.ws.onmessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as AutomationEvent
        this.handlers.forEach(h => h(event))
      } catch {
        // non-JSON message — ignore
      }
    }

    this.ws.onclose = () => {
      if (!this.shouldConnect) return
      console.log(`[ws] disconnected — reconnecting in ${this.reconnectDelay}ms`)
      setTimeout(() => {
        // Always fetch the latest token on reconnect (may have been refreshed)
        const freshToken = this.getToken?.()
        if (freshToken) this.open(freshToken)
      }, this.reconnectDelay)
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxDelay)
    }

    this.ws.onerror = () => {
      this.ws?.close()
    }
  }

  disconnect() {
    this.shouldConnect = false
    this.ws?.close()
    this.ws = null
  }

  on(handler: EventHandler) {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}

export const wsClient = new WebSocketClient()
export type { AutomationEvent }
