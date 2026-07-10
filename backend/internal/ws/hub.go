package ws

import "sync"

// Hub maintains connected WebSocket clients, keyed by userID.
type Hub struct {
	mu        sync.RWMutex
	clients   map[string]map[*Client]struct{} // userID → set of clients
	broadcast chan Message
	register  chan *Client
	unregister chan *Client
}

type Message struct {
	UserID  string
	Payload []byte
}

func NewHub() *Hub {
	return &Hub{
		clients:    make(map[string]map[*Client]struct{}),
		broadcast:  make(chan Message, 256),
		register:   make(chan *Client, 16),
		unregister: make(chan *Client, 16),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			if _, ok := h.clients[c.userID]; !ok {
				h.clients[c.userID] = make(map[*Client]struct{})
			}
			h.clients[c.userID][c] = struct{}{}
			h.mu.Unlock()

		case c := <-h.unregister:
			h.mu.Lock()
			if set, ok := h.clients[c.userID]; ok {
				delete(set, c)
				if len(set) == 0 {
					delete(h.clients, c.userID)
				}
			}
			h.mu.Unlock()
			close(c.send)

		case msg := <-h.broadcast:
			h.mu.RLock()
			for c := range h.clients[msg.UserID] {
				select {
				case c.send <- msg.Payload:
				default:
					// slow client — drop message
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Send enqueues a message for all clients of the given user.
func (h *Hub) Send(userID string, payload []byte) {
	h.broadcast <- Message{UserID: userID, Payload: payload}
}
