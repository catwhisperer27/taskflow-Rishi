package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"
)

// NotificationBroker manages SSE connections and broadcasts events to users.
type NotificationBroker struct {
	mu      sync.RWMutex
	clients map[string][]chan Notification // userID → channels
}

type Notification struct {
	Type    string `json:"type"`
	Message string `json:"message"`
	TaskID  string `json:"task_id,omitempty"`
	Task    string `json:"task_title,omitempty"`
	Project string `json:"project_name,omitempty"`
	From    string `json:"from,omitempty"`
}

var Broker = &NotificationBroker{
	clients: make(map[string][]chan Notification),
}

func (b *NotificationBroker) Subscribe(userID string) chan Notification {
	ch := make(chan Notification, 8)
	b.mu.Lock()
	b.clients[userID] = append(b.clients[userID], ch)
	b.mu.Unlock()
	return ch
}

func (b *NotificationBroker) Unsubscribe(userID string, ch chan Notification) {
	b.mu.Lock()
	defer b.mu.Unlock()
	channels := b.clients[userID]
	for i, c := range channels {
		if c == ch {
			b.clients[userID] = append(channels[:i], channels[i+1:]...)
			close(ch)
			break
		}
	}
	if len(b.clients[userID]) == 0 {
		delete(b.clients, userID)
	}
}

func (b *NotificationBroker) Notify(userID string, n Notification) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	for _, ch := range b.clients[userID] {
		select {
		case ch <- n:
		default: // don't block if client is slow
		}
	}
}

// SSEHandler streams notifications to the connected user via Server-Sent Events.
func (h *Handler) SSEHandler(w http.ResponseWriter, r *http.Request) {
	userID := currentUser(r)

	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no") // disable nginx buffering

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	ch := Broker.Subscribe(userID)
	defer Broker.Unsubscribe(userID, ch)

	// Send a connected event immediately
	fmt.Fprintf(w, "event: connected\ndata: {\"status\":\"ok\"}\n\n")
	flusher.Flush()

	// Heartbeat ticker to keep connection alive through proxies
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case n, ok := <-ch:
			if !ok {
				return
			}
			data, _ := json.Marshal(n)
			fmt.Fprintf(w, "event: notification\ndata: %s\n\n", data)
			flusher.Flush()

		case <-ticker.C:
			fmt.Fprintf(w, ": heartbeat\n\n")
			flusher.Flush()

		case <-r.Context().Done():
			return
		}
	}
}
