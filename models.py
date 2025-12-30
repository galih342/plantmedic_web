from flask_login import UserMixin
from datetime import datetime
from extensions import db

# ===================================
# TABLE ADMIN
# ===================================
class Admin(db.Model, UserMixin):
    __tablename__ = "admin"

    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)

    def __repr__(self):
        return f"<Admin {self.email}>"


# ===================================
# TABLE USER
# ===================================
class User(db.Model, UserMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default="user")
    is_active = db.Column(db.Boolean, default=True)
    last_active = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f"<User {self.username}>"


class AIHistory(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    prompt = db.Column(db.Text)
    result = db.Column(db.Text)
    archived = db.Column(db.Boolean, default=False)

# ===================================
# TABLE PREDICTION
# ===================================
class Prediction(db.Model):
    __tablename__ = "predictions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    image_path = db.Column(db.String(255))
    result = db.Column(db.String(100))
    confidence = db.Column(db.Float)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="predictions")

  
# ===================================
# TABLE WEBSITE VISIT
# ===================================
class WebsiteVisit(db.Model):
    __tablename__ = "website_visit"

    id = db.Column(db.Integer, primary_key=True)
    path = db.Column(db.String(255))
    ip_address = db.Column(db.String(45))
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"))
    visited_at = db.Column(db.DateTime, default=datetime.utcnow)

    user = db.relationship("User", backref="visits")
