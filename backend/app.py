from flask import Flask
from flask_cors import CORS

from db import init_db
from blueprints.auth import bp as auth_bp
from blueprints.profile import bp as profile_bp
from blueprints.jobs import bp as jobs_bp
from blueprints.matches import bp as matches_bp
from blueprints.admin import bp as admin_bp

app = Flask(__name__)
CORS(app)

app.register_blueprint(auth_bp)
app.register_blueprint(profile_bp)
app.register_blueprint(jobs_bp)
app.register_blueprint(matches_bp)
app.register_blueprint(admin_bp)

init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5001, debug=True)
