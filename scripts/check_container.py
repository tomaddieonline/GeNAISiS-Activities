"""Smoke-test a built image using a disposable Docker container and named volume.

Usage: python scripts/check_container.py genaisis-activities:test
Requires a Linux Docker engine. Does not touch the deployed application's data.
"""

import json
import subprocess
import sys
import time
from urllib.error import URLError
from urllib.request import Request, urlopen
from uuid import uuid4


def docker(*args):
    return subprocess.run(["docker", *args], check=True, capture_output=True,
                          text=True, timeout=120).stdout.strip()


def main(image):
    name = f"genaisis-smoke-{uuid4().hex[:12]}"
    volume = f"{name}-responses"
    docker("volume", "create", volume)
    try:
        def start():
            docker("run", "--detach", "--name", name,
                   "--publish", "127.0.0.1::8000",
                   "--mount", f"type=volume,src={volume},dst=/var/lib/genaisis",
                   "--read-only", "--tmpfs", "/tmp:rw,noexec,nosuid,size=64m",
                   "--cap-drop", "ALL", "--security-opt", "no-new-privileges:true", image)
            port = docker("port", name, "8000/tcp").split(":")[-1]
            base = f"http://127.0.0.1:{port}"
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline:
                try:
                    with urlopen(base + "/", timeout=2) as response:
                        if response.status == 200:
                            return base
                except (URLError, TimeoutError):
                    pass
                time.sleep(1)
            raise RuntimeError("Container did not become ready within 60 seconds")

        base = start()
        assert docker("exec", name, "id", "-u") == "10001", "Container must run as UID 10001"
        docker("exec", name, "python", "-c",
               "from pathlib import Path; "
               "assert not list(Path('/app').rglob('*.pyc')); "
               "assert not list(Path('/app/data').rglob('responses.jsonl')); "
               "assert not list(Path('/var/lib/genaisis').rglob('responses.jsonl'))")

        for path in ("/", "/games/bot-or-not", "/games/phrase-completion",
                     "/games/phrase-completion/play", "/games/image-sequence",
                     "/games/image-sequence/play"):
            with urlopen(base + path, timeout=5) as response:
                assert response.status == 200, path

        records = {}
        for prefix, endpoint, folder in (
            ("/api/bot-or-not", "images", "bot_or_not"),
            ("/api/phrase", "items", "phrase_completion"),
            ("/api/image-sequence", "items", "image_sequence"),
        ):
            with urlopen(base + prefix + "/session", timeout=5) as response:
                session_id = json.load(response)["session_id"]
            with urlopen(base + prefix + "/" + endpoint, timeout=5) as response:
                item = json.load(response)[0]
            payload = {"session_id": session_id, "index": 0}
            if folder == "image_sequence":
                payload.update(item_id=item["id"], filename=item["filename"],
                               action="start", timestamp_ms=2000)
            else:
                payload.update(choice="ai", shown_at_ms=1000, answered_at_ms=2000, rt_ms=1000)
                if folder == "bot_or_not":
                    payload.update(image_id=item["id"], filename=item["filename"])
                else:
                    payload.update(item_id=item["id"])
            request = Request(base + prefix + "/submit", data=json.dumps(payload).encode(),
                              headers={"Content-Type": "application/json"}, method="POST")
            with urlopen(request, timeout=5) as response:
                assert json.load(response)["ok"] is True
            records[folder] = payload

        # Recreate the container, preserving only its named volume.
        docker("rm", "--force", name)
        start()
        for folder, expected in records.items():
            saved = docker("exec", name, "cat", f"/var/lib/genaisis/{folder}/responses.jsonl")
            assert [json.loads(line) for line in saved.splitlines()] == [expected], folder

        deadline = time.monotonic() + 45
        while time.monotonic() < deadline:
            state = json.loads(docker("inspect", name))[0]["State"]
            if state.get("Health", {}).get("Status") == "healthy":
                print("Container checks passed: pages, APIs, non-root writes, clean image, health, and volume persistence.")
                return
            time.sleep(1)
        raise RuntimeError("Docker health check did not become healthy")
    except Exception:
        subprocess.run(["docker", "logs", name], check=False, timeout=30)
        raise
    finally:
        subprocess.run(["docker", "rm", "--force", name], check=False,
                       capture_output=True, timeout=30)
        subprocess.run(["docker", "volume", "rm", volume], check=False,
                       capture_output=True, timeout=30)


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "genaisis-activities:test")
