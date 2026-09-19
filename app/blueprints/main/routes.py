from xml.etree import ElementTree

from flask import Response, abort, current_app, render_template, request
from app.seo import PAGE_METADATA, public_url
from . import main_bp


@main_bp.context_processor
def page_metadata():
    metadata = PAGE_METADATA.get(request.endpoint)
    return {
        "page_meta": metadata,
        "canonical_url": public_url(request.endpoint) if metadata else None,
    }


@main_bp.get("/sitemap.xml")
def sitemap():
    if not current_app.config["PUBLIC_ORIGIN"]:
        abort(404)
    root = ElementTree.Element("urlset", xmlns="http://www.sitemaps.org/schemas/sitemap/0.9")
    for endpoint in PAGE_METADATA:
        node = ElementTree.SubElement(root, "url")
        ElementTree.SubElement(node, "loc").text = public_url(endpoint)
    return Response(ElementTree.tostring(root, encoding="utf-8", xml_declaration=True),
                    mimetype="application/xml")

@main_bp.get("/")
def home():
    return render_template("home.html")

@main_bp.get("/games/bot-or-not")
def bot_or_not_page():
    return render_template("games/bot_or_not.html")

# ✅ NEW: Phrase Completion pages
@main_bp.get("/games/phrase-completion")
def phrase_info():
    return render_template("games/phrase_info.html")

@main_bp.get("/games/phrase-completion/play")
def phrase_play():
    return render_template("games/phrase_play.html")

@main_bp.get("/games/image-sequence")
def image_sequence_info():
    return render_template("games/image_sequence_info.html")

@main_bp.get("/games/image-sequence/play")
def image_sequence_play():
    return render_template("games/image_sequence_play.html")

