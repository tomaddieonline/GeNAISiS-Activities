from http.client import RemoteDisconnected
import unittest
from unittest.mock import MagicMock, patch
from urllib.error import HTTPError, URLError

from scripts.check_container import wait_for_http


class ContainerReadinessTests(unittest.TestCase):
    def test_connection_reset_during_startup_is_retried(self):
        response = MagicMock()
        response.__enter__.return_value.status = 200
        with (
            patch("scripts.check_container.urlopen", side_effect=[
                ConnectionResetError(104, "Connection reset by peer"), response,
            ]) as request,
            patch("scripts.check_container.time.sleep") as sleep,
            patch("scripts.check_container.time.monotonic", side_effect=[0, 0, 1]),
        ):
            wait_for_http("http://127.0.0.1:8000")
        self.assertEqual(request.call_count, 2)
        sleep.assert_called_once_with(1)

    def test_other_transient_startup_failures_are_retried(self):
        for error in (
            URLError("Connection refused"),
            TimeoutError("Timed out"),
            RemoteDisconnected("Remote end closed connection without response"),
            HTTPError("http://127.0.0.1:8000/", 503, "Starting", {}, None),
        ):
            if isinstance(error, HTTPError):
                self.addCleanup(error.close)
            with self.subTest(error=type(error).__name__):
                response = MagicMock()
                response.__enter__.return_value.status = 200
                with (
                    patch("scripts.check_container.urlopen", side_effect=[error, response]) as request,
                    patch("scripts.check_container.time.sleep"),
                    patch("scripts.check_container.time.monotonic", side_effect=[0, 0, 1]),
                ):
                    wait_for_http("http://127.0.0.1:8000")
                self.assertEqual(request.call_count, 2)

    def test_persistent_resets_still_fail_at_the_deadline(self):
        error = ConnectionResetError(104, "Connection reset by peer")
        with (
            patch("scripts.check_container.urlopen", side_effect=error) as request,
            patch("scripts.check_container.time.sleep"),
            patch("scripts.check_container.time.monotonic", side_effect=[0, 0, 1, 2]),
        ):
            with self.assertRaisesRegex(RuntimeError, "within 2 seconds") as result:
                wait_for_http("http://127.0.0.1:8000", timeout=2)
        self.assertEqual(request.call_count, 2)
        self.assertIs(result.exception.__cause__, error)

    def test_unexpected_errors_are_not_retried(self):
        with (
            patch("scripts.check_container.urlopen", side_effect=ValueError("Invalid URL")),
            patch("scripts.check_container.time.sleep") as sleep,
        ):
            with self.assertRaisesRegex(ValueError, "Invalid URL"):
                wait_for_http("invalid")
        sleep.assert_not_called()


if __name__ == "__main__":
    unittest.main()
