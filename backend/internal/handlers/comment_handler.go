package handlers

import (
	"net/http"
	"strings"

	"taskflow/internal/models"

	"github.com/go-chi/chi/v5"
)

func (h *Handler) ListComments(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	rows, err := h.DB.Pool.Query(r.Context(),
		`SELECT c.id, c.project_id, c.user_id, u.name, c.body, c.created_at
		 FROM comments c
		 JOIN users u ON u.id = c.user_id
		 WHERE c.project_id = $1
		 ORDER BY c.created_at ASC`,
		projectID,
	)
	if err != nil {
		writeInternalError(w, "ListComments", err)
		return
	}
	defer rows.Close()

	comments := []models.Comment{}
	for rows.Next() {
		var c models.Comment
		if err := rows.Scan(&c.ID, &c.ProjectID, &c.UserID, &c.UserName, &c.Body, &c.CreatedAt); err != nil {
			continue
		}
		// Build initials from name
		parts := strings.Fields(c.UserName)
		initials := ""
		for _, p := range parts {
			if len(p) > 0 {
				initials += strings.ToUpper(string(p[0]))
			}
		}
		if len(initials) > 2 {
			initials = initials[:2]
		}
		c.UserInitials = initials
		comments = append(comments, c)
	}
	writeJSON(w, http.StatusOK, map[string]any{"comments": comments})
}

func (h *Handler) CreateComment(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	userID := currentUser(r)

	var req struct {
		Body string `json:"body"`
	}
	if err := decode(r, &req); err != nil || strings.TrimSpace(req.Body) == "" {
		writeValidationError(w, map[string]string{"body": "is required"})
		return
	}

	var c models.Comment
	err := h.DB.Pool.QueryRow(r.Context(),
		`INSERT INTO comments (project_id, user_id, body)
		 VALUES ($1, $2, $3)
		 RETURNING id, project_id, user_id, body, created_at`,
		projectID, userID, strings.TrimSpace(req.Body),
	).Scan(&c.ID, &c.ProjectID, &c.UserID, &c.Body, &c.CreatedAt)
	if err != nil {
		writeInternalError(w, "CreateComment", err)
		return
	}

	// Fetch user name
	h.DB.Pool.QueryRow(r.Context(),
		`SELECT name FROM users WHERE id = $1`, userID,
	).Scan(&c.UserName)

	parts := strings.Fields(c.UserName)
	initials := ""
	for _, p := range parts {
		if len(p) > 0 {
			initials += strings.ToUpper(string(p[0]))
		}
	}
	if len(initials) > 2 {
		initials = initials[:2]
	}
	c.UserInitials = initials

	writeJSON(w, http.StatusCreated, c)
}

func (h *Handler) DeleteComment(w http.ResponseWriter, r *http.Request) {
	commentID := chi.URLParam(r, "commentId")
	userID := currentUser(r)

	var ownerID string
	if err := h.DB.Pool.QueryRow(r.Context(),
		`SELECT user_id FROM comments WHERE id = $1`, commentID,
	).Scan(&ownerID); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if ownerID != userID {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	h.DB.Pool.Exec(r.Context(), `DELETE FROM comments WHERE id = $1`, commentID)
	w.WriteHeader(http.StatusNoContent)
}
