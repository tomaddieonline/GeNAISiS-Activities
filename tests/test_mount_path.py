import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from app import create_app
from scripts.check_container import PageLinks


class MountPathTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory(prefix="genaisis-mount-test-")
        self.addCleanup(self.tmp.cleanup)
        self.app = create_app({
            "TESTING": True,
            "URL_PREFIX": "/genaisis",
            "BOT_OR_NOT_RESPONSES_JSONL": str(Path(self.tmp.name) / "bot.jsonl"),
            "PHRASE_RESPONSES_JSONL": str(Path(self.tmp.name) / "phrase.jsonl"),
            "IMAGE_SEQ_RESPONSES_JSONL": str(Path(self.tmp.name) / "sequence.jsonl"),
        })
        self.client = self.app.test_client()

    def test_pages_and_their_local_links_stay_under_the_mount_path(self):
        urls = set()
        for path in ("/", "/games/bot-or-not", "/games/phrase-completion",
                     "/games/phrase-completion/play", "/games/image-sequence",
                     "/games/image-sequence/play"):
            with self.subTest(path=path):
                response = self.client.get("/genaisis" + path)
                self.assertEqual(response.status_code, 200)
                links = PageLinks()
                links.feed(response.get_data(as_text=True))
                self.assertEqual(links.app_root, "/genaisis")
                urls.update(links.urls)
        self.assertTrue(urls)
        for url in urls:
            with self.subTest(url=url):
                self.assertTrue(url.startswith("/genaisis/"), url)
                with self.client.get(url) as response:
                    self.assertEqual(response.status_code, 200)

    def test_mounted_apis_record_submissions(self):
        for prefix, endpoint, output in (
            ("/api/bot-or-not", "images", "bot.jsonl"),
            ("/api/phrase", "items", "phrase.jsonl"),
            ("/api/image-sequence", "items", "sequence.jsonl"),
        ):
            with self.subTest(prefix=prefix):
                api = "/genaisis" + prefix
                session_id = self.client.get(api + "/session").json["session_id"]
                item = self.client.get(api + "/" + endpoint).json[0]
                payload = {"session_id": session_id, "index": 0}
                if output == "sequence.jsonl":
                    payload.update(item_id=item["id"], filename=item["filename"],
                                   action="start", timestamp_ms=2000)
                else:
                    payload.update(choice="ai", shown_at_ms=1000,
                                   answered_at_ms=2000, rt_ms=1000)
                    if output == "bot.jsonl":
                        payload.update(image_id=item["id"], filename=item["filename"])
                    else:
                        payload.update(item_id=item["id"])
                response = self.client.post(api + "/submit", json=payload)
                self.assertEqual(response.status_code, 200)
                saved = (Path(self.tmp.name) / output).read_text(encoding="utf-8")
                self.assertEqual(json.loads(saved), payload)

    def test_unmounted_paths_do_not_bypass_the_prefix(self):
        for path in ("/", "/api/phrase/items", "/static/css/phrase_completion.css", "/genaisis-other/"):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 404)

    def test_mount_without_trailing_slash_redirects_to_its_home(self):
        response = self.client.get("/genaisis")
        self.assertEqual(response.status_code, 308)
        self.assertTrue(response.headers["Location"].endswith("/genaisis/"))


if __name__ == "__main__":
    unittest.main()
