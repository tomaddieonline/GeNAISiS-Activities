"""Public page metadata and URLs, independent of proxy and client Host headers."""

from urllib.parse import urlsplit

from flask import current_app, url_for


PAGE_METADATA = {
    "main.home": {
        "title": "Maddie GeNAISiS Activities | Human and AI Creativity",
        "description": "Explore human and AI creativity through three interactive activities: "
                       "Bot or Not, Phrase Completion and Image Sequence.",
    },
    "main.bot_or_not_page": {
        "title": "Bot or Not: The Great Art Guess Off | GeNAISiS Activities",
        "description": "Can you tell who made the artwork? Compare images by children, "
                       "professional artists and AI in the Great Art Guess Off.",
    },
    "main.phrase_info": {
        "title": "Phrase Completion: Guess Who Wrote It | GeNAISiS Activities",
        "description": "Discover the Phrase Completion activity. Guess whether a sentence "
                       "was completed by AI, a child or a teacher, then explore the feedback.",
    },
    "main.phrase_play": {
        "title": "Play Phrase Completion | GeNAISiS Activities",
        "description": "Play Phrase Completion: read each completed phrase, choose AI, "
                       "child or teacher, and see the answer with an explanation.",
    },
    "main.image_sequence_info": {
        "title": "Image Sequence: Explore and Compare | GeNAISiS Activities",
        "description": "Explore the Image Sequence activity. Browse a curated collection "
                       "of images and zoom in to look more closely at each one.",
    },
    "main.image_sequence_play": {
        "title": "Browse the Image Sequence | GeNAISiS Activities",
        "description": "View the GeNAISiS image sequence, move between images, and open "
                       "each image at full-screen size for closer inspection.",
    },
}


def configure_public_origin(app):
    origin = app.config["PUBLIC_ORIGIN"].strip().rstrip("/")
    if origin:
        parts = urlsplit(origin)
        if (parts.scheme not in ("https", "http") or not parts.hostname
                or parts.path or parts.query or parts.fragment
                or parts.username is not None or parts.password is not None
                or any(character.isspace() for character in origin)):
            raise ValueError("PUBLIC_ORIGIN must be an origin such as https://pantheon.greek-geek.info, without a path")
    app.config["PUBLIC_ORIGIN"] = origin


def public_url(endpoint):
    origin = current_app.config["PUBLIC_ORIGIN"]
    if not origin:
        return None
    return origin + url_for(endpoint, _external=False)
