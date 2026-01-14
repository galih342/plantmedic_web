from app import app
from models import db, User

def seed_users():
    with app.app_context():
        admin_email = "admin@plantmedic.com"
        user_email = "user@plantmedic.com"

        if not User.query.filter_by(email=admin_email).first():
            admin = User.create(
                email=admin_email,
                password="password",
                role="admin"
            )
            db.session.add(admin)
            print("✅ Admin dibuat")

        if not User.query.filter_by(email=user_email).first():
            user = User.create(
                email=user_email,
                password="password",
                role="user"
            )
            db.session.add(user)
            print("✅ User dibuat")

        db.session.commit()
        print("🎉 Seeder selesai")

if __name__ == "__main__":
    seed_users()
