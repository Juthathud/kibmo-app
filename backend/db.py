import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).parent / "data.db"

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL UNIQUE,
    name TEXT,
    role TEXT CHECK(role IN ('employer','worker')),
    profile_complete INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS otp_codes (
    phone TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    ref TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employer_id INTEGER NOT NULL REFERENCES users(id),
    job_type TEXT NOT NULL CHECK(job_type IN ('labor','procurement')) DEFAULT 'labor',
    category TEXT NOT NULL,
    pay_type TEXT NOT NULL CHECK(pay_type IN ('daily','lump_sum')) DEFAULT 'daily',
    rate INTEGER NOT NULL,
    headcount INTEGER NOT NULL,
    days INTEGER NOT NULL DEFAULT 1,
    location TEXT NOT NULL,
    job_date TEXT NOT NULL,
    gps_auto_checkin INTEGER NOT NULL DEFAULT 0,
    item_list TEXT,
    budget INTEGER,
    status TEXT NOT NULL CHECK(status IN ('open','staffed','in_progress','completed')) DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    worker_id INTEGER NOT NULL REFERENCES users(id),
    status TEXT NOT NULL CHECK(status IN ('accepted','declined')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(job_id, worker_id)
);
"""

GPS_PROXIMITY_METERS = 200

# Worker onboarding-wizard fields, added incrementally as ALTER TABLE
# statements: CREATE TABLE IF NOT EXISTS does nothing for a column added
# after the table already exists.
MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN postal_code TEXT",
    "ALTER TABLE users ADD COLUMN province TEXT",
    "ALTER TABLE users ADD COLUMN district TEXT",
    "ALTER TABLE users ADD COLUMN subdistrict TEXT",
    "ALTER TABLE users ADD COLUMN address TEXT",
    "ALTER TABLE users ADD COLUMN military_status TEXT",
    "ALTER TABLE users ADD COLUMN has_vehicle INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN vehicle_types TEXT",
    "ALTER TABLE users ADD COLUMN referral_source TEXT",
    "ALTER TABLE users ADD COLUMN job_types TEXT",
    "ALTER TABLE users ADD COLUMN rate_min INTEGER",
    "ALTER TABLE users ADD COLUMN rate_max INTEGER",
    "ALTER TABLE users ADD COLUMN avail_time_from TEXT",
    "ALTER TABLE users ADD COLUMN avail_time_to TEXT",
    "ALTER TABLE users ADD COLUMN avail_anytime INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN avail_days TEXT",
    "ALTER TABLE users ADD COLUMN interested_categories TEXT",
    "ALTER TABLE users ADD COLUMN work_areas TEXT",
    "ALTER TABLE users ADD COLUMN id_card_url TEXT",
    "ALTER TABLE users ADD COLUMN bank_account_url TEXT",
    "ALTER TABLE users ADD COLUMN onboarding_complete INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN profile_photo_url TEXT",
    "ALTER TABLE users ADD COLUMN title_prefix TEXT",
    "ALTER TABLE users ADD COLUMN first_name TEXT",
    "ALTER TABLE users ADD COLUMN last_name TEXT",
    "ALTER TABLE users ADD COLUMN nickname TEXT",
    "ALTER TABLE users ADD COLUMN gender TEXT",
    "ALTER TABLE users ADD COLUMN birth_date TEXT",
    "ALTER TABLE users ADD COLUMN weight_kg REAL",
    "ALTER TABLE users ADD COLUMN height_cm REAL",
    "ALTER TABLE users ADD COLUMN is_disabled INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN email TEXT",
    "ALTER TABLE users ADD COLUMN line_id TEXT",
    "ALTER TABLE users ADD COLUMN phone_visible_on_resume INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN emergency_name TEXT",
    "ALTER TABLE users ADD COLUMN emergency_phone TEXT",
    "ALTER TABLE users ADD COLUMN emergency_relation TEXT",
    "ALTER TABLE jobs ADD COLUMN lat REAL",
    "ALTER TABLE jobs ADD COLUMN lng REAL",
    "ALTER TABLE users ADD COLUMN rating_avg REAL NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN rating_count INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE matches ADD COLUMN rating_by_employer INTEGER",
    "ALTER TABLE matches ADD COLUMN rating_by_employer_note TEXT",
    "ALTER TABLE matches ADD COLUMN rating_by_worker INTEGER",
    "ALTER TABLE matches ADD COLUMN rating_by_worker_note TEXT",
    "ALTER TABLE matches ADD COLUMN checked_in INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE matches ADD COLUMN checkin_lat REAL",
    "ALTER TABLE matches ADD COLUMN checkin_lng REAL",
    "ALTER TABLE matches ADD COLUMN checkin_at TEXT",
    "ALTER TABLE matches ADD COLUMN location_verified INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE matches ADD COLUMN paid INTEGER NOT NULL DEFAULT 0",
    "ALTER TABLE matches ADD COLUMN paid_at TEXT",
]

# Columns the generic /api/profile/update endpoint is allowed to touch —
# an allowlist so the wizard's free-form "fields" dict can't be used to
# write to id/phone/role/profile_complete etc.
UPDATABLE_PROFILE_FIELDS = {
    "postal_code", "province", "district", "subdistrict", "address",
    "military_status", "has_vehicle", "vehicle_types", "referral_source",
    "job_types", "rate_min", "rate_max", "avail_time_from", "avail_time_to",
    "avail_anytime", "avail_days", "interested_categories", "work_areas",
    "onboarding_complete",
    "title_prefix", "first_name", "last_name", "nickname", "gender",
    "birth_date", "weight_kg", "height_cm", "is_disabled",
    "email", "line_id", "phone_visible_on_resume",
    "emergency_name", "emergency_phone", "emergency_relation",
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    # Let concurrent writers (e.g. two workers accepting the same job at
    # once) block and wait for each other's transaction instead of
    # immediately raising "database is locked".
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


# SQLite has no ALTER TABLE ... DROP/MODIFY CONSTRAINT, so widening a CHECK
# means rebuilding the table. These are the full, explicit target schemas
# (every column SCHEMA + MIGRATIONS produce) with the CHECK on role/status
# simply omitted — deliberately hand-written rather than introspected from
# `CREATE TABLE new AS SELECT * FROM old`, which silently drops every
# column's type/DEFAULT/PRIMARY KEY (a real bug caught in testing: it left
# `id` non-autoincrementing and `rating_avg` etc. defaulting to NULL instead
# of 0). The app already validates role/status in Python before every
# write, so losing the CHECK itself is fine — UNIQUE(phone) is restored
# explicitly since that one is worth keeping at the DB level.
_USERS_REBUILD_DDL = """
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL,
    name TEXT,
    role TEXT,
    profile_complete INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    postal_code TEXT, province TEXT, district TEXT, subdistrict TEXT, address TEXT,
    military_status TEXT,
    has_vehicle INTEGER NOT NULL DEFAULT 0,
    vehicle_types TEXT, referral_source TEXT, job_types TEXT,
    rate_min INTEGER, rate_max INTEGER,
    avail_time_from TEXT, avail_time_to TEXT,
    avail_anytime INTEGER NOT NULL DEFAULT 0,
    avail_days TEXT, interested_categories TEXT, work_areas TEXT,
    id_card_url TEXT, bank_account_url TEXT,
    onboarding_complete INTEGER NOT NULL DEFAULT 0,
    profile_photo_url TEXT, title_prefix TEXT, first_name TEXT, last_name TEXT,
    nickname TEXT, gender TEXT, birth_date TEXT,
    weight_kg REAL, height_cm REAL,
    is_disabled INTEGER NOT NULL DEFAULT 0,
    email TEXT, line_id TEXT,
    phone_visible_on_resume INTEGER NOT NULL DEFAULT 0,
    emergency_name TEXT, emergency_phone TEXT, emergency_relation TEXT,
    rating_avg REAL NOT NULL DEFAULT 0,
    rating_count INTEGER NOT NULL DEFAULT 0
)
"""

_JOBS_REBUILD_DDL = """
CREATE TABLE jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employer_id INTEGER NOT NULL REFERENCES users(id),
    job_type TEXT NOT NULL DEFAULT 'labor',
    category TEXT NOT NULL,
    pay_type TEXT NOT NULL DEFAULT 'daily',
    rate INTEGER NOT NULL,
    headcount INTEGER NOT NULL,
    days INTEGER NOT NULL DEFAULT 1,
    location TEXT NOT NULL,
    job_date TEXT NOT NULL,
    gps_auto_checkin INTEGER NOT NULL DEFAULT 0,
    item_list TEXT,
    budget INTEGER,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    lat REAL,
    lng REAL
)
"""


def _rebuild_table(conn, table_name, target_ddl):
    conn.execute("PRAGMA foreign_keys = OFF")
    # By default `ALTER TABLE ... RENAME TO` also rewrites REFERENCES
    # clauses in every OTHER table that points at the renamed one — so
    # renaming users -> users__old silently repoints matches.worker_id's
    # REFERENCES users(id) to the soon-to-be-dropped users__old, breaking FK
    # enforcement on every future INSERT. legacy_alter_table disables that
    # rewrite so other tables keep referencing the table by its real name.
    conn.execute("PRAGMA legacy_alter_table = ON")
    columns = [c["name"] for c in conn.execute(f"PRAGMA table_info({table_name})").fetchall()]
    col_list = ", ".join(columns)
    conn.execute(f"ALTER TABLE {table_name} RENAME TO {table_name}__old")
    conn.execute(target_ddl)
    conn.execute(f"INSERT INTO {table_name} ({col_list}) SELECT {col_list} FROM {table_name}__old")
    conn.execute(f"DROP TABLE {table_name}__old")
    conn.commit()
    conn.execute("PRAGMA legacy_alter_table = OFF")
    conn.execute("PRAGMA foreign_keys = ON")


def _table_needs_rebuild(conn, table_name, old_check_marker, sentinel_column):
    """True if `table_name` still has the original restrictive CHECK (never
    migrated), or if `sentinel_column` lost its DEFAULT (a previous rebuild
    here — `CREATE ... AS SELECT` — stripped it) — either way it needs
    (re)building against the explicit DDL above."""
    row = conn.execute(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name=?", (table_name,)
    ).fetchone()
    if not row:
        return False
    if old_check_marker in row["sql"]:
        return True
    col = next(
        (c for c in conn.execute(f"PRAGMA table_info({table_name})").fetchall() if c["name"] == sentinel_column),
        None,
    )
    return col is not None and col["dflt_value"] is None


def _ensure_role_allows_both():
    conn = get_db()
    if _table_needs_rebuild(conn, "users", "'employer','worker')", "rating_avg"):
        _rebuild_table(conn, "users", _USERS_REBUILD_DDL)
        conn.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)")
        conn.execute("UPDATE users SET rating_avg = 0 WHERE rating_avg IS NULL")
        conn.execute("UPDATE users SET rating_count = 0 WHERE rating_count IS NULL")
        conn.commit()
    conn.close()


def _ensure_job_status_allows_cancelled():
    conn = get_db()
    if _table_needs_rebuild(conn, "jobs", "'open','staffed','in_progress','completed')", "status"):
        _rebuild_table(conn, "jobs", _JOBS_REBUILD_DDL)
        conn.execute("UPDATE jobs SET status = 'open' WHERE status IS NULL")
        conn.commit()
    conn.close()


def init_db():
    conn = get_db()
    conn.executescript(SCHEMA)
    for migration in MIGRATIONS:
        try:
            conn.execute(migration)
        except sqlite3.OperationalError as e:
            if "duplicate column" not in str(e):
                raise
    conn.commit()
    conn.close()
    _ensure_role_allows_both()
    _ensure_job_status_allows_cancelled()
