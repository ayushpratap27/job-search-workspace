-- +goose Up
-- +goose StatementBegin

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE search_configs (
    id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    keywords             TEXT[]      NOT NULL DEFAULT '{}',
    filters              JSONB       NOT NULL DEFAULT '{}',
    priority_order       JSONB       NOT NULL DEFAULT '["bangalore","remote","other"]',
    search_start_time    TIME        NOT NULL DEFAULT '09:00:00',
    summary_time         TIME        NOT NULL DEFAULT '22:00:00',
    max_jobs_per_session INT         NOT NULL DEFAULT 50,
    ai_provider          TEXT        NOT NULL DEFAULT 'none',
    is_active            BOOLEAN     NOT NULL DEFAULT TRUE,
    platform             TEXT        NOT NULL DEFAULT 'linkedin',
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT search_configs_max_jobs_positive CHECK (max_jobs_per_session > 0)
);

CREATE UNIQUE INDEX idx_search_configs_active_user
    ON search_configs (user_id, platform)
    WHERE is_active = TRUE;

CREATE TABLE companies (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT        NOT NULL,
    linkedin_url    TEXT        UNIQUE,
    career_page_url TEXT,
    website         TEXT,
    platform        TEXT        NOT NULL DEFAULT 'linkedin',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_companies_name_trgm ON companies USING GIN (name gin_trgm_ops);

CREATE TABLE job_search_sessions (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status         TEXT        NOT NULL DEFAULT 'running',
    jobs_found     INT         NOT NULL DEFAULT 0,
    jobs_applied   INT         NOT NULL DEFAULT 0,
    jobs_skipped   INT         NOT NULL DEFAULT 0,
    jobs_attention INT         NOT NULL DEFAULT 0,
    checkpoint_data JSONB,
    platform       TEXT        NOT NULL DEFAULT 'linkedin',
    started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT sessions_status_check CHECK (
        status IN ('running', 'paused', 'completed', 'failed')
    )
);

CREATE INDEX idx_sessions_user_id    ON job_search_sessions (user_id);
CREATE INDEX idx_sessions_status     ON job_search_sessions (status);
CREATE INDEX idx_sessions_started_at ON job_search_sessions (started_at DESC);

CREATE TABLE applications (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    company_id         UUID        NOT NULL REFERENCES companies(id),
    session_id         UUID        REFERENCES job_search_sessions(id),
    role               TEXT        NOT NULL,
    location           TEXT,
    priority           SMALLINT    NOT NULL DEFAULT 4,
    job_url            TEXT        NOT NULL UNIQUE,
    application_status TEXT        NOT NULL DEFAULT 'completed',
    attention_reason   TEXT,
    networking_status  TEXT        NOT NULL DEFAULT 'pending',
    notes              TEXT,
    platform           TEXT        NOT NULL DEFAULT 'linkedin',
    applied_at         TIMESTAMPTZ,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT applications_status_check CHECK (
        application_status IN ('completed', 'needs_attention', 'skipped')
    ),
    CONSTRAINT applications_priority_check CHECK (priority BETWEEN 1 AND 4)
);

CREATE INDEX idx_applications_user_id      ON applications (user_id);
CREATE INDEX idx_applications_company_id   ON applications (company_id);
CREATE INDEX idx_applications_session_id   ON applications (session_id);
CREATE INDEX idx_applications_status       ON applications (application_status);
CREATE INDEX idx_applications_networking   ON applications (networking_status);
CREATE INDEX idx_applications_priority     ON applications (priority);
CREATE INDEX idx_applications_applied_at   ON applications (applied_at DESC);
CREATE INDEX idx_applications_role_trgm    ON applications USING GIN (role gin_trgm_ops);

CREATE TABLE application_timelines (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    application_id UUID        NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
    event_type     TEXT        NOT NULL,
    event_data     JSONB       NOT NULL DEFAULT '{}',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_timelines_application_id ON application_timelines (application_id);
CREATE INDEX idx_timelines_created_at     ON application_timelines (created_at DESC);

CREATE TABLE recent_hires (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id     UUID        NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    application_id UUID        REFERENCES applications(id) ON DELETE SET NULL,
    name           TEXT        NOT NULL,
    designation    TEXT,
    joined_at      TEXT,
    profile_url    TEXT,
    platform       TEXT        NOT NULL DEFAULT 'linkedin',
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recent_hires_company_id     ON recent_hires (company_id);
CREATE INDEX idx_recent_hires_application_id ON recent_hires (application_id);

CREATE TABLE notifications (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type       TEXT        NOT NULL,
    title      TEXT        NOT NULL,
    message    TEXT        NOT NULL,
    is_read    BOOLEAN     NOT NULL DEFAULT FALSE,
    metadata   JSONB       NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user_id    ON notifications (user_id);
CREATE INDEX idx_notifications_is_read    ON notifications (user_id, is_read);
CREATE INDEX idx_notifications_created_at ON notifications (created_at DESC);

CREATE TABLE daily_summaries (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date          DATE        NOT NULL,
    ai_summary    TEXT,
    stats         JSONB       NOT NULL DEFAULT '{}',
    email_sent_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT daily_summaries_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX idx_summaries_user_date ON daily_summaries (user_id, date DESC);

-- +goose StatementEnd

-- +goose Down
-- +goose StatementBegin

DROP TABLE IF EXISTS daily_summaries;
DROP TABLE IF EXISTS notifications;
DROP TABLE IF EXISTS recent_hires;
DROP TABLE IF EXISTS application_timelines;
DROP TABLE IF EXISTS applications;
DROP TABLE IF EXISTS job_search_sessions;
DROP TABLE IF EXISTS companies;
DROP TABLE IF EXISTS search_configs;
DROP TABLE IF EXISTS users;

DROP EXTENSION IF EXISTS "pg_trgm";
DROP EXTENSION IF EXISTS "pgcrypto";

-- +goose StatementEnd
