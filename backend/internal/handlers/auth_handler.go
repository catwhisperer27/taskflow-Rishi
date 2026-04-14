package handlers

import (
	"net/http"
	"strings"

	"taskflow/internal/auth"
	"taskflow/internal/models"
)

func (h *Handler) Register(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name     string `json:"name"`
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	fields := map[string]string{}
	if strings.TrimSpace(req.Name) == "" {
		fields["name"] = "is required"
	}
	if strings.TrimSpace(req.Username) == "" {
		fields["username"] = "is required"
	}
	if strings.TrimSpace(req.Email) == "" {
		fields["email"] = "is required"
	}
	if len(req.Password) < 8 {
		fields["password"] = "must be at least 8 characters"
	}
	if len(fields) > 0 {
		writeValidationError(w, fields)
		return
	}

	hashed, err := auth.HashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	var user models.User
	err = h.DB.Pool.QueryRow(r.Context(),
		`INSERT INTO users (name, username, email, password)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id, name, username, email, created_at`,
		req.Name, strings.ToLower(req.Username), strings.ToLower(req.Email), hashed,
	).Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.CreatedAt)
	if err != nil {
		if strings.Contains(err.Error(), "unique") {
			if strings.Contains(err.Error(), "username") {
				writeValidationError(w, map[string]string{"username": "already in use"})
			} else {
				writeValidationError(w, map[string]string{"email": "already in use"})
			}
			return
		}
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"token": token, "user": user})
}

func (h *Handler) Login(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Email == "" || req.Password == "" {
		writeValidationError(w, map[string]string{"credentials": "email and password are required"})
		return
	}

	var user models.User
	err := h.DB.Pool.QueryRow(r.Context(),
		`SELECT id, name, username, email, password, created_at FROM users WHERE email = $1`,
		strings.ToLower(req.Email),
	).Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.Password, &user.CreatedAt)
	if err != nil || !auth.CheckPassword(req.Password, user.Password) {
		writeError(w, http.StatusUnauthorized, "invalid credentials")
		return
	}

	token, err := auth.GenerateToken(user.ID, user.Email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"token": token, "user": user})
}

func (h *Handler) Me(w http.ResponseWriter, r *http.Request) {
	var user models.User
	err := h.DB.Pool.QueryRow(r.Context(),
		`SELECT id, name, username, email, created_at FROM users WHERE id = $1`,
		currentUser(r),
	).Scan(&user.ID, &user.Name, &user.Username, &user.Email, &user.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	writeJSON(w, http.StatusOK, user)
}

func (h *Handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.DB.Pool.Query(r.Context(),
		`SELECT id, name, username, email FROM users ORDER BY name`,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()

	users := []models.UserSummary{}
	for rows.Next() {
		var u models.UserSummary
		rows.Scan(&u.ID, &u.Name, &u.Username, &u.Email)
		users = append(users, u)
	}
	writeJSON(w, http.StatusOK, map[string]any{"users": users})
}

// ListColleagues returns all users who share a project with the current user
func (h *Handler) ListColleagues(w http.ResponseWriter, r *http.Request) {
	userID := currentUser(r)

	rows, err := h.DB.Pool.Query(r.Context(),
		`SELECT DISTINCT u.id, u.name, u.username, u.email
		 FROM users u
		 JOIN project_members pm ON pm.user_id = u.id
		 WHERE pm.project_id IN (
		   SELECT project_id FROM project_members WHERE user_id = $1
		 )
		 AND u.id != $1
		 ORDER BY u.name`,
		userID,
	)
	if err != nil {
		writeInternalError(w, "ListColleagues", err)
		return
	}
	defer rows.Close()

	users := []models.UserSummary{}
	for rows.Next() {
		var u models.UserSummary
		rows.Scan(&u.ID, &u.Name, &u.Username, &u.Email)
		users = append(users, u)
	}
	writeJSON(w, http.StatusOK, map[string]any{"colleagues": users})
}
