# auth/routes.py
from flask import request, redirect, url_for, flash, session, Blueprint
from flask_login import login_user, logout_user
from werkzeug.security import check_password_hash
from models import User
from extensions import db
from datetime import datetime

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    """User login POST handler"""
    session.clear()
    logout_user()
    session.permanent = False

    email = request.form.get("email")
    password = request.form.get("password")

    user = User.query.filter_by(email=email).first()

    if not user:
        flash("Email not found", "error")
        return redirect(url_for("user_login"))

    if not check_password_hash(user.password, password):
        flash("Wrong password", "error")
        return redirect(url_for("user_login"))

    if not user.is_active:
        flash("Account is disabled", "error")
        return redirect(url_for("user_login"))

    user.last_active = datetime.utcnow()
    db.session.commit()

    login_user(user, remember=False)
    
    session['user_role'] = user.role
    session['user_id'] = user.id

    if user.role == "admin":
        return redirect(url_for("admin_dashboard"))

    return redirect(url_for("user_dashboard"))


@auth_bp.route("/logout")  # 🔥 ROUTE INI HARUS ADA
def logout():
    """User logout route"""
    session.pop('user_role', None)
    session.pop('user_id', None)
    session.pop('image_context', None)
    
    logout_user()
    session.clear()
    session.permanent = False
    
    flash("You have been logged out", "info")
    return redirect(url_for("index"))