IF DB_ID('sport_tournament') IS NULL
BEGIN
    CREATE DATABASE sport_tournament;
END
GO

USE sport_tournament;
GO

CREATE TABLE users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(255) NOT NULL UNIQUE,
    full_name NVARCHAR(255) NOT NULL,
    password_hash NVARCHAR(255) NULL,
    google_id NVARCHAR(255) NULL,
    avatar_url NVARCHAR(500) NULL,
    role NVARCHAR(20) NOT NULL DEFAULT 'PLAYER',
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT chk_users_role
    CHECK (role IN ('ADMIN', 'PLAYER'))
);

CREATE TABLE tournaments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(255) NOT NULL,
    sport_type NVARCHAR(50) NOT NULL DEFAULT 'FOOTBALL',
    format NVARCHAR(50) NOT NULL,
    status NVARCHAR(30) NOT NULL DEFAULT 'UPCOMING',
    visibility NVARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    created_by INT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT fk_tournaments_created_by
    FOREIGN KEY (created_by) REFERENCES users(id),

    CONSTRAINT chk_tournaments_sport_type
    CHECK (sport_type IN ('FOOTBALL', 'BASKETBALL', 'ESPORTS')),

    CONSTRAINT chk_tournaments_format
    CHECK (format IN ('GROUP_AND_KNOCKOUT', 'ROUND_ROBIN', 'KNOCKOUT')),

    CONSTRAINT chk_tournaments_status
    CHECK (status IN ('UPCOMING', 'ACTIVE', 'COMPLETED', 'CANCELLED')),

    CONSTRAINT chk_tournaments_visibility
    CHECK (visibility IN ('PUBLIC', 'PRIVATE'))
);

CREATE TABLE tournament_participants (
    tournament_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT pk_tournament_participants
    PRIMARY KEY (tournament_id, user_id),

    CONSTRAINT fk_tp_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),

    CONSTRAINT fk_tp_user
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE stages (
    id INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id INT NOT NULL,
    name NVARCHAR(100) NOT NULL,
    sort_order INT NOT NULL,
    correct_points INT NOT NULL DEFAULT 1,
    exact_score_bonus INT NOT NULL DEFAULT 0,
    is_knockout BIT NOT NULL DEFAULT 0,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT fk_stages_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),

    CONSTRAINT uq_stages_tournament_sort
    UNIQUE (tournament_id, sort_order),

    CONSTRAINT chk_stages_points
    CHECK (correct_points >= 0 AND exact_score_bonus >= 0)
);

CREATE TABLE teams (
    id INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id INT NOT NULL,
    name NVARCHAR(255) NOT NULL,
    group_name NVARCHAR(20) NULL,
    logo_url NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT fk_teams_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),

    CONSTRAINT uq_teams_tournament_name
    UNIQUE (tournament_id, name)
);

CREATE TABLE matches (
    id INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id INT NOT NULL,
    stage_id INT NOT NULL,

    home_team_id INT NULL,
    away_team_id INT NULL,

    home_placeholder NVARCHAR(100) NULL,
    away_placeholder NVARCHAR(100) NULL,

    scheduled_time DATETIME2 NOT NULL,
    lock_minutes_before_start INT NOT NULL DEFAULT 15,

    status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',

    actual_home_score INT NULL,
    actual_away_score INT NULL,
    winner_team_id INT NULL,

    external_source NVARCHAR(50) NULL,
    external_match_id NVARCHAR(100) NULL,
    last_synced_at DATETIME2 NULL,
    sync_status NVARCHAR(30) NULL,

    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT fk_matches_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),

    CONSTRAINT fk_matches_stage
    FOREIGN KEY (stage_id) REFERENCES stages(id),

    CONSTRAINT fk_matches_home_team
    FOREIGN KEY (home_team_id) REFERENCES teams(id),

    CONSTRAINT fk_matches_away_team
    FOREIGN KEY (away_team_id) REFERENCES teams(id),

    CONSTRAINT fk_matches_winner_team
    FOREIGN KEY (winner_team_id) REFERENCES teams(id),

    CONSTRAINT chk_matches_status
    CHECK (status IN ('PENDING', 'LIVE', 'FINISHED', 'CANCELLED')),

    CONSTRAINT chk_matches_scores
    CHECK (
        (actual_home_score IS NULL OR actual_home_score >= 0)
        AND
        (actual_away_score IS NULL OR actual_away_score >= 0)
    ),

    CONSTRAINT chk_matches_lock_minutes
    CHECK (lock_minutes_before_start >= 0)
);

CREATE TABLE predictions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL,
    match_id INT NOT NULL,

    predicted_outcome NVARCHAR(20) NOT NULL,
    predicted_home_score INT NULL,
    predicted_away_score INT NULL,

    points_earned INT NOT NULL DEFAULT 0,

    submitted_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT fk_predictions_user
    FOREIGN KEY (user_id) REFERENCES users(id),

    CONSTRAINT fk_predictions_match
    FOREIGN KEY (match_id) REFERENCES matches(id),

    CONSTRAINT uq_predictions_user_match
    UNIQUE (user_id, match_id),

    CONSTRAINT chk_predictions_outcome
    CHECK (predicted_outcome IN ('HOME_WIN', 'DRAW', 'AWAY_WIN')),

    CONSTRAINT chk_predictions_scores
    CHECK (
        (predicted_home_score IS NULL OR predicted_home_score >= 0)
        AND
        (predicted_away_score IS NULL OR predicted_away_score >= 0)
    ),

    CONSTRAINT chk_predictions_points
    CHECK (points_earned >= 0)
);

CREATE TABLE leaderboard_snapshots (
    id INT IDENTITY(1,1) PRIMARY KEY,
    tournament_id INT NOT NULL,
    user_id INT NOT NULL,
    snapshot_date DATE NOT NULL,
    cumulative_points INT NOT NULL DEFAULT 0,
    daily_points INT NOT NULL DEFAULT 0,
    rank_no INT NOT NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT fk_ls_tournament
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),

    CONSTRAINT fk_ls_user
    FOREIGN KEY (user_id) REFERENCES users(id),

    CONSTRAINT uq_ls_tournament_user_date
    UNIQUE (tournament_id, user_id, snapshot_date),

    CONSTRAINT chk_ls_points
    CHECK (cumulative_points >= 0 AND daily_points >= 0),

    CONSTRAINT chk_ls_rank
    CHECK (rank_no > 0)
);

CREATE INDEX idx_users_email
ON users(email);

CREATE INDEX idx_tournaments_status
ON tournaments(status);

CREATE INDEX idx_tournament_participants_user
ON tournament_participants(user_id);

CREATE INDEX idx_stages_tournament
ON stages(tournament_id);

CREATE INDEX idx_teams_tournament_group
ON teams(tournament_id, group_name);

CREATE INDEX idx_matches_tournament_time
ON matches(tournament_id, scheduled_time);

CREATE INDEX idx_matches_tournament_status
ON matches(tournament_id, status);

CREATE INDEX idx_matches_external
ON matches(external_source, external_match_id);

CREATE INDEX idx_predictions_match
ON predictions(match_id);

CREATE INDEX idx_predictions_user
ON predictions(user_id);

CREATE INDEX idx_leaderboard_snapshots_tournament_date_rank
ON leaderboard_snapshots(tournament_id, snapshot_date, rank_no);
GO

CREATE VIEW vw_leaderboard AS
SELECT
    t.id AS tournament_id,
    u.id AS user_id,
    u.full_name,
    u.email,
    SUM(p.points_earned) AS total_points,
    COUNT(p.id) AS total_predictions,
    SUM(CASE WHEN p.points_earned > 0 THEN 1 ELSE 0 END) AS correct_predictions
FROM users u
JOIN predictions p ON p.user_id = u.id
JOIN matches m ON m.id = p.match_id
JOIN tournaments t ON t.id = m.tournament_id
GROUP BY
    t.id,
    u.id,
    u.full_name,
    u.email;
GO

CREATE PROCEDURE sp_calculate_match_points
    @match_id INT
AS
BEGIN
    SET NOCOUNT ON;

    DECLARE @actual_home_score INT;
    DECLARE @actual_away_score INT;
    DECLARE @actual_outcome NVARCHAR(20);
    DECLARE @correct_points INT;
    DECLARE @exact_score_bonus INT;

    SELECT
        @actual_home_score = m.actual_home_score,
        @actual_away_score = m.actual_away_score,
        @correct_points = s.correct_points,
        @exact_score_bonus = s.exact_score_bonus
    FROM matches m
    JOIN stages s ON s.id = m.stage_id
    WHERE m.id = @match_id
      AND m.status = 'FINISHED';

    IF @actual_home_score IS NULL OR @actual_away_score IS NULL
    BEGIN
        THROW 50001, 'Match score is not available or match is not finished.', 1;
    END;

    SET @actual_outcome =
        CASE
            WHEN @actual_home_score > @actual_away_score THEN 'HOME_WIN'
            WHEN @actual_home_score = @actual_away_score THEN 'DRAW'
            ELSE 'AWAY_WIN'
        END;

    UPDATE predictions
    SET
        points_earned =
            CASE
                WHEN predicted_outcome = @actual_outcome THEN @correct_points
                ELSE 0
            END
            +
            CASE
                WHEN predicted_home_score = @actual_home_score
                 AND predicted_away_score = @actual_away_score
                THEN @exact_score_bonus
                ELSE 0
            END,
        updated_at = SYSDATETIME()
    WHERE match_id = @match_id;
END;
GO

CREATE PROCEDURE sp_finish_match
    @match_id INT,
    @actual_home_score INT,
    @actual_away_score INT
AS
BEGIN
    SET NOCOUNT ON;

    IF @actual_home_score < 0 OR @actual_away_score < 0
    BEGIN
        THROW 50002, 'Score cannot be negative.', 1;
    END;

    UPDATE matches
    SET
        actual_home_score = @actual_home_score,
        actual_away_score = @actual_away_score,
        status = 'FINISHED',
        updated_at = SYSDATETIME()
    WHERE id = @match_id;

    EXEC sp_calculate_match_points @match_id;
END;
GO