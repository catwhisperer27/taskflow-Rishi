package handlers

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"os"

	"taskflow/internal/db"
	"taskflow/internal/middleware"
)

type Handler struct {
	DB *db.DB
}

func New(database *db.DB) *Handler {
	return &Handler{DB: database}
}

func (h *Handler) logError(context string, err error) {
	slog.Error(context, "error", err.Error())
}

// writeInternalError logs the real error and returns it in the response body
// when APP_ENV != "production", so developers can see exactly what failed.
func writeInternalError(w http.ResponseWriter, context string, err error) {
	slog.Error(context, "error", err.Error())
	msg := "internal error"
	if os.Getenv("APP_ENV") != "production" {
		msg = fmt.Sprintf("internal error: %s: %s", context, err.Error())
	}
	writeError(w, http.StatusInternalServerError, msg)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func writeValidationError(w http.ResponseWriter, fields map[string]string) {
	writeJSON(w, http.StatusBadRequest, map[string]any{
		"error":  "validation failed",
		"fields": fields,
	})
}

func decode(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func itoa(n int) string {
	return fmt.Sprintf("%d", n)
}

func currentUser(r *http.Request) string {
	return middleware.GetUserID(r.Context())
}
