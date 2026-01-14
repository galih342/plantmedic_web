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
class User(UserMixin, db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(20), default='user')
    is_active = db.Column(db.Boolean, default=True)
    last_active = db.Column(db.DateTime, default=datetime.utcnow)
    
    # 🔥 TAMBAHKAN INI
    photo_url = db.Column(db.String(255), nullable=True)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    predictions = db.relationship('Prediction', backref='user', lazy=True, cascade='all, delete-orphan')
    visits = db.relationship('WebsiteVisit', backref='user', lazy=True)
    chat_histories = db.relationship('ChatHistory', backref='user', lazy=True, cascade='all, delete-orphan')  # 🔥 NEW
    chat_archives = db.relationship('ChatArchive', backref='user', lazy=True, cascade='all, delete-orphan')  # 🔥 NEW

    @classmethod
    def create(cls, email, password, role="user", username=None):
        return cls(
            username=username or email.split("@")[0],
            email=email,
            password=generate_password_hash(password),
            role=role
        )

    def __repr__(self):
        return f'<User {self.email}>'

 
# ===================================
# TABLE CHAT HISTORY
# ===================================
class ChatHistory(db.Model):
    __tablename__ = 'chat_histories'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    image_path = db.Column(db.String(255), nullable=True)
    label = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'image': f"/static/uploads/{self.image_path}" if self.image_path else "",
            'label': self.label,
            'createdAt': self.created_at.isoformat()
        }

# ===================================
# TABLE PREDICTION
# ===================================
class Prediction(db.Model):
    __tablename__ = 'predictions'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    image_path = db.Column(db.String(255), nullable=False)
    result = db.Column(db.String(100), nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Prediction {self.result}>'

  
# ===================================
# TABLE WEBSITE VISIT
# ===================================
class WebsiteVisit(db.Model):
    __tablename__ = 'website_visits'
    
    id = db.Column(db.Integer, primary_key=True)
    path = db.Column(db.String(255), nullable=False)
    ip_address = db.Column(db.String(50), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    visited_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<Visit {self.path}>'


# ===================================
# TABLE CHAT ARCHIVES
# ===================================
class ChatArchive(db.Model):
    __tablename__ = 'chat_archives'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    image_path = db.Column(db.String(255), nullable=True)
    label = db.Column(db.String(100), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content': self.content,
            'image': f"/static/uploads/{self.image_path}" if self.image_path else "",
            'label': self.label,
            'createdAt': self.created_at.isoformat()
        }

    def __repr__(self):
        return f'<ChatArchive {self.title}>'