from html.parser import HTMLParser
import unittest
from urllib.parse import urlsplit
from xml.etree import ElementTree

from app import create_app


class HeadMetadata(HTMLParser):
    def __init__(self, html):
        super().__init__()
        self.in_head = False
        self.canonicals = []
        self.descriptions = []
        self.verifications = []
        self.titles = 0
        self.feed(html)

    def handle_starttag(self, tag, attributes):
        attributes = dict(attributes)
        if tag == "head":
            self.in_head = True
        if not self.in_head:
            return
        if tag == "title":
            self.titles += 1
        if tag == "link" and attributes.get("rel") == "canonical":
            self.canonicals.append(attributes["href"])
        if tag == "meta":
            name = attributes.get("name")
            if name == "description":
                self.descriptions.append(attributes["content"])
            elif name == "google-site-verification":
                self.verifications.append(attributes["content"])

    def handle_endtag(self, tag):
        if tag == "head":
            self.in_head = False


class SearchMetadataTests(unittest.TestCase):
    def test_sitemap_and_canonicals_use_public_origin_and_mount_not_request_headers(self):
        origin = "https://pantheon.greek-geek.info"
        paths = ("/", "/games/bot-or-not", "/games/phrase-completion",
                 "/games/phrase-completion/play", "/games/image-sequence",
                 "/games/image-sequence/play")
        for prefix in ("", "/genaisis", "/nested/activities"):
            with self.subTest(prefix=prefix):
                client = create_app({"TESTING": True, "URL_PREFIX": prefix,
                                     "PUBLIC_ORIGIN": origin + "/"}).test_client()
                headers = {"Host": "127.0.0.1:8083", "X-Forwarded-Host": "wrong.example",
                           "X-Forwarded-Prefix": "/wrong", "X-Forwarded-Proto": "http"}
                response = client.get(prefix + "/sitemap.xml", headers=headers)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.mimetype, "application/xml")
                root = ElementTree.fromstring(response.data)
                urls = [node.text for node in root.findall(
                    "{http://www.sitemaps.org/schemas/sitemap/0.9}url/"
                    "{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
                self.assertCountEqual(urls, [origin + prefix + path for path in paths])
                descriptions = set()
                for url in urls:
                    page = client.get(urlsplit(url).path + "?utm_source=test", headers=headers)
                    self.assertEqual(page.status_code, 200)
                    metadata = HeadMetadata(page.get_data(as_text=True))
                    self.assertEqual(metadata.titles, 1)
                    self.assertEqual(metadata.canonicals, [url])
                    self.assertEqual(len(metadata.descriptions), 1)
                    self.assertTrue(metadata.descriptions[0])
                    descriptions.update(metadata.descriptions)
                self.assertEqual(len(descriptions), len(paths))

    def test_unconfigured_local_preview_has_no_canonical_or_sitemap(self):
        client = create_app({"TESTING": True, "URL_PREFIX": "", "PUBLIC_ORIGIN": "",
                             "GOOGLE_SITE_VERIFICATION": ""}).test_client()
        metadata = HeadMetadata(client.get("/").get_data(as_text=True))
        self.assertEqual(metadata.canonicals, [])
        self.assertEqual(metadata.verifications, [])
        self.assertEqual(client.get("/sitemap.xml").status_code, 404)

    def test_verification_token_is_escaped_and_present_in_homepage_head_only(self):
        token = 'test-token"<&>'
        client = create_app({"TESTING": True, "URL_PREFIX": "/genaisis",
                             "GOOGLE_SITE_VERIFICATION": token}).test_client()
        html = client.get("/genaisis/").get_data(as_text=True)
        self.assertNotIn(token, html)
        self.assertEqual(HeadMetadata(html).verifications, [token])
        game_html = client.get("/genaisis/games/bot-or-not").get_data(as_text=True)
        self.assertEqual(HeadMetadata(game_html).verifications, [])

    def test_public_origin_rejects_paths_and_other_non_origin_values(self):
        for origin in ("//example.org", "https://example.org/genaisis",
                       "https://example.org?query=1", "https://user:pass@example.org"):
            with self.subTest(origin=origin):
                with self.assertRaises(ValueError):
                    create_app({"PUBLIC_ORIGIN": origin})


if __name__ == "__main__":
    unittest.main()
