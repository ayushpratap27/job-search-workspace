package email

import (
	"fmt"

	"gopkg.in/gomail.v2"
)

type Client struct {
	host      string
	port      int
	user      string
	password  string
	from      string
}

func NewClient(host string, port int, user, password, from string) *Client {
	return &Client{host: host, port: port, user: user, password: password, from: from}
}

func (c *Client) Send(to, subject, htmlBody string) error {
	if c.host == "" {
		return fmt.Errorf("smtp not configured (SMTP_HOST is empty)")
	}

	m := gomail.NewMessage()
	m.SetHeader("From", c.from)
	m.SetHeader("To", to)
	m.SetHeader("Subject", subject)
	m.SetBody("text/html", htmlBody)

	dialer := gomail.NewDialer(c.host, c.port, c.user, c.password)
	return dialer.DialAndSend(m)
}
