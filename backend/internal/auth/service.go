package auth

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/redis/go-redis/v9"
	"golang.org/x/crypto/bcrypt"
)

const (
	bcryptCost          = 12
	refreshTokenPrefix  = "refresh_token:"
)

type Service struct {
	jwtSecret         []byte
	accessTokenTTL    time.Duration
	refreshTokenTTL   time.Duration
	redis             *redis.Client
}

type TokenPair struct {
	AccessToken  string `json:"accessToken"`
	RefreshToken string `json:"refreshToken"`
}

type Claims struct {
	UserID string `json:"userId"`
	jwt.RegisteredClaims
}

func NewService(jwtSecret string, accessTTLMinutes, refreshTTLDays int, redisClient *redis.Client) *Service {
	return &Service{
		jwtSecret:       []byte(jwtSecret),
		accessTokenTTL:  time.Duration(accessTTLMinutes) * time.Minute,
		refreshTokenTTL: time.Duration(refreshTTLDays) * 24 * time.Hour,
		redis:           redisClient,
	}
}

func (s *Service) HashPassword(password string) (string, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcryptCost)
	if err != nil {
		return "", fmt.Errorf("hash password: %w", err)
	}
	return string(hash), nil
}

func (s *Service) CheckPassword(hash, password string) error {
	return bcrypt.CompareHashAndPassword([]byte(hash), []byte(password))
}

func (s *Service) IssueTokenPair(userID string) (*TokenPair, error) {
	accessToken, err := s.issueAccessToken(userID)
	if err != nil {
		return nil, err
	}

	refreshToken, err := s.issueRefreshToken(userID)
	if err != nil {
		return nil, err
	}

	return &TokenPair{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
	}, nil
}

func (s *Service) issueAccessToken(userID string) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.accessTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("sign access token: %w", err)
	}
	return signed, nil
}

func (s *Service) issueRefreshToken(userID string) (string, error) {
	claims := Claims{
		UserID: userID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(s.refreshTokenTTL)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("sign refresh token: %w", err)
	}

	ctx := context.Background()
	key := refreshTokenPrefix + userID
	if err := s.redis.Set(ctx, key, signed, s.refreshTokenTTL).Err(); err != nil {
		return "", fmt.Errorf("store refresh token: %w", err)
	}

	return signed, nil
}

func (s *Service) ValidateAccessToken(tokenStr string) (*Claims, error) {
	return s.parseToken(tokenStr)
}

func (s *Service) RotateRefreshToken(tokenStr string) (*TokenPair, error) {
	claims, err := s.parseToken(tokenStr)
	if err != nil {
		return nil, err
	}

	ctx := context.Background()
	key := refreshTokenPrefix + claims.UserID
	stored, err := s.redis.Get(ctx, key).Result()
	if err != nil || stored != tokenStr {
		return nil, errors.New("refresh token invalid or expired")
	}

	return s.IssueTokenPair(claims.UserID)
}

func (s *Service) RevokeRefreshToken(userID string) error {
	ctx := context.Background()
	return s.redis.Del(ctx, refreshTokenPrefix+userID).Err()
}

func (s *Service) parseToken(tokenStr string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenStr, &Claims{}, func(t *jwt.Token) (interface{}, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", t.Header["alg"])
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return nil, fmt.Errorf("invalid token: %w", err)
	}

	claims, ok := token.Claims.(*Claims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}
