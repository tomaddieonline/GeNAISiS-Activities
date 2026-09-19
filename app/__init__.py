import re

from flask import Flask
from werkzeug.exceptions import NotFound
from werkzeug.middleware.dispatcher import DispatcherMiddleware
from app.config import Config

def create_app(config=None):
    app = Flask(__name__)
    app.config.from_object(Config)
    if config is not None:
        app.config.update(config)

    from app.blueprints.main.routes import main_bp
    app.register_blueprint(main_bp)

    from app.blueprints.bot_or_not.api import bot_or_not_api_bp
    app.register_blueprint(bot_or_not_api_bp)

    # ✅ NEW
    from app.blueprints.phrase_completion.api import phrase_api_bp
    app.register_blueprint(phrase_api_bp)

    from app.blueprints.image_sequence.api import image_seq_api_bp
    app.register_blueprint(image_seq_api_bp)


    prefix = app.config["URL_PREFIX"].rstrip("/")
    if prefix:
        if not re.fullmatch(r"(?:/[A-Za-z0-9_-]+)+", prefix):
            raise ValueError("URL_PREFIX must be a path such as /genaisis")
        app.wsgi_app = DispatcherMiddleware(NotFound(), {prefix: app.wsgi_app})

    return app
