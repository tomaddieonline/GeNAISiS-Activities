from flask import render_template
from . import main_bp

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

