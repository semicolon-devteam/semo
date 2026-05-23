import json
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path

import main


class JobStoreRetentionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.old_job_dir = main._JOB_DIR
        self.old_jobs = dict(main.jobs)
        main._JOB_DIR = Path(self.tmp.name)
        main.jobs.clear()

    def tearDown(self):
        main.jobs.clear()
        main.jobs.update(self.old_jobs)
        main._JOB_DIR = self.old_job_dir
        self.tmp.cleanup()

    def _job(self, job_id, status, *, age):
        created_at = (datetime.now(timezone.utc) - age).isoformat()
        job = {
            "id": job_id,
            "status": status,
            "filename": "meeting.m4a",
            "size": 1234,
            "created_at": created_at,
        }
        if status == main.JobStatus.completed.value:
            job["utterances"] = [{"start_at": 0, "duration": 1000, "msg": "테스트", "spk": 0}]
            job["completed_at"] = created_at
        return job

    def test_cleanup_keeps_completed_jobs_for_later_recovery(self):
        job_id = "completed-old"
        main.jobs[job_id] = self._job(
            job_id,
            main.JobStatus.completed.value,
            age=timedelta(hours=2),
        )
        main._save_job(job_id)

        main._cleanup_jobs()

        self.assertIn(job_id, main.jobs)
        self.assertTrue(main._job_path(job_id).exists())

    def test_load_job_store_restores_completed_jobs_older_than_inflight_ttl(self):
        job_id = "completed-on-disk"
        payload = self._job(
            job_id,
            main.JobStatus.completed.value,
            age=timedelta(hours=2),
        )
        main._JOB_DIR.mkdir(parents=True, exist_ok=True)
        main._job_path(job_id).write_text(json.dumps(payload), encoding="utf-8")

        main._load_job_store()

        self.assertIn(job_id, main.jobs)
        self.assertEqual(main.jobs[job_id]["status"], main.JobStatus.completed.value)

    def test_cleanup_keeps_long_running_inflight_jobs(self):
        job_id = "inflight-old"
        main.jobs[job_id] = self._job(
            job_id,
            main.JobStatus.transcribing.value,
            age=timedelta(hours=2),
        )
        main._save_job(job_id)

        main._cleanup_jobs()

        self.assertIn(job_id, main.jobs)
        self.assertTrue(main._job_path(job_id).exists())

    def test_load_job_store_marks_inflight_jobs_failed_after_restart(self):
        job_id = "inflight-on-disk"
        payload = self._job(
            job_id,
            main.JobStatus.transcribing.value,
            age=timedelta(minutes=5),
        )
        main._JOB_DIR.mkdir(parents=True, exist_ok=True)
        main._job_path(job_id).write_text(json.dumps(payload), encoding="utf-8")

        main._load_job_store()

        self.assertEqual(main.jobs[job_id]["status"], main.JobStatus.failed.value)
        self.assertIn("Server restarted", main.jobs[job_id]["error"])


if __name__ == "__main__":
    unittest.main()
