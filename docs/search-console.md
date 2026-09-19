# Google Search Console and indexing

The application provides unique page titles and descriptions, canonical links,
and an XML sitemap for its six public HTML pages. APIs, response files and static
assets are not listed in the sitemap. These features help search engines discover
and describe the site; they do not guarantee indexing or a particular ranking.

## Deploy the metadata and sitemap

Pull the latest successful `migration-to-new-site` image in Portainer. In the
stack's `web.environment`, keep `URL_PREFIX` and add the public origin:

```yaml
environment:
  URL_PREFIX: /genaisis
  PUBLIC_ORIGIN: https://pantheon.greek-geek.info
```

`PUBLIC_ORIGIN` is the HTTPS scheme and hostname, with no `/genaisis` path.
The app adds its configured mount path when generating URLs, so proxy headers
or a request to `127.0.0.1:8083` cannot change the canonical hostname.
The supplied `portainer-stack.yaml` includes these defaults. Local development
leaves `PUBLIC_ORIGIN` empty, omitting canonical links and returning 404 for the
sitemap until a public origin is explicitly configured.

After redeployment, open:

- Home: <https://pantheon.greek-geek.info/genaisis/>
- Sitemap: <https://pantheon.greek-geek.info/genaisis/sitemap.xml>

The sitemap should return HTTP 200 and XML with six absolute HTTPS URLs, all
under `/genaisis/`. It should not require a password. A browser displaying raw
XML without styling is normal. The existing `/genaisis/` nginx proxy location
already forwards this sitemap; no additional proxy location is needed for it.

Source: [Google sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Verify ownership and submit

1. In Search Console, select an existing verified property covering this URL,
   or add a **URL-prefix** property for `https://pantheon.greek-geek.info/genaisis/`.
   A previously verified parent property may let Google verify the child
   automatically.
2. If verification is required, choose **HTML tag** and copy only the value of
   its `content` attribute. Add it to `web.environment` in Portainer:

   ```yaml
   GOOGLE_SITE_VERIFICATION: "the-content-value-from-Google"
   ```

   Redeploy the stack, then click **Verify** in Search Console. This environment
   variable renders the tag in the homepage's HTML head; no image rebuild is
   needed for a token change. Keep the value configured after verification,
   since Google can check it again. Do not paste the entire `<meta>` element
   into the variable.
3. Under **Sitemaps**, submit the full sitemap URL. If the form already displays
   `https://pantheon.greek-geek.info/genaisis/`, enter just `sitemap.xml`.
4. Use **URL inspection** on the homepage, select **Test live URL**, then
   **Request indexing** if Google reports it is eligible. Search Console reports
   and search results take time to update.

Sources: [property types](https://support.google.com/webmasters/answer/34592),
[ownership verification](https://support.google.com/webmasters/answer/9008080),
[request a recrawl](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl).

## Optional root robots.txt on the shared nginx host

Google reads `https://pantheon.greek-geek.info/robots.txt`, not
`/genaisis/robots.txt`. The application does not try to control the shared
host's root crawler policy. Direct submission through Search Console works
without adding a robots.txt file.

A live check on 2026-09-19 returned HTTP 200 for the homepage and HTTP 401 for
the root robots.txt. Google treats a robots.txt 401 as no crawl restrictions;
it is not evidence that the public homepage is blocked. A public robots.txt
would nevertheless let crawlers discover the sitemap directly.

If the host already has a robots.txt policy, preserve its rules and add:

```text
Sitemap: https://pantheon.greek-geek.info/genaisis/sitemap.xml
```

For a host with no existing crawler policy, this optional exact location can
serve a public sitemap pointer inside the existing HTTPS server block:

```nginx
location = /robots.txt {
    auth_basic off;
    default_type text/plain;
    return 200 "Sitemap: https://pantheon.greek-geek.info/genaisis/sitemap.xml\n";
}
```

The pointer adds no allow/disallow rules for other applications. It does not
remove their authentication. Check `sudo nginx -t` before reloading nginx.
The repository does not install this block on the server.

Sources: [robots.txt location and sitemap pointers](https://developers.google.com/crawling/docs/robots-txt/create-robots-txt),
[Google handling of robots.txt HTTP errors](https://developers.google.com/crawling/docs/robots-txt/robots-txt-spec).

Descriptions can inform Google's result snippets, but Google can choose other
page text. No keyword meta tag or Analytics installation is needed for this
setup.

Sources: [search snippets](https://developers.google.com/search/docs/appearance/snippet),
[supported metadata](https://developers.google.com/search/docs/crawling-indexing/special-tags).
