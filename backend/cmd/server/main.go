package main

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"taskflow/internal/db"
	"taskflow/internal/handlers"
	"taskflow/internal/middleware"

	"github.com/go-chi/chi/v5"
	chimw "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/joho/godotenv"
)

func main() {
	godotenv.Load()

	slog.SetDefault(slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
		Level: slog.LevelInfo,
	})))

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	database, err := db.New(ctx)
	if err != nil {
		slog.Error("failed to connect to database", "error", err)
		os.Exit(1)
	}
	defer database.Close()
	slog.Info("connected to database")

	h := handlers.New(database)
	r := chi.NewRouter()

	r.Use(chimw.Recoverer)
	r.Use(middleware.RequestLogger)
	r.Use(middleware.SecurityHeaders)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"http://localhost:3000", "http://localhost:5173"},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: true,
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if err := database.Pool.Ping(ctx); err != nil {
			http.Error(w, `{"status":"unhealthy","db":"down"}`, http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"status":"healthy","db":"up"}`)
	})

	r.Route("/api/v1", func(r chi.Router) {
		r.With(middleware.RateLimit).Post("/auth/register", h.Register)
		r.With(middleware.RateLimit).Post("/auth/login", h.Login)

		r.Group(func(r chi.Router) {
			r.Use(middleware.Authenticate)

			r.Get("/auth/me", h.Me)
			r.Get("/users", h.ListUsers)

			// Projects
			r.Get("/projects", h.ListProjects)
			r.Post("/projects", h.CreateProject)
			r.Get("/projects/{id}", h.GetProject)
			r.Patch("/projects/{id}", h.UpdateProject)
			r.Delete("/projects/{id}", h.DeleteProject)
			r.Get("/projects/{id}/stats", h.GetProjectStats)

			// Project members
			r.Get("/projects/{id}/members", h.ListMembers)
			r.Post("/projects/{id}/members", h.AddMember)
			r.Delete("/projects/{id}/members/{userId}", h.RemoveMember)

			// Comments
			r.Get("/projects/{id}/comments", h.ListComments)
			r.Post("/projects/{id}/comments", h.CreateComment)
			r.Delete("/projects/{id}/comments/{commentId}", h.DeleteComment)

			// Tasks
			r.Get("/projects/{id}/tasks", h.ListTasks)
			r.Post("/projects/{id}/tasks", h.CreateTask)
			r.Patch("/tasks/{id}", h.UpdateTask)
			r.Delete("/tasks/{id}", h.DeleteTask)
			r.Post("/tasks/bulk", h.BulkUpdateTasks)
			r.Get("/tasks/my", h.MyTasks)

			// Colleagues (people you share projects with)
			r.Get("/colleagues", h.ListColleagues)

			// SSE notifications
			r.Get("/notifications/stream", h.SSEHandler)
		})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		slog.Info("server starting", "port", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server error", "error", err)
			os.Exit(1)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGTERM, syscall.SIGINT)
	<-quit

	slog.Info("shutting down gracefully...")
	shutCtx, shutCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutCancel()
	srv.Shutdown(shutCtx)
	slog.Info("server stopped")
}
