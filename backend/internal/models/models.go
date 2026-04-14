package models

import (
	"encoding/json"
	"time"
)

type User struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Password  string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
}

type UserSummary struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Username string `json:"username"`
	Email    string `json:"email"`
}

type Project struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Description *string   `json:"description"`
	OwnerID     string    `json:"owner_id"`
	CreatedAt   time.Time `json:"created_at"`
}

type ProjectWithTasks struct {
	Project
	Tasks   []Task          `json:"tasks"`
	Members []ProjectMember `json:"members"`
}

type ProjectMember struct {
	UserID   string `json:"user_id"`
	Name     string `json:"name"`
	Username string `json:"username"`
	Email    string `json:"email"`
	Role     string `json:"role"`
}

type TaskStatus   string
type TaskPriority string

const (
	StatusTodo       TaskStatus   = "todo"
	StatusInProgress TaskStatus   = "in_progress"
	StatusDone       TaskStatus   = "done"
	PriorityLow      TaskPriority = "low"
	PriorityMedium   TaskPriority = "medium"
	PriorityHigh     TaskPriority = "high"
)

// NullableDate wraps *time.Time so it serialises to JSON as "YYYY-MM-DD" or null.
type NullableDate struct {
	Time  time.Time
	Valid bool
}

func (d NullableDate) MarshalJSON() ([]byte, error) {
	if !d.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(d.Time.Format("2006-01-02"))
}

// Scan implements sql.Scanner so pgx can write a DATE into NullableDate.
func (d *NullableDate) Scan(src any) error {
	if src == nil {
		d.Valid = false
		return nil
	}
	switch v := src.(type) {
	case time.Time:
		d.Time = v
		d.Valid = true
	}
	return nil
}

type Task struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Description *string      `json:"description"`
	Status      TaskStatus   `json:"status"`
	Priority    TaskPriority `json:"priority"`
	ProjectID   string       `json:"project_id"`
	AssigneeID  *string      `json:"assignee_id"`
	DueDate     NullableDate `json:"due_date"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type TaskWithProject struct {
	Task
	ProjectName string `json:"project_name"`
}

type ProjectStats struct {
	ProjectID  string         `json:"project_id"`
	ByStatus   map[string]int `json:"by_status"`
	ByAssignee []AssigneeStat `json:"by_assignee"`
}

type AssigneeStat struct {
	AssigneeID   string `json:"assignee_id"`
	AssigneeName string `json:"assignee_name"`
	Count        int    `json:"count"`
}

type Comment struct {
	ID          string    `json:"id"`
	ProjectID   string    `json:"project_id"`
	UserID      string    `json:"user_id"`
	UserName    string    `json:"user_name"`
	UserInitials string   `json:"user_initials"`
	Body        string    `json:"body"`
	CreatedAt   time.Time `json:"created_at"`
}
