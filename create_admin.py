from models import db, User
from werkzeug.security import generate_password_hash
from app import app

with app.app_context():
    admin = User(
        username="admin",
        email="admin@gmail.com",
        password=generate_password_hash("admin90#"),
        role="admin"
    )
    db.session.add(admin)
    db.session.commit()

print("Admin berhasil dibuat!")
