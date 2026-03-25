import uuid
from flask import Blueprint, jsonify, request, current_app
from .storage import load_items, append_response

image_seq_api_bp = Blueprint("image_seq_api", __name__, url_prefix="/api/image-sequence")

@image_seq_api_bp.get("/session")
def session():
    return jsonify({"session_id": str(uuid.uuid4())})

@image_seq_api_bp.get("/items")
def items():
    items = load_items(current_app.config["IMAGE_SEQ_ITEMS_JSON"])
    return jsonify(items)

@image_seq_api_bp.post("/submit")
def submit():
    payload = request.get_json(force=True) or {}
    required = ["session_id", "item_id", "filename", "action", "index", "timestamp_ms"]
    missing = [k for k in required if k not in payload]
    if missing:
        return jsonify({"ok": False, "error": f"Missing fields: {', '.join(missing)}"}), 400

    append_response(current_app.config["IMAGE_SEQ_RESPONSES_JSONL"], payload)
    return jsonify({"ok": True})
