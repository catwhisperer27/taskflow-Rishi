package handlers

import (
	"net/http"
	"strings"

	"taskflow/internal/models"

	"github.com/go-chi/chi/v5"
)

func (h *Handler) ListProjects(w http.ResponseWriter, r *http.Request) {
	userID := currentUser(r)

	rows, err := h.DB.Pool.Query(r.Context(),
		`SELECT DISTINCT p.id, p.name, p.description, p.owner_id, p.created_at
		 FROM projects p
		 WHERE p.owner_id = $1
		    OR EXISTS (
		         SELECT 1 FROM project_members pm
		         WHERE pm.project_id = p.id AND pm.user_id = $1
		       )
		    OR EXISTS (
		         SELECT 1 FROM tasks t
		         WHERE t.project_id = p.id AND t.assignee_id = $1
		       )
		 ORDER BY p.created_at DESC`,
		userID,
	)
	if err != nil {
		writeInternalError(w, "ListProjects", err)
		return
	}
	defer rows.Close()

	projects := []models.Project{}
	for rows.Next() {
		var p models.Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt); err != nil {
			continue
		}
		projects = append(projects, p)
	}
	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}

func (h *Handler) CreateProject(w http.ResponseWriter, r *http.Request) {
	userID := currentUser(r)

	var req struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if strings.TrimSpace(req.Name) == "" {
		writeValidationError(w, map[string]string{"name": "is required"})
		return
	}

	tx, err := h.DB.Pool.Begin(r.Context())
	if err != nil {
		writeInternalError(w, "CreateProject: begin tx", err)
		return
	}
	defer tx.Rollback(r.Context())

	var p models.Project
	err = tx.QueryRow(r.Context(),
		`INSERT INTO projects (name, description, owner_id)
		 VALUES ($1, $2, $3)
		 RETURNING id, name, description, owner_id, created_at`,
		req.Name, req.Description, userID,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		writeInternalError(w, "CreateProject: insert project", err)
		return
	}

	_, err = tx.Exec(r.Context(),
		`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'owner')`,
		p.ID, userID,
	)
	if err != nil {
		writeInternalError(w, "CreateProject: insert project_member", err)
		return
	}

	if err := tx.Commit(r.Context()); err != nil {
		writeInternalError(w, "CreateProject: commit", err)
		return
	}

	writeJSON(w, http.StatusCreated, p)
}

func (h *Handler) GetProject(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	userID := currentUser(r)

	var p models.Project
	err := h.DB.Pool.QueryRow(r.Context(),
		`SELECT id, name, description, owner_id, created_at
		 FROM projects WHERE id = $1`,
		projectID,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}

	if p.OwnerID != userID {
		var hasAccess bool
		h.DB.Pool.QueryRow(r.Context(),
			`SELECT EXISTS(
			   SELECT 1 FROM project_members WHERE project_id=$1 AND user_id=$2
			   UNION
			   SELECT 1 FROM tasks WHERE project_id=$1 AND assignee_id=$2
			 )`,
			projectID, userID,
		).Scan(&hasAccess)
		if !hasAccess {
			writeError(w, http.StatusForbidden, "forbidden")
			return
		}
	}

	taskRows, err := h.DB.Pool.Query(r.Context(),
		`SELECT id, title, description, status, priority, project_id,
		        assignee_id, due_date, created_at, updated_at
		 FROM tasks WHERE project_id = $1 ORDER BY created_at DESC`,
		projectID,
	)
	if err != nil {
		writeInternalError(w, "GetProject: list tasks", err)
		return
	}
	defer taskRows.Close()

	tasks := []models.Task{}
	for taskRows.Next() {
		var t models.Task
		if err := taskRows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority,
			&t.ProjectID, &t.AssigneeID, &t.DueDate, &t.CreatedAt, &t.UpdatedAt); err != nil {
			continue
		}
		tasks = append(tasks, t)
	}

	memberRows, err := h.DB.Pool.Query(r.Context(),
		`SELECT u.id, u.name, u.username, u.email, pm.role
		 FROM project_members pm
		 JOIN users u ON u.id = pm.user_id
		 WHERE pm.project_id = $1
		 ORDER BY pm.role DESC, u.name`,
		projectID,
	)
	if err != nil {
		writeInternalError(w, "GetProject: list members", err)
		return
	}
	defer memberRows.Close()

	members := []models.ProjectMember{}
	for memberRows.Next() {
		var m models.ProjectMember
		if err := memberRows.Scan(&m.UserID, &m.Name, &m.Username, &m.Email, &m.Role); err != nil {
			continue
		}
		members = append(members, m)
	}

	writeJSON(w, http.StatusOK, models.ProjectWithTasks{
		Project: p,
		Tasks:   tasks,
		Members: members,
	})
}

func (h *Handler) UpdateProject(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	userID := currentUser(r)

	var ownerID string
	if err := h.DB.Pool.QueryRow(r.Context(),
		`SELECT owner_id FROM projects WHERE id = $1`, projectID,
	).Scan(&ownerID); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if ownerID != userID {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	var req struct {
		Name        *string `json:"name"`
		Description *string `json:"description"`
	}
	if err := decode(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	var p models.Project
	err := h.DB.Pool.QueryRow(r.Context(),
		`UPDATE projects SET
		   name        = COALESCE($1, name),
		   description = COALESCE($2, description)
		 WHERE id = $3
		 RETURNING id, name, description, owner_id, created_at`,
		req.Name, req.Description, projectID,
	).Scan(&p.ID, &p.Name, &p.Description, &p.OwnerID, &p.CreatedAt)
	if err != nil {
		writeInternalError(w, "UpdateProject", err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (h *Handler) DeleteProject(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	userID := currentUser(r)

	var ownerID string
	if err := h.DB.Pool.QueryRow(r.Context(),
		`SELECT owner_id FROM projects WHERE id = $1`, projectID,
	).Scan(&ownerID); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if ownerID != userID {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	h.DB.Pool.Exec(r.Context(), `DELETE FROM projects WHERE id = $1`, projectID)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) GetProjectStats(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	rows, err := h.DB.Pool.Query(r.Context(),
		`SELECT status, COUNT(*) FROM tasks WHERE project_id = $1 GROUP BY status`,
		projectID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()

	byStatus := map[string]int{"todo": 0, "in_progress": 0, "done": 0}
	for rows.Next() {
		var s string
		var c int
		rows.Scan(&s, &c)
		byStatus[s] = c
	}

	aRows, err := h.DB.Pool.Query(r.Context(),
		`SELECT u.id, u.name, COUNT(t.id)
		 FROM tasks t JOIN users u ON t.assignee_id = u.id
		 WHERE t.project_id = $1
		 GROUP BY u.id, u.name ORDER BY COUNT(t.id) DESC`,
		projectID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer aRows.Close()

	byAssignee := []models.AssigneeStat{}
	for aRows.Next() {
		var a models.AssigneeStat
		aRows.Scan(&a.AssigneeID, &a.AssigneeName, &a.Count)
		byAssignee = append(byAssignee, a)
	}

	writeJSON(w, http.StatusOK, models.ProjectStats{
		ProjectID:  projectID,
		ByStatus:   byStatus,
		ByAssignee: byAssignee,
	})
}

func (h *Handler) AddMember(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	userID := currentUser(r)

	var ownerID string
	if err := h.DB.Pool.QueryRow(r.Context(),
		`SELECT owner_id FROM projects WHERE id = $1`, projectID,
	).Scan(&ownerID); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if ownerID != userID {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}

	var req struct {
		Identifier string `json:"identifier"`
	}
	if err := decode(r, &req); err != nil || strings.TrimSpace(req.Identifier) == "" {
		writeValidationError(w, map[string]string{"identifier": "email or username is required"})
		return
	}

	ident := strings.ToLower(strings.TrimSpace(req.Identifier))
	// Strip leading @ if username was entered as @username
	ident = strings.TrimPrefix(ident, "@")

	var target models.UserSummary
	err := h.DB.Pool.QueryRow(r.Context(),
		`SELECT id, name, username, email FROM users WHERE email = $1 OR username = $1`,
		ident,
	).Scan(&target.ID, &target.Name, &target.Username, &target.Email)
	if err != nil {
		writeError(w, http.StatusNotFound, "user not found")
		return
	}

	_, err = h.DB.Pool.Exec(r.Context(),
		`INSERT INTO project_members (project_id, user_id, role) VALUES ($1, $2, 'member')
		 ON CONFLICT DO NOTHING`,
		projectID, target.ID,
	)
	if err != nil {
		writeInternalError(w, "AddMember", err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"user": target, "role": "member",
	})
}

func (h *Handler) RemoveMember(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")
	targetUserID := chi.URLParam(r, "userId")
	userID := currentUser(r)

	var ownerID string
	if err := h.DB.Pool.QueryRow(r.Context(),
		`SELECT owner_id FROM projects WHERE id = $1`, projectID,
	).Scan(&ownerID); err != nil {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	if ownerID != userID {
		writeError(w, http.StatusForbidden, "forbidden")
		return
	}
	if targetUserID == ownerID {
		writeError(w, http.StatusBadRequest, "cannot remove the project owner")
		return
	}

	h.DB.Pool.Exec(r.Context(),
		`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
		projectID, targetUserID,
	)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) ListMembers(w http.ResponseWriter, r *http.Request) {
	projectID := chi.URLParam(r, "id")

	rows, err := h.DB.Pool.Query(r.Context(),
		`SELECT u.id, u.name, u.username, u.email, pm.role
		 FROM project_members pm
		 JOIN users u ON u.id = pm.user_id
		 WHERE pm.project_id = $1
		 ORDER BY pm.role DESC, u.name`,
		projectID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}
	defer rows.Close()

	members := []models.ProjectMember{}
	for rows.Next() {
		var m models.ProjectMember
		if err := rows.Scan(&m.UserID, &m.Name, &m.Username, &m.Email, &m.Role); err != nil {
			continue
		}
		members = append(members, m)
	}
	writeJSON(w, http.StatusOK, map[string]any{"members": members})
}
