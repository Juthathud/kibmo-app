"""
One-off CLI to create an admin account. Deliberately NOT an HTTP route --
a public admin-registration endpoint would let anyone create an admin
account. Run manually:

    python create_admin.py <username>

Prompts for the password via getpass (not argv) so it never lands in
shell history or `ps` output.
"""
import getpass
import sqlite3
import sys

from admin_auth import hash_password
from db import get_db, init_db


def main():
    if len(sys.argv) != 2:
        print("Usage: python create_admin.py <username>")
        sys.exit(1)

    username = sys.argv[1].strip()
    if not username:
        print("Username cannot be empty.")
        sys.exit(1)

    password = getpass.getpass("Password: ")
    if len(password) < 8:
        print("Password must be at least 8 characters.")
        sys.exit(1)
    confirm = getpass.getpass("Confirm password: ")
    if password != confirm:
        print("Passwords do not match.")
        sys.exit(1)

    init_db()  # ensures the admins table exists even on a brand-new data.db

    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO admins (username, password_hash) VALUES (?, ?)",
            (username, hash_password(password)),
        )
        conn.commit()
    except sqlite3.IntegrityError:
        print(f"An admin with username '{username}' already exists.")
        sys.exit(1)
    finally:
        conn.close()

    print(f"Admin account '{username}' created.")


if __name__ == "__main__":
    main()
