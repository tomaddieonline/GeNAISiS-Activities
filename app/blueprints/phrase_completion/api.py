import uuid
from flask import Blueprint, jsonify, request, current_app
from .storage import load_items, append_response

phrase_api_bp = Blueprint("phrase_api", __name__, url_prefix="/api/phrase")

@phrase_api_bp.get("/session")
def session():
    return jsonify({"session_id": str(uuid.uuid4())})

@phrase_api_bp.get("/items")
def items():
    items = load_items(current_app.config["PHRASE_ITEMS_JSON"])
    return jsonify(items)

@phrase_api_bp.post("/submit")
def submit():
    payload = request.get_json(force=True) or {}
    required = ["session_id", "item_id", "choice", "shown_at_ms", "answered_at_ms", "rt_ms", "index"]
    missing = [k for k in required if k not in payload]
    if missing:
        return jsonify({"ok": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

    append_response(current_app.config["PHRASE_RESPONSES_JSONL"], payload)
    return jsonify({"ok": True})
