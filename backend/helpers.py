def job_amount(job):
    return job["rate"] if job["pay_type"] == "lump_sum" else job["rate"] * job["days"]


def rate_label(job):
    return f"เหมา {job['rate']} บาท" if job["pay_type"] == "lump_sum" else f"{job['rate']} บาท/วัน"
