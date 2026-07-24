import math

from flask import request


def current_user(conn):
    """Resolve the caller from the Authorization: Bearer <token> header
    issued at login/register (see auth.verify_otp). Returns the users row,
    or None if the header is missing or the token doesn't match anyone —
    endpoints that need to know who's really asking (not just trust a
    client-supplied id) should check this rather than reading an id
    straight out of the request body/query string."""
    auth = request.headers.get("Authorization", "")
    token = auth[7:].strip() if auth.startswith("Bearer ") else ""
    if not token:
        return None
    return conn.execute("SELECT * FROM users WHERE auth_token = ?", (token,)).fetchone()


def job_amount(job):
    return job["rate"] if job["pay_type"] == "lump_sum" else job["rate"] * job["days"]


def rate_label(job):
    return f"เหมา {job['rate']} บาท" if job["pay_type"] == "lump_sum" else f"{job['rate']} บาท/วัน"


def job_filters(args):
    """Shared WHERE-clause fragments for filtering job listings by
    category/location/rate range — used by the public feed and a worker's
    available-jobs list. `args` is a query-string-like mapping (request.args)."""
    clauses, params = [], []
    if args.get("category"):
        clauses.append("j.category LIKE ?")
        params.append(f"%{args['category']}%")
    if args.get("location"):
        clauses.append("j.location LIKE ?")
        params.append(f"%{args['location']}%")
    if args.get("min_rate"):
        clauses.append("j.rate >= ?")
        params.append(args["min_rate"])
    if args.get("max_rate"):
        clauses.append("j.rate <= ?")
        params.append(args["max_rate"])
    return clauses, params


def haversine_meters(lat1, lng1, lat2, lng2):
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
