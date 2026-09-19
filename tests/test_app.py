import json
import os
from pathlib import Path
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest
from uuid import UUID

from app import create_app


class AppSmokeTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory(prefix="genaisis-test-")
        self.addCleanup(self.tmp.cleanup)
        self.app = create_app()
        self.app.config["TESTING"] = True
        self.outputs = {
            "BOT_OR_NOT_RESPONSES_JSONL": Path(self.tmp.name) / "bot" / "responses.jsonl",
            "PHRASE_RESPONSES_JSONL": Path(self.tmp.name) / "phrase" / "responses.jsonl",
            "IMAGE_SEQ_RESPONSES_JSONL": Path(self.tmp.name) / "sequence" / "responses.jsonl",
        }
        self.app.config.update({key: str(path) for key, path in self.outputs.items()})
        self.client = self.app.test_client()

    def test_all_pages_render(self):
        for path in (
            "/", "/games/bot-or-not", "/games/phrase-completion",
            "/games/phrase-completion/play", "/games/image-sequence",
            "/games/image-sequence/play",
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.mimetype, "text/html")

    def test_datasets_and_sessions(self):
        for prefix, endpoint, count in (
            ("/api/bot-or-not", "images", 14),
            ("/api/phrase", "items", 14),
            ("/api/image-sequence", "items", 51),
        ):
            with self.subTest(prefix=prefix):
                dataset = self.client.get(f"{prefix}/{endpoint}")
                self.assertEqual(dataset.status_code, 200)
                self.assertEqual(len(dataset.json), count)
                session = self.client.get(f"{prefix}/session")
                self.assertEqual(session.status_code, 200)
                self.assertEqual(UUID(session.json["session_id"]).version, 4)

    def test_submissions_append_and_survive_a_new_app(self):
        for prefix, endpoint, output, kind in (
            ("/api/bot-or-not", "images", "BOT_OR_NOT_RESPONSES_JSONL", "bot"),
            ("/api/phrase", "items", "PHRASE_RESPONSES_JSONL", "phrase"),
            ("/api/image-sequence", "items", "IMAGE_SEQ_RESPONSES_JSONL", "sequence"),
        ):
            with self.subTest(prefix=prefix):
                item = self.client.get(f"{prefix}/{endpoint}").json[0]
                payload = {
                    "session_id": self.client.get(f"{prefix}/session").json["session_id"],
                    "index": 0,
                }
                if kind == "sequence":
                    payload.update(item_id=item["id"], filename=item["filename"],
                                   action="start", timestamp_ms=2000)
                else:
                    payload.update(choice="ai", shown_at_ms=1000,
                                   answered_at_ms=2000, rt_ms=1000)
                    if kind == "bot":
                        payload.update(image_id=item["id"], filename=item["filename"])
                    else:
                        payload.update(item_id=item["id"])
                self.assertEqual(self.client.post(f"{prefix}/submit", json={}).status_code, 400)
                self.assertFalse(self.outputs[output].exists())
                self.assertEqual(self.client.post(f"{prefix}/submit", json=payload).status_code, 200)
                restarted = create_app()
                restarted.config.update({key: str(path) for key, path in self.outputs.items()})
                payload["index"] = 1
                self.assertEqual(restarted.test_client().post(f"{prefix}/submit", json=payload).status_code, 200)
                records = [json.loads(line) for line in self.outputs[output].read_text(encoding="utf-8").splitlines()]
                self.assertEqual([record["index"] for record in records], [0, 1])

    def test_response_directory_is_independent_of_activity_content(self):
        script = """
import json
from app import create_app
app = create_app()
keys = ('BOT_OR_NOT_RESPONSES_JSONL', 'PHRASE_RESPONSES_JSONL', 'IMAGE_SEQ_RESPONSES_JSONL')
print(json.dumps({'paths': [app.config[key] for key in keys],
                  'items_status': app.test_client().get('/api/phrase/items').status_code}))
"""
        env = dict(os.environ, RESPONSES_DIR=self.tmp.name)
        result = subprocess.run([sys.executable, "-B", "-c", script], env=env,
                                cwd=Path(__file__).resolve().parents[1],
                                check=True, capture_output=True, text=True)
        output = json.loads(result.stdout)
        self.assertEqual(output["items_status"], 200)
        for path in output["paths"]:
            self.assertEqual(Path(path).parent.parent, Path(self.tmp.name))


if __name__ == "__main__":
    unittest.main()
