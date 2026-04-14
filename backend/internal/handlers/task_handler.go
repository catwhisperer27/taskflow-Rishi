package handlers

import (
	"fmt"
	"net/http"
	"strings"

	"taskflow/internal/models"

	"github.com/go-chi/chi/v5"
)

// nilIfEmpty returns nil if the pointer is non-nil but points to an empty/whitespace string.
func nilIfEmpty(s *string) *string {
	if s != nil && strings.TrimSpace(*s) == "" {
		return nil
	}
	return s
}

func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	status := r.URL.Query().Get("status")
	assignee := r.URL.Query().Get("assignee")

	query := `SELECT id, title, description, status, priority, project_id,
	                 assignee_id, due_date, created_at, updated_at
	          FROM tasks WHERE project_id = $1`
	args := []any{projectID}

	if status != "" {
		args = append(args, status)
		query += ` AND status = $` + itoa(len(args)) + `::task_status`
	}
	if assignee != "" {
		args = append(args, assignee)
		query += ` AND assignee_id = $` + itoa(len(args))
	}
	query += ` ORDER BY created_at DESC`

	rows, err := h.DB.Pool.Query(r.Context(), query, args...)
	if err != nil {
		writeInternalError(w, "ListTasks", err)
		return
	}
	defer rows.Close()

	tasks := []models.Task{}
	for rows.Next() {
		var t models.Task
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
			&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			continue
		}
		tasks = append(tasks, t)
	}
	writeJSON(w, http.StatusOK, map[string]any{"tasks": tasks})
}

func (h *Handler) MyTasks(w http.ResponseWriter, r *http.Request) {
	userID := currentUser(r)

	rows, err := h.DB.Pool.Query(r.Context(),
		`SELECT t.id, t.title, t.description, t.status, t.priority, t.project_id,
		        t.assignee_id, t.due_date, t.created_at, t.updated_at,
		        p.name AS project_name
		 FROM tasks t
		 JOIN projects p ON t.project_id = p.id
		 WHERE t.assignee_id = $1
		 ORDER BY t.updated_at DESC`,
		userID,
	)
	if err != nil {
		writeInternalError(w, "MyTasks", err)
		return
	}
	defer rows.Close()

	tasks := []models.TaskWithProject{}
	for rows.Next() {
		var t models.TaskWithProject
		if err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
			&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt,
			&t.ProjectName); err != nil {
			continue
		}
		tasks = append(tasks, t)
	}
	writeJSON(w, http.StatusOK, map[string]any{"tasks": tasks})
}

func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	var exists bool
	h.DB.Pool.QueryRow(r.Context(),
		`SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1)`, projectID,
	).Scan(&exists)
	if !exists {
		writeError(w, http.StatusNotFound, "project not found")
		return
	}

	var req struct {
		Title       string  `json:"title"`
		Description *string `json:"description"`
		Priority    string  `json:"priority"`
		AssigneeID  *string `json:"assignee_id"`
		DueDate     *string `json:"due_date"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Title) == "" {
		writeValidationError(w, map[string]string{"title": "is required"})
		return
	}
	if req.Priority == "" {
		req.Priority = "medium"
	}

	// Nil out empty strings — prevents "" being cast to UUID/DATE
	req.AssigneeID = nilIfEmpty(req.AssigneeID)
	req.DueDate = nilIfEmpty(req.DueDate)

	var t models.Task
	err := h.DB.Pool.QueryRow(r.Context(),
		`INSERT INTO tasks (title, description, status, priority, project_id, assignee_id, due_date)
		 VALUES ($1, $2, 'todo', $3::task_priority, $4, $5, $6::date)
		 RETURNING id, title, description, status, priority, project_id,
		           assignee_id, due_date, created_at, updated_at`,
		req.Title, req.Description, req.Priority, projectID, req.AssigneeID, req.DueDate,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		writeInternalError(w, "CreateTask", err)
		return
	}

	if t.AssigneeID != nil {
		var projectName string
		h.DB.Pool.QueryRow(r.Context(),
			`SELECT name FROM projects WHERE id = $1`, t.ProjectID,
		).Scan(&projectName)
		Broker.Notify(*t.AssigneeID, Notification{
			Type:    "task_assigned",
			Message: fmt.Sprintf("You were assigned: %s", t.Title),
			TaskID:  t.ID,
			Task:    t.Title,
			Project: projectName,
			From:    currentUser(r),
		})
	}

	writeJSON(w, http.StatusCreated, t)
}

func (h *Handler) UpdateTask(w http.ResponseWriter, r *http.Request) {
	taskID := chi.URLParam(r, "id")

	var projectID string
	if err := h.DB.Pool.QueryRow(r.Context(),
		`SELECT project_id FROM tasks WHERE id = $1`, taskID,
	).Scan(&projectID); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	var req struct {
		Title       *string `json:"title"`
		Description *string `json:"description"`
		Status      *string `json:"status"`
		Priority    *string `json:"priority"`
		AssigneeID  *string `json:"assignee_id"`
		DueDate     *string `json:"due_date"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	req.AssigneeID = nilIfEmpty(req.AssigneeID)
	req.DueDate = nilIfEmpty(req.DueDate)

	var t models.Task
	err := h.DB.Pool.QueryRow(r.Context(),
		`UPDATE tasks SET
		   title       = COALESCE($1, title),
		   description = COALESCE($2, description),
		   status      = CASE WHEN $3::text IS NOT NULL THEN $3::task_status ELSE status END,
		   priority    = CASE WHEN $4::text IS NOT NULL THEN $4::task_priority ELSE priority END,
		   assignee_id = CASE WHEN $5::text IS NOT NULL THEN $5::uuid ELSE assignee_id END,
		   due_date    = CASE WHEN $6::text IS NOT NULL THEN $6::date ELSE due_date END,
		   updated_at  = NOW()
		 WHERE id = $7
		 RETURNING id, title, description, status, priority, project_id,
		           assignee_id, due_date, created_at, updated_at`,
		req.Title, req.Description, req.Status, req.Priority,
		req.AssigneeID, req.DueDate, taskID,
	).Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
		&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		writeInternalError(w, "UpdateTask", err)
		return
	}

	if req.AssigneeID != nil && t.AssigneeID != nil {
		var projectName string
		h.DB.Pool.QueryRow(r.Context(),
			`SELECT name FROM projects WHERE id = $1`, t.ProjectID,
		).Scan(&projectName)
		Broker.Notify(*t.AssigneeID, Notification{
			Type:    "task_assigned",
			Message: fmt.Sprintf("You were assigned: %s", t.Title),
			TaskID:  t.ID,
			Task:    t.Title,
			Project: projectName,
			From:    currentUser(r),
		})
	}

	writeJSON(w, http.StatusOK, t)
}

func (h *Handler) DeleteTask(w http.ResponseWriter, r *http.Request) {
	userID := currentUser(r)
	taskID := chi.URLParam(r, "id")

	var projectOwnerID string
	err := h.DB.Pool.QueryRow(r.Context(),
		`SELECT p.owner_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = $1`,
		taskID,
	).Scan(&projectOwnerID)
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if projectOwnerID != userID {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	h.DB.Pool.Exec(r.Context(), `DELETE FROM tasks WHERE id = $1`, taskID)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) BulkUpdateTasks(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TaskIDs []string `json:"task_ids"`
		Status  string   `json:"status"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if len(req.TaskIDs) == 0 {
		writeValidationError(w, map[string]string{"task_ids": "must not be empty"})
		return
	}
	validStatuses := map[string]bool{"todo": true, "in_progress": true, "done": true}
	if !validStatuses[req.Status] {
		writeValidationError(w, map[string]string{"status": "must be todo, in_progress, or done"})
		return
	}

	placeholders := make([]string, len(req.TaskIDs))
	args := []any{req.Status}
	for i, id := range req.TaskIDs {
		placeholders[i] = "$" + itoa(i+2)
		args = append(args, id)
	}

	query := fmt.Sprintf(
		`UPDATE tasks SET status = $1::task_status, updated_at = NOW() WHERE id IN (%s)`,
		strings.Join(placeholders, ","),
	)

	tag, err := h.DB.Pool.Exec(r.Context(), query, args...)
	if err != nil {
		writeInternalError(w, "BulkUpdateTasks", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"updated": tag.RowsAffected(),
		"status":  req.Status,
	})
}
