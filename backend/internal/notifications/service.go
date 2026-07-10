package notifications

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

type Notification struct {
	ID        string          `json:"id"`
	UserID    string          `json:"userId"`
	Type      string          `json:"type"`
	Title     string          `json:"title"`
	Message   string          `json:"message"`
	IsRead    bool            `json:"isRead"`
	Metadata  json.RawMessage `json:"metadata"`
	CreatedAt time.Time       `json:"createdAt"`
}

type Service struct {
	pool *pgxpool.Pool
}

func NewService(pool *pgxpool.Pool) *Service {
	return &Service{pool: pool}
}

func (s *Service) Create(ctx context.Context, userID, notifType, title, message string, metadata map[string]any) error {
	data, err := json.Marshal(metadata)
	if err != nil {
		data = []byte("{}")
	}
	_, err = s.pool.Exec(ctx, `
		INSERT INTO notifications (user_id, type, title, message, metadata)
		VALUES ($1, $2, $3, $4, $5)`,
		userID, notifType, title, message, data,
	)
	return err
}

func (s *Service) List(ctx context.Context, userID string, onlyUnread bool, page, pageSize int) ([]*Notification, int, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	where := "WHERE user_id = $1"
	args := []any{userID}
	if onlyUnread {
		where += " AND is_read = false"
	}

	var total int
	if err := s.pool.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications `+where, args...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	args = append(args, pageSize, offset)
	n := len(args)

	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
		SELECT id, user_id, type, title, message, is_read, metadata, created_at
		FROM notifications %s
		ORDER BY created_at DESC
		LIMIT $%d OFFSET $%d`, where, n-1, n), args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []*Notification
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.IsRead, &n.Metadata, &n.CreatedAt); err != nil {
			return nil, 0, err
		}
		list = append(list, &n)
	}
	if list == nil {
		list = []*Notification{}
	}
	return list, total, rows.Err()
}

func (s *Service) MarkRead(ctx context.Context, id, userID string) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, id, userID)
	return err
}

func (s *Service) MarkAllRead(ctx context.Context, userID string) (int64, error) {
	tag, err := s.pool.Exec(ctx,
		`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, userID)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}
