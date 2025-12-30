from flask import Blueprint, jsonify
from flask_login import login_required, current_user
from datetime import datetime, timedelta
from sqlalchemy import func

from extensions import db
from models import User, Prediction, WebsiteVisit


admin_bp = Blueprint("admin", __name__)

# ================= USERS =================
@admin_bp.route("/api/users")
@login_required
def api_users():
    if current_user.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    users = User.query.order_by(User.id.desc()).all()

    return jsonify([
        {
            "id": u.id,
            "username": u.username,
            "email": u.email,
            "role": u.role,
            "is_active": u.is_active
        } for u in users
    ])


# ================= STATS =================
@admin_bp.route("/api/stats")
@login_required
def admin_stats():
    if current_user.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({
        "total_users": User.query.count(),
        "total_predictions": Prediction.query.count()
    })


# ================= RECENT PREDICTIONS =================
@admin_bp.route("/api/recent-predictions")
@login_required
def recent_predictions():
    if current_user.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    preds = Prediction.query.order_by(
        Prediction.created_at.desc()
    ).limit(5).all()

    return jsonify([
        {
            "id": p.id,
            "result": p.result,
            "confidence": p.confidence,
            "time": p.created_at.strftime("%d %b %Y %H:%M")
        } for p in preds
    ])


# ================= VISITS CHART =================
@admin_bp.route("/api/visits")
@login_required
def visit_stats():
    if current_user.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    today = datetime.utcnow().date()
    start_date = today - timedelta(days=2)

    labels, values = [], []

    for i in range(3):
        day = start_date + timedelta(days=i)

        count = WebsiteVisit.query.filter(
            func.date(WebsiteVisit.visited_at) == day
        ).count()

        labels.append(day.strftime("%d %b"))
        values.append(count)

    return jsonify({
        "labels": labels,
        "values": values
    })


# ================= TOTAL PREDICTIONS =================
@admin_bp.route("/api/total-predictions")
@login_required
def total_predictions():
    if current_user.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    return jsonify({"total": Prediction.query.count()})


