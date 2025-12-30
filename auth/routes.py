from flask import request, redirect, url_for, flash, session, Blueprint
from flask_login import login_user, logout_user
from werkzeug.security import check_password_hash
from models import User

auth_bp = Blueprint("auth", __name__)

@auth_bp.route("/login", methods=["POST"])
def login():
    logout_user()      # 🔥 INI KUNCI UTAMA
    session.clear()    # 🔥 BARU clear session

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

    login_user(user)   # 🔥 login user BARU

    if user.role == "admin":
        return redirect(url_for("admin_dashboard"))

    return redirect(url_for("user_dashboard"))



@auth_bp.route("/logout")
def logout():
    logout_user()
    session.clear()
    return redirect(url_for("auth.login"))
