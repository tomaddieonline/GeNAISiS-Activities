import os
import uuid
from flask import Blueprint, jsonify, request, current_app

from .storage import load_images, append_response

bot_or_not_api_bp = Blueprint(
    "bot_or_not_api",
    __name__,
    url_prefix="/api/bot-or-not"
)

@bot_or_not_api_bp.get("/session")
def session():
    return jsonify({"session_id": str(uuid.uuid4())})

@bot_or_not_api_bp.get("/images")
def images():
    path = current_app.config["BOT_OR_NOT_IMAGES_JSON"]
    items = load_images(path)
    return jsonify(items)

@bot_or_not_api_bp.post("/submit")
def submit():
    payload = request.get_json(force=True) or {}

    print(payload)

    # Basic validation (soft)
    required = ["session_id", "image_id", "filename", "choice", "shown_at_ms", "answered_at_ms", "rt_ms", "index"]
    missing = [k for k in required if k not in payload]
    if missing:
        return jsonify({"ok": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

    out_path = current_app.config["BOT_OR_NOT_RESPONSES_JSONL"]

    append_response(out_path, payload)
    return jsonify({"ok": True})
