import os

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
DATA_DIR = os.path.join(PROJECT_ROOT, "data")

class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-secret-key")

    BOT_OR_NOT_IMAGES_JSON = os.path.join(DATA_DIR, "bot_or_not", "images.json")
    BOT_OR_NOT_RESPONSES_JSONL = os.path.join(DATA_DIR, "bot_or_not", "responses.jsonl")

    # ✅ NEW: Phrase Completion game
    PHRASE_ITEMS_JSON = os.path.join(DATA_DIR, "phrase_completion", "items.json")
    PHRASE_RESPONSES_JSONL = os.path.join(DATA_DIR, "phrase_completion", "responses.jsonl")

    IMAGE_SEQ_ITEMS_JSON = os.path.join(DATA_DIR, "image_sequence", "items.json")
    IMAGE_SEQ_RESPONSES_JSONL = os.path.join(DATA_DIR, "image_sequence", "responses.jsonl")

