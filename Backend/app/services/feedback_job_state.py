"""Choose the current job without depending on database row order."""
ACTIVE_JOB_STATUSES = frozenset({'queued', 'processing', 'retry'})


def current_jobs_by_answer(jobs):
    selected = {}
    def rank(job):
        return (job.status in ACTIVE_JOB_STATUSES, job.created_at, str(job.id))
    for job in jobs:
        previous = selected.get(job.answer_id)
        if previous is None or rank(job) > rank(previous):
            selected[job.answer_id] = job
    return selected
