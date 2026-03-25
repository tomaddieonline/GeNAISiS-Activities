from flask import Flask
from app.config import Config

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)

    from app.blueprints.main.routes import main_bp
    app.register_blueprint(main_bp)

    from app.blueprints.bot_or_not.api import bot_or_not_api_bp
    app.register_blueprint(bot_or_not_api_bp)

    # ✅ NEW
    from app.blueprints.phrase_completion.api import phrase_api_bp
    app.register_blueprint(phrase_api_bp)

    from app.blueprints.image_sequence.api import image_seq_api_bp
    app.register_blueprint(image_seq_api_bp)


    return app
