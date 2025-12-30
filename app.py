from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from flask_login import (LoginManager, login_user, logout_user, login_required, current_user)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import os, json

from extensions import db, jwt
from models import User, Prediction, WebsiteVisit
from admin.routes import admin_bp
from auth.routes import auth_bp


# ====================
# CONFIG
# ====================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")

UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
os.makedirs(UPLOAD_FOLDER, exist_ok=True)


def allowed_file(filename):
    return (
        '.' in filename and
        filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS
    )

def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = "plantmedic-secret-key"
    # KUNCI UTAMA:
    # Mengambil database dari Railway, kalau gak ada (di laptop) pake localhost.
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost/plantmedic_db")
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "super-secret-key")
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

    db.init_app(app)
    jwt.init_app(app)
    
    with app.app_context():
        db.create_all()

    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(auth_bp)

    return app


app = create_app()

@app.before_request
def before_request_handler():
    if (
        request.endpoint
        and not request.endpoint.startswith("static")
        and not request.path.startswith("/api")
    ):
        visit = WebsiteVisit(
            path=request.path,
            ip_address=request.remote_addr,
            user_id=current_user.id if current_user.is_authenticated else None
        )
        db.session.add(visit)

    if current_user.is_authenticated and current_user.is_active:
        current_user.last_active = datetime.utcnow()

    db.session.commit()




# LOGIN MANAGER
login_manager = LoginManager(app)
login_manager.login_view = 'user_login'  # default login page untuk redirect jika belum login


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))   # <--- cukup satu tabel

# ====================
# ROUTE UTAMA
# ====================
@app.route('/')
@app.route('/index')
def index():
    return render_template('index.html')



# ====================
# ADMIN LOGIN 
# ====================
@app.route('/admin/login', methods=['GET', 'POST'])
def admin_login():
    if request.method == "POST":
        session.clear()   # 🔥 INI KUNCI

        email = request.form['email']
        password = request.form['password']

        admin = User.query.filter_by(email=email, role="admin").first()
        if admin and check_password_hash(admin.password, password):
            login_user(admin)
            return redirect(url_for('admin_dashboard'))

        flash("Wrong credentials", "error")

    return render_template("admin/login.html")



# ====================
# ADMIN DASHBOARD 
# ====================

@app.route('/admin/dashboard')
@login_required
def admin_dashboard():
    if current_user.role != "admin":
        flash("Only admins can access this page.", "error")
        return redirect(url_for('admin_login'))

    total_preds = 0
    return render_template("admin/dashboard.html", total=total_preds)


# ====================
# USER REGISTER
# ====================
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == "POST":
        username = request.form['username']
        email = request.form['email']
        password = request.form['password']

        if User.query.filter_by(email=email).first():
            flash("Email already registred!", "error")
            return redirect(url_for('register'))

        user = User(
            username=username,
            email=email,
            password=generate_password_hash(password),
            role='user',
            last_active=datetime.utcnow()  # 🔥 INI KUNCINYA
        )

        db.session.add(user)
        db.session.commit()

        flash(
            "Your account has been succesfully created. Please Login again!",
            "register_success"
        )

        return redirect(url_for('user_login'))

    return render_template("user/register.html")


# ==================== 
# USER LOGIN
# ====================
@app.route('/login', methods=['GET', 'POST'])
def user_login():
    if request.method == "POST":
        session.clear()   # 🔥 RESET SESSION LAMA

        email = request.form['email']
        password = request.form['password']

        user = User.query.filter_by(email=email).first()

        if not user or not check_password_hash(user.password, password):
            flash("Email or password wrong", "error")
            return redirect(url_for('user_login'))

        login_user(user)
        flash("Login successful", "success")
        return redirect(url_for('user_dashboard'))

    return render_template("user/login.html")



# ====================
# USER DASHBOARD
# ====================
@app.route('/dashboard')
@login_required
def user_dashboard():
    if current_user.role == "admin":
        return redirect(url_for('admin_dashboard'))

    return render_template("user/dashboard.html", username=current_user.username)



# ====================
# LOGOUT
# ====================

# USER LOGOUT 
@app.route("/user/logout")
def logout():
    logout_user()
    session.clear()
    flash("You have been logged out", "info")
    return redirect(url_for("index"))



# ADMIN LOGOUT
@app.route('/admin/logout')
def admin_logout():
    logout_user()
    session.clear()
    return redirect(url_for('index'))


@app.route('/upload', methods=['POST'])
def upload_image():
    pass


# ====================
# UPLOAD FOLDER
# ====================

@app.route("/api/predict", methods=["POST"])
def api_predict():
    if "image" not in request.files:
        return jsonify({"error": "No image uploaded"}), 400

    image = request.files["image"]
    if image.filename == "":
        return jsonify({"error": "Empty filename"}), 400
  
    filename = secure_filename(image.filename)
    save_path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
    image.save(save_path)

    # 🔥 ML
    from predict import predict_image
    result = predict_image(save_path)

    # 🔥 SIMPAN CONTEXT UNTUK CHAT AI
    session["image_context"] = {
        "label": result.get("label"),
        "confidence": result.get("confidence"),
        "status": result.get("status"),
        "predictions": result.get("predictions", []),
        "treatment": result.get("treatment", []),
        "prevention": result.get("prevention", []),
        "benefits": result.get("benefits", [])
    }

    # 🔥 JIKA LOGIN → SIMPAN KE DB
    if current_user.is_authenticated:
        prediction = Prediction(
            user_id=current_user.id,
            image_path=filename,
            result=result.get("label"),
            confidence=result.get("confidence")
        )
        db.session.add(prediction)
        db.session.commit()

    return jsonify(result)


@app.route("/api/predictions/count")
@login_required
def total_predictions():
    count = Prediction.query.filter_by(
        user_id=current_user.id
    ).count()

    return jsonify({"total": count})

@app.route("/api/predictions/recent")
@login_required
def recent_predictions():
    preds = Prediction.query.filter_by(
        user_id=current_user.id
    ).order_by(Prediction.created_at.desc()).limit(5).all()

    return jsonify([
        {
            "result": p.result,
            "confidence": p.confidence,
            "created_at": p.created_at.strftime("%Y-%m-%d %H:%M")
        } for p in preds
    ])

@app.route("/admin/api/predictions/count")
@login_required
def admin_total_predictions():
    if current_user.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    total = Prediction.query.count()
    return jsonify({"total": total})


@app.route("/admin/api/predictions/recent")
@login_required
def admin_recent_predictions():
    if current_user.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    preds = Prediction.query \
        .order_by(Prediction.created_at.desc()) \
        .limit(5).all()

    return jsonify([
        {
            "user": p.user.username if p.user else "-",
            "result": p.result,
            "confidence": p.confidence,
            "created_at": p.created_at.strftime("%Y-%m-%d %H:%M")
        } for p in preds
    ])

# ====================
# ENDPOINT CHAT AI
# ====================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DISEASE_PATH = os.path.join(BASE_DIR, "disease_data.json")

with open(DISEASE_PATH, encoding="utf-8") as f:
    disease_data = json.load(f)

@app.route("/api/chat", methods=["POST"])
@login_required
def api_chat():
    ctx = session.get("image_context")
    if not ctx:
        return jsonify({"reply": "Silakan upload gambar tanaman terlebih dahulu 🌱"})

    data = request.get_json()
    user_msg = request.get_json().get("message", "").lower()
    mode = data.get("mode", "short")  # default short

    label = ctx.get("label")
    confidence = ctx.get("confidence")
    status = ctx.get("status")

    disease = disease_data.get(label, {})
    overview = disease.get("overview", {})

    # =======================
    # STATUS: TIDAK DIKENALI
    # =======================
    if status == "tidak_dikenali":
        return jsonify({
            "reply": (
                "⚠️ Saya belum dapat mengenali tanaman ini dengan baik.\n\n"
                "Pastikan:\n"
                "- Foto fokus pada daun\n"
                "- Pencahayaan cukup\n"
                "- Tidak blur\n\n"
                "Silakan coba unggah ulang gambar."
            )
        })

    # =======================
    # STATUS: PERKIRAAN
    # =======================
    if status == "perkiraan":
        preds = ctx.get("predictions", [])

        reply = "🔍 **Tanaman ini belum dapat dikenali secara pasti**, namun mirip dengan:\n\n"
        for p in preds:
            reply += f"- {p['label']} ({p['confidence']}%)\n"

        # tampilkan deskripsi singkat di dashboard_user
        if overview:
            reply += "\n🧾 **Deskripsi Singkat:**\n"
            reply += overview.get("short", "")

        reply += "\n\n💡 *Login diperlukan untuk melihat penjelasan lengkap.*"

        return jsonify({"reply": reply})

    # =======================
    # STATUS: YAKIN
    # =======================
    description = (
    overview.get("full")
    if mode == "full"
    else overview.get("short")
)

    reply = f"""
 **Hasil Analisis Tanaman**


{description}
"""

    if "manfaat" in user_msg:
        reply += "\n💊 **Manfaat:**\n"
        for t in ctx.get("treatment", []):
            reply += f"- {t}\n"

    elif "kandungan" in user_msg:
        reply += "\n🛡️ **Kandungan:**\n"
        for p in ctx.get("prevention", []):
            reply += f" {p}\n"

    elif "asal" in user_msg:  
        reply += "\n🌱 **Asal Tanaman:**\n"
        for b in ctx.get("benefits", []):
            reply += f"- {b}\n"

    return jsonify({"reply": reply.strip()})


@app.route('/gettable', methods=['GET'])
def get_tables():
    con = get_db()
    cursor = con.cursor()

    cursor.execute("SHOW TABLES")
    tables = cursor.fetchall()

    cursor.close()
    con.close()

    table_names = [table[0] for table in tables]
    return jsonify({"tables": table_names}), 200




    
@app.route("/admin/api/user-stats")
def user_stats():
    now = datetime.utcnow()
    one_day_ago = now - timedelta(days=1)

    total = User.query.count()

    active = User.query.filter(
        User.is_active == True
    ).count()

    not_active = User.query.filter(
        User.is_active == False
    ).count()

    return jsonify({
        "active": active,
        "notActive": not_active
    })



@app.route("/admin/api/users/<int:user_id>/toggle", methods=["POST"])
@login_required
def toggle_user(user_id):
    if current_user.role != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    user = User.query.get_or_404(user_id)

    # admin tidak boleh menonaktifkan dirinya sendiri
    if user.id == current_user.id:
        return jsonify({"error": "Cannot disable yourself"}), 400

    user.is_active = not user.is_active
    db.session.commit()

    return jsonify({
        "success": True,
        "is_active": user.is_active
    })


@app.route("/admin/api/users/<int:user_id>", methods=["DELETE"])
@login_required
def delete_user(user_id):
    if current_user.role != "admin":
        return jsonify({"error": "Unauthorized"}), 403

    user = User.query.get_or_404(user_id)

    if user.id == current_user.id:
        return jsonify({"error": "Cannot delete yourself"}), 400

    db.session.delete(user)
    db.session.commit()

    return jsonify({"success": True})


@app.route("/api/chat/archives")
@login_required
def get_archives():
    archives = ChatArchive.query.filter_by(
        user_id=current_user.id
    ).order_by(ChatArchive.updated_at.desc()).all()

    return jsonify([
        {
            "id": a.id,
            "title": a.title or "Chat",
            "last_message": a.last_message
        } for a in archives
    ])


@app.route("/api/chat/<int:archive_id>")
@login_required
def get_chat(archive_id):
    archive = ChatArchive.query.filter_by(
        id=archive_id,
        user_id=current_user.id
    ).first_or_404()

    return jsonify([
        {
            "sender": m.sender,
            "content": m.content
        } for m in archive.messages
    ])


@app.route("/api/user/profile", methods=["POST"])
@login_required
def update_profile():
    username = request.form.get("username")
    avatar = request.files.get("avatar")

    if username:
        current_user.username = username

    if avatar:
        filename = secure_filename(avatar.filename)
        path = os.path.join(app.config["UPLOAD_FOLDER"], filename)
        avatar.save(path)
        current_user.photo_url = f"/static/uploads/{filename}"

    db.session.commit()
    return jsonify({"success": True})



# ====================
# DELETE ACCOUNT
# ====================
@app.route("/api/user/delete", methods=["POST"])
@login_required
def delete_account():
    try:
        user = current_user
        db.session.delete(user)
        db.session.commit()

        logout_user()

        return jsonify({
            "status": "success"
        })
    except Exception as e:
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


@app.route("/admin/api/visits")
@login_required
def admin_visits():
    if current_user.role != "admin":
        return jsonify({"error": "Forbidden"}), 403

    visits = (
        db.session.query(
            db.func.date(WebsiteVisit.visited_at),
            db.func.count()
        )
        .group_by(db.func.date(WebsiteVisit.visited_at))
        .order_by(db.func.date(WebsiteVisit.visited_at))
        .all()
    )

    labels = [v[0].strftime("%Y-%m-%d") for v in visits]
    values = [v[1] for v in visits]

    return jsonify({
        "labels": labels,
        "values": values
    })


# ====================
# MAIN
# ====================
if __name__ == '__main__':
    # Gunakan PORT dari environment Railway, default 5000 jika di lokal
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)


    


