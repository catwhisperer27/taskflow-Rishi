# ── Build stage ───────────────────────────────────────────────────────────────
# Using 1.24 to support the latest golang-migrate requirements
FROM golang:1.24-alpine AS builder

# Install system dependencies required for C-bindings and fetching modules
RUN apk add --no-cache git gcc musl-dev

WORKDIR /app

# 1. Copy all backend files
COPY . .

# 2. Fix the "malformed go.sum" error by regenerating it inside the container
RUN rm -f go.sum && go mod tidy

# 3. Download clean dependencies
RUN go mod download

# 4. Install the migrate tool
RUN go install -tags 'postgres' github.com/golang-migrate/migrate/v4/cmd/migrate@latest

# 5. Build the server binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o server ./cmd/server

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM alpine:3.19

# Install runtime dependencies
RUN apk add --no-cache ca-certificates tzdata postgresql-client

WORKDIR /app

# Copy the compiled binary from the builder stage
COPY --from=builder /app/server .

# Copy the migrate tool from the Go bin directory in the builder stage
COPY --from=builder /go/bin/migrate /usr/local/bin/migrate

# Copy migration scripts and SQL files
COPY migrations/ ./migrations/
COPY migrate.sh .
RUN chmod +x migrate.sh

EXPOSE 8080

# Execute the migration script which eventually starts the server
CMD ["./migrate.sh"]