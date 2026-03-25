import json
import os
from typing import List, Dict, Any

def load_images(images_json_path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(images_json_path):
        raise FileNotFoundError(f"images.json not found at: {images_json_path}")

    with open(images_json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("images.json must contain a list of image objects")

    for item in data:
        if "id" not in item or "filename" not in item:
            raise ValueError("Each image item must include 'id' and 'filename'")

        item.setdefault("truth", None)
        item.setdefault("description", "")

    return data

def append_response(jsonl_path: str, payload: Dict[str, Any]) -> None:
    os.makedirs(os.path.dirname(jsonl_path), exist_ok=True)

    with open(jsonl_path, "a", encoding="utf-8") as f:
        f.write(json.dumps(payload, ensure_ascii=False) + "\n")
