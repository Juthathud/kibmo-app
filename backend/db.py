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
    return conn


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
