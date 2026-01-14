from flask import Flask, render_template, request, redirect, url_for, flash, session, jsonify
from flask_login import LoginManager, login_user, logout_user, login_required, current_user
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import os, json

from extensions import db, jwt
from models import User, Prediction, WebsiteVisit, ChatHistory, ChatArchive  # 🔥 TAMBAHKAN INI
from admin.routes import admin_bp
from auth.routes import auth_bp
from predict import predict_image  # Import fungsi predict
import traceback

 

# ====================
# CONFIG
# ====================
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "database.db")

app = Flask(__name__)

# 🔥 TAMBAHKAN INI (setelah app = Flask(__name__))
UPLOAD_FOLDER = 'static/uploads/plant'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}

# Pastikan folder exists
os.makedirs(UPLOAD_FOLDER, exist_ok=True)



# Helper function
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def create_app():
    app = Flask(__name__)

    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "plantmedic-secret-key")

    # --- 👇 BAGIAN PERBAIKAN PENTING (AUTO-FIX URL) 👇 ---
    # 1. Ambil dulu URL dari Railway
    db_url = os.getenv("DATABASE_URL", "mysql+pymysql://root:@localhost/plantmedic_db")

    # 2. Kalau Railway ngasih format 'mysql://' (yang bikin crash), kita ganti paksa
    if db_url and db_url.startswith("mysql://"):
        db_url = db_url.replace("mysql://", "mysql+pymysql://", 1)

    # 3. Masukkan URL yang sudah 'sehat' ke config
    app.config["SQLALCHEMY_DATABASE_URI"] = db_url
    # -----------------------------------------------------

    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "super-secret-key")
    app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

    db.init_app(app)
    jwt.init_app(app)
    
    # --- 👇 AUTO CREATE TABLE (DENGAN PENGAMAN) 👇 ---
    # Kita nyalakan lagi biar tabelnya jadi.
    # Tapi pake try-except biar kalau database error, web TETAP NYALA (gak crash).
    with app.app_context():
        try:
            db.create_all()
            print("✅ SUKSES: Tabel database aman.")
        except Exception as e:
            print(f"⚠️ WARNING: Gagal konek database saat start. Error: {e}")
            # Aplikasi lanjut jalan walau database error

    app.register_blueprint(admin_bp, url_prefix="/admin")
    app.register_blueprint(auth_bp)

    return app


app = create_app()

@app.before_request
def before_request_handler():
    # 🔥 Skip untuk static files dan API
    if (
        request.endpoint
        and (
            request.endpoint.startswith("static")
            or request.path.startswith("/api")
        )
    ):
        return

    try:
        # 🔥 Record visit
        visit = WebsiteVisit(
            path=request.path,
            ip_address=request.remote_addr,
            user_id=current_user.id if current_user.is_authenticated else None
        )
        db.session.add(visit)

        # 🔥 Update last_active
        if current_user.is_authenticated and current_user.is_active:
            current_user.last_active = datetime.utcnow()

        db.session.commit()

    except Exception as e:
        db.session.rollback()
        print(f"❌ before_request error: {e}")


# LOGIN MANAGER
login_manager = LoginManager(app)
login_manager.login_view = 'user_login'
login_manager.session_protection = "strong"  # 🔥 TAMBAHKAN INI


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
        # 🔥 Clear session dulu
        session.clear()
        logout_user()
        session.permanent = False

        email = request.form['email']
        password = request.form['password']

        admin = User.query.filter_by(email=email, role="admin").first()
        
        if not admin:
            flash("Admin account not found", "error")
            return redirect(url_for('admin_login'))

        if not check_password_hash(admin.password, password):
            flash("Wrong password", "error")
            return redirect(url_for('admin_login'))

        if not admin.is_active:
            flash("Account is disabled", "error")
            return redirect(url_for('admin_login'))

        admin.last_active = datetime.utcnow()
        db.session.commit()

        login_user(admin, remember=False)
        
        # 🔥 Set session flag
        session['user_role'] = 'admin'
        session['user_id'] = admin.id

        return redirect(url_for('admin_dashboard'))

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
            flash("Email already registered!", "error")
            return redirect(url_for('register'))

        user = User(
            username=username,
            email=email,
            password=generate_password_hash(password),
            role='user',
            last_active=datetime.utcnow(),
            is_active=True  # 🔥 tambahkan ini
        )

        db.session.add(user)
        db.session.commit()

        flash("Account created successfully. Please login!", "register_success")
        return redirect(url_for('user_login'))

    return render_template("user/register.html")


# ==================== 
# USER LOGIN
# ====================

# 1️⃣ UPDATE LOGIN HANDLER - CLEAR SESSION
@app.route('/login', methods=['GET', 'POST'])
def user_login():
    """User login page and handler"""
    
    # Handle GET - tampilkan form
    if request.method == 'GET':
        if current_user.is_authenticated:
            if current_user.role == 'admin':
                return redirect(url_for('admin_dashboard'))
            return redirect(url_for('user_dashboard'))
        
        return render_template("user/login.html")
    
    # Handle POST - proses login
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')
        
        if not email or not password:
            return jsonify({"success": False, "error": "Email dan password wajib diisi"}), 400
        
        user = User.query.filter_by(email=email, role="user").first()
        
        if not user:
            return jsonify({"success": False, "error": "Email tidak terdaftar"}), 401
        
        if not check_password_hash(user.password, password):
            return jsonify({"success": False, "error": "Password salah"}), 401
        
        if not user.is_active:
            return jsonify({"success": False, "error": "Akun dinonaktifkan"}), 403
        
        # 🔥 CLEAR SESSION LAMA
        session.clear()
        logout_user()
        
        # 🔥 UPDATE LAST ACTIVE
        user.last_active = datetime.utcnow()
        db.session.commit()
        
        # 🔥 LOGIN USER
        login_user(user, remember=True)
        
        # 🔥 SET SESSION DATA
        session.permanent = True
        session['user_role'] = 'user'
        session['user_id'] = user.id
        
        # 🔥 CLEAR IMAGE CONTEXT
        session.pop('image_context', None)
        
        return jsonify({
            "success": True,
            "redirect": url_for('user_dashboard')
        })
        
    except Exception as e:
        print(f"❌ Login error: {e}")
        return jsonify({"success": False, "error": "Terjadi kesalahan server"}), 500



# 2️⃣ PERBAIKI GET HISTORY - PASTIKAN FILTER USER_ID
@app.route('/api/chat/history', methods=['GET'])
@login_required
def get_history_list():
    """Get all chat history for current user ONLY"""
    try:
        # 🔥 PASTIKAN CURRENT_USER ADA
        if not current_user or not current_user.is_authenticated:
            return jsonify({"error": "Unauthorized"}), 401
        
        # 🔥 FILTER BY USER_ID - STRICT!
        history = ChatHistory.query.filter_by(
            user_id=current_user.id  # ⬅️ INI KUNCI!
        ).order_by(ChatHistory.created_at.desc()).all()
        
        print(f"✅ User {current_user.id} has {len(history)} chats")  # Debug
        
        return jsonify([{
            "id": h.id,
            "title": h.title,
            "content": h.content,
            "image_path": h.image_path,
            "label": h.label,
            "created_at": h.created_at.isoformat() if h.created_at else None,
            "user_id": h.user_id  # 🔥 Tambahkan untuk debug
        } for h in history])
        
    except Exception as e:
        print(f"❌ Error getting history: {e}")
        return jsonify({"error": str(e)}), 500



# 3️⃣ PERBAIKI SAVE HISTORY - PASTIKAN USER_ID BENAR
@app.route("/api/chat/history", methods=["POST"])
@login_required
def save_chat_history():
    """Save new chat to history with proper user isolation"""
    try:
        # 🔥 PASTIKAN USER AUTHENTICATED
        if not current_user or not current_user.is_authenticated:
            return jsonify({
                "success": False,
                "error": "Unauthorized"
            }), 401
        
        data = request.json
        
        # 🔥 WAJIB ADA USER_ID
        new_chat = ChatHistory(
            title=data.get("title"),
            content=data.get("content"),
            image_path=data.get("image_path"),
            label=data.get("label"),
            user_id=current_user.id  # ⬅️ PAKSA GUNAKAN CURRENT_USER.ID
        )
        
        db.session.add(new_chat)
        db.session.commit()
        
        print(f"✅ Chat saved for user {current_user.id}, chat_id: {new_chat.id}")  # Debug
        
        return jsonify({
            "success": True,
            "chat_id": new_chat.id,
            "user_id": current_user.id  # 🔥 Return untuk verifikasi
        })
    
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error saving chat: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# 4️⃣ PERBAIKI GET SINGLE CHAT - DOUBLE CHECK USER_ID
@app.route('/api/chat/history/<int:chat_id>', methods=['GET'])
@login_required
def get_single_chat(chat_id):
    """Get a specific chat - must belong to current user"""
    try:
        # 🔥 DOUBLE FILTER: ID + USER_ID
        chat = ChatHistory.query.filter_by(
            id=chat_id,
            user_id=current_user.id  # ⬅️ WAJIB!
        ).first()
        
        if not chat:
            print(f"⚠️ Chat {chat_id} not found for user {current_user.id}")
            return jsonify({"error": "Chat not found or unauthorized"}), 404
        
        return jsonify({
            "id": chat.id,
            "title": chat.title,
            "content": chat.content,
            "image_path": chat.image_path,
            "label": chat.label,
            "created_at": chat.created_at.isoformat() if chat.created_at else None
        })
        
    except Exception as e:
        print(f"❌ Error getting chat: {e}")
        return jsonify({"error": str(e)}), 500
    

# 5️⃣ PERBAIKI DELETE CHAT - PASTIKAN OWNERSHIP
@app.route('/api/chat/history/<int:chat_id>', methods=['DELETE'])
@login_required
def delete_history_item(chat_id):
    """Delete a chat - must belong to current user"""
    try:
        # 🔥 DOUBLE CHECK OWNERSHIP
        chat = ChatHistory.query.filter_by(
            id=chat_id,
            user_id=current_user.id  # ⬅️ SECURITY CHECK!
        ).first()
        
        if not chat:
            return jsonify({
                "success": False,
                "error": "Chat not found or unauthorized"
            }), 404
        
        db.session.delete(chat)
        db.session.commit()
        
        print(f"✅ Chat {chat_id} deleted by user {current_user.id}")
        
        return jsonify({
            "success": True,
            "message": "Chat deleted successfully"
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error deleting chat: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# ====================================
# CHAT ARCHIVE - SAME FIXES
# ====================================

# 6️⃣ GET ARCHIVES - FILTER BY USER
@app.route('/api/chat/archives', methods=['GET'])
@login_required
def get_archives():
    """Get all archived chats for current user ONLY"""
    try:
        if not current_user or not current_user.is_authenticated:
            return jsonify({"error": "Unauthorized"}), 401
        
        # 🔥 FILTER BY USER_ID
        archives = ChatArchive.query.filter_by(
            user_id=current_user.id
        ).order_by(ChatArchive.created_at.desc()).all()
        
        print(f"✅ User {current_user.id} has {len(archives)} archives")
        
        return jsonify([{
            "id": a.id,
            "title": a.title,
            "content": a.content,
            "image_path": a.image_path,
            "label": a.label,
            "created_at": a.created_at.isoformat() if a.created_at else None
        } for a in archives])
        
    except Exception as e:
        print(f"❌ Error getting archives: {e}")
        return jsonify({"error": str(e)}), 500


# 7️⃣ ARCHIVE CHAT - CHECK OWNERSHIP
@app.route('/api/chat/archive/<int:chat_id>', methods=['POST'])
@login_required
def archive_chat(chat_id):
    """Move chat from history to archive - must own the chat"""
    try:
        # 🔥 CHECK OWNERSHIP
        chat = ChatHistory.query.filter_by(
            id=chat_id,
            user_id=current_user.id
        ).first()
        
        if not chat:
            return jsonify({
                "success": False,
                "error": "Chat not found or unauthorized"
            }), 404
        
        # Create archive entry
        new_archive = ChatArchive(
            user_id=current_user.id,  # ⬅️ PAKSA CURRENT USER
            title=chat.title,
            content=chat.content,
            image_path=chat.image_path,
            label=chat.label,
            created_at=datetime.utcnow()
        )
        
        db.session.add(new_archive)
        db.session.delete(chat)
        db.session.commit()
        
        print(f"✅ Chat {chat_id} archived by user {current_user.id}")
        
        return jsonify({
            "success": True,
            "archive_id": new_archive.id,
            "message": "Chat archived successfully"
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error archiving chat: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# 8️⃣ UNARCHIVE - CHECK OWNERSHIP
@app.route('/api/chat/archives/<int:archive_id>/unarchive', methods=['POST'])
@login_required
def unarchive_chat(archive_id):
    """Move chat from archive back to history - must own it"""
    try:
        # 🔥 CHECK OWNERSHIP
        archive = ChatArchive.query.filter_by(
            id=archive_id,
            user_id=current_user.id
        ).first()
        
        if not archive:
            return jsonify({
                "success": False,
                "error": "Archive not found or unauthorized"
            }), 404
        
        # Restore to history
        new_history = ChatHistory(
            user_id=current_user.id,  # ⬅️ PAKSA CURRENT USER
            title=archive.title,
            content=archive.content,
            image_path=archive.image_path,
            label=archive.label,
            created_at=datetime.utcnow()
        )
        
        db.session.add(new_history)
        db.session.delete(archive)
        db.session.commit()
        
        print(f"✅ Archive {archive_id} unarchived by user {current_user.id}")
        
        return jsonify({
            "success": True,
            "history_id": new_history.id,
            "message": "Chat restored to history"
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error unarchiving: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# 9️⃣ DELETE ARCHIVE - CHECK OWNERSHIP
@app.route('/api/chat/archives/<int:archive_id>', methods=['DELETE'])
@login_required
def delete_archive(archive_id):
    """Permanently delete an archived chat - must own it"""
    try:
        # 🔥 CHECK OWNERSHIP
        archive = ChatArchive.query.filter_by(
            id=archive_id,
            user_id=current_user.id
        ).first()
        
        if not archive:
            return jsonify({
                "success": False,
                "error": "Archive not found or unauthorized"
            }), 404
        
        db.session.delete(archive)
        db.session.commit()
        
        print(f"✅ Archive {archive_id} deleted by user {current_user.id}")
        
        return jsonify({
            "success": True,
            "message": "Archive deleted permanently"
        })
        
    except Exception as e:
        db.session.rollback()
        print(f"❌ Error deleting archive: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


# 🔟 UPDATE LOGOUT - CLEAR SESSION PROPERLY
@app.route('/logout')
def user_logout():
    """User logout with proper cleanup"""
    try:
        print(f"🔓 User {current_user.id if current_user.is_authenticated else 'unknown'} logging out")
        
        # Clear ALL session data
        session.clear()
        
        # Logout user
        logout_user()
        
        flash("You have been logged out successfully", "info")
        
    except Exception as e:
        print(f"❌ Logout error: {e}")
    
    return redirect(url_for("index"))



# ====================================
# MIDDLEWARE: VERIFY USER SESSION
# ====================================

@app.before_request
def verify_user_session():
    """Verify user session on every request"""
    
    # Skip untuk static files dan public routes
    if request.endpoint and (
        request.endpoint.startswith('static') or
        request.endpoint in ['index', 'user_login', 'register', 'admin_login']
    ):
        return
    
    # Untuk API endpoints, pastikan user valid
    if request.path.startswith('/api/chat'):
        if not current_user.is_authenticated:
            return jsonify({"error": "Unauthorized - Please login"}), 401
        
        # 🔥 LOG UNTUK DEBUG
        print(f"📍 API Request: {request.path} by user {current_user.id}")




# ====================
# USER DASHBOARD
# ====================

# Tambahkan di dashboard untuk debug
@app.route('/dashboard')
@login_required
def user_dashboard():
    if current_user.role == "admin":
        return redirect(url_for('admin_dashboard'))

    db.session.refresh(current_user)
    
    return render_template(
        "user/dashboard.html", 
        user=current_user,
        timestamp=int(datetime.utcnow().timestamp())  # 🔥 untuk bypass cache
    )



@app.route('/upload', methods=['POST'])
def upload_image():
    pass


# ====================
# UPLOAD FOLDER
# ====================

@app.route('/api/predict', methods=['POST'])
def predict():
    try:
        # 1. Validasi file
        if 'image' not in request.files:
            return jsonify({'error': 'No image file provided'}), 400
        
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Invalid file type. Use JPG, PNG, or WebP'}), 400
        
        # 2. Save file
        filename = secure_filename(file.filename)

        import time
        timestamp = int(time.time() * 1000)
        name, ext = os.path.splitext(filename)
        unique_filename = f"{name}_{timestamp}{ext}"

        filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        os.makedirs(UPLOAD_FOLDER, exist_ok=True)
        file.save(filepath)

        print(f"📁 File saved: {filepath}")
        print(f"📏 File size: {os.path.getsize(filepath)} bytes")

        # 3. Predict
        result = predict_image(filepath)
        
        # 🔍 LOG HASIL PREDIKSI
        print(f"✅ Prediction result:")
        print(f"   Status: {result.get('status')}")
        print(f"   Label: {result.get('label')}")
        print(f"   Confidence: {result.get('confidence')}%")
        print(f"   Top 3: {result.get('predictions', [])}")

        result["filename"] = unique_filename
        return jsonify(result), 200
        
    except Exception as e:
        print(f"❌ Prediction error: {e}")
        traceback.print_exc()
        return jsonify({
            'error': 'Prediction failed',
            'details': str(e),
            'type': type(e).__name__
        }), 500



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

DISEASE_PATH = os.path.join(BASE_DIR, "disease_data.json")

with open(DISEASE_PATH, encoding="utf-8") as f:
    disease_data = json.load(f)

@app.route("/api/chat", methods=["POST"])
@login_required
def chat():
    data = request.json
    user_msg = data.get("message", "").strip()
    mode = data.get("mode", "short")
    
    if not user_msg:
        return jsonify({"reply": "Pesan tidak boleh kosong"}), 400
    
    # Ekstrak label dan confidence dari message
    label = None
    confidence = 0
    
    # Parse message untuk mendapatkan label dan confidence
    if "Tanaman:" in user_msg and "Akurasi:" in user_msg:
        lines = user_msg.split('\n')
        for line in lines:
            if "Tanaman:" in line:
                label = line.split("Tanaman:")[1].strip()
            elif "Akurasi:" in line:
                conf_str = line.split("Akurasi:")[1].strip().replace('%', '')
                try:
                    confidence = float(conf_str)
                except:
                    confidence = 0
    
    # ✅ PERBAIKAN: Cek apakah label ada di database
    if label and label in disease_data:
        disease = disease_data[label]
        overview = disease.get("overview", {})
    else:
        disease = None
        overview = {}
    
    # ✅ KONDISI RAGU - TETAP TAMPILKAN DESKRIPSI
    if confidence < 40:
        # Jika ada data tanaman, tampilkan dengan warning
        if disease:
            reply = (
                f"⚠️ **Kemungkinan: {label}**\n\n"
                f"📊 Tingkat keyakinan: {confidence}% (masih rendah)\n\n"
                f"📝 **Deskripsi:**\n{overview.get('short', 'Informasi tidak tersedia')}\n\n"
            )
            
            # Tambahkan manfaat jika ada
            treatment = disease.get("treatment", [])
            if treatment and len(treatment) > 0:
                reply += f"💊 **Manfaat {label}:**\n"
                for t in treatment[:3]:  # Tampilkan max 3 item
                    reply += f"• {t}\n"
                reply += "\n"

            prevention = disease.get("prevention", [])
            if prevention and len(prevention) > 0:
                reply += f"🧪 **Kandungan {label}:**\n"
                for t in prevention[:3]:  # Tampilkan max 3 item
                    reply += f"• {t}\n"
                reply += "\n"

            benefits = disease.get("benefits", [])
            if benefits and len(benefits) > 0:
                reply += f"🌱 **Fungsi {label}:**\n"
                for t in benefits[:3]:  # Tampilkan max 3 item
                    reply += f"• {t}\n"
                reply += "\n"

            form = disease.get("form", [])
            if form and len(form) > 0:
                reply += f"🌍 **Asal {label}:**\n"
                for t in form[:3]:  # Tampilkan max 3 item
                    reply += f"• {t}\n"
                reply += "\n"
            
            reply += (
                "⚠️ **Catatan Penting:**\n"
                "Hasil ini masih perlu dikonfirmasi karena tingkat keyakinan rendah.\n\n"
                "💡 **Saran agar lebih akurat:**\n"
                "• Ambil foto lebih dekat dengan daun\n"
                "• Gunakan pencahayaan yang cukup\n"
                "• Pastikan fokus ke daun utama\n"
                "• Gunakan latar belakang polos\n\n"
                "🔁 Silakan coba unggah ulang gambar dengan kualitas lebih baik."
            )
        else:
            # Jika tidak ada data tanaman
            reply = (
                "⚠️ **Tanaman belum dapat dikenali dengan yakin.**\n\n"
                f"📊 Tingkat keyakinan sistem saat ini masih rendah ({confidence}%). "
                "Hal ini bisa disebabkan oleh:\n"
                "• Pencahayaan foto kurang jelas\n"
                "• Daun terpotong atau tidak fokus\n"
                "• Sudut pengambilan gambar kurang tepat\n"
                "• Tanaman memiliki kemiripan dengan jenis lain\n\n"
                "💡 **Saran agar hasil lebih akurat:**\n"
                "• Ambil foto daun secara dekat dan jelas\n"
                "• Gunakan latar belakang polos\n"
                "• Pastikan daun utuh dan tidak tertutup\n"
                "• Gunakan cahaya alami\n\n"
                "🔁 Silakan coba unggah ulang gambar dengan kualitas lebih baik."
            )
        
        return jsonify({"reply": reply}), 200
    
    # ✅ CONFIDENCE >= 40% - Tampilkan Full
    if not disease:
        return jsonify({"reply": "Data tanaman tidak ditemukan"}), 404
    
    # Mode SHORT - hanya deskripsi singkat (untuk index.html)
    if mode == "short":
        reply = f"**Hasil Analisis Tanaman**\n\n{overview.get('short', '')}"
        return jsonify({"reply": reply.strip()})
    
    # Mode FULL - tampilkan semua detail (untuk dashboard)
    reply = f"**📋 Hasil Analisis: {label}**\n\n"
    
    # 1. DESKRIPSI
    reply += "**📖 Deskripsi:**\n"
    reply += f"{overview.get('full', overview.get('short', 'Tidak ada deskripsi'))}\n\n"
    
    # 2. MANFAAT
    treatment = disease.get("treatment", [])
    if treatment:
        reply += f"**💊 Manfaat {label}:**\n"
        for t in treatment:
            reply += f"• {t}\n"
        reply += "\n"
    
    # 3. KANDUNGAN
    prevention = disease.get("prevention", [])
    if prevention:
        reply += f"**🧪 Kandungan {label}:**\n"
        for p in prevention:
            reply += f"• {p}\n"
        reply += "\n"
    
    # 4. FUNGSI
    benefits = disease.get("benefits", [])
    if benefits:
        reply += f"**🌱 Fungsi {label}:**\n"
        for b in benefits:
            reply += f"• {b}\n"
        reply += "\n"
    
    # 5. ASAL TANAMAN
    forms = disease.get("form", [])
    if forms:
        reply += f"**🌍 Asal Tanaman {label}:**\n"
        for f in forms:
            reply += f"• {f}\n"
        reply += "\n"

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

@app.route("/admin/api/users")
@login_required
def get_users():
    """Get all users for admin dashboard"""
    if current_user.role != "admin":
        return jsonify({"error": "Unauthorized"}), 403
    
    users = User.query.all()
    
    return jsonify([{
        "id": u.id,
        "username": u.username,
        "email": u.email,
        "role": u.role,
        "is_active": u.is_active,
        "last_active": u.last_active.strftime("%Y-%m-%d %H:%M") if u.last_active else "-",
        "created_at": u.created_at.strftime("%Y-%m-%d") if hasattr(u, 'created_at') else "-"
    } for u in users])



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



# ✅ Route untuk update profile
@app.route("/api/user/profile", methods=["POST"])
@login_required
def update_profile():
    try:
        username = request.form.get("username")
        avatar = request.files.get("avatar")

        db.session.refresh(current_user)

        # Update username
        if username and username.strip():
            existing = User.query.filter(
                User.username == username.strip(),
                User.id != current_user.id
            ).first()
            
            if existing:
                return jsonify({
                    "success": False, 
                    "error": "Username sudah digunakan"
                }), 400

            current_user.username = username.strip()

        # Update avatar
        if avatar and allowed_file(avatar.filename):
            # Tentukan folder uploads/avatar
            avatar_folder = os.path.join(app.config["UPLOAD_FOLDER"], "avatar")
            
            # Buat folder jika belum ada
            os.makedirs(avatar_folder, exist_ok=True)

            # Hapus foto lama jika ada
            if current_user.photo_url and current_user.photo_url != "/static/avatar/default-avatar.png":
                old_filename = current_user.photo_url.split("/")[-1]
                old_path = os.path.join(avatar_folder, old_filename)
                if os.path.exists(old_path):
                    try:
                        os.remove(old_path)
                    except Exception as e:
                        print(f"❌ Failed to delete old photo: {e}")

            # Simpan foto baru ke static/uploads/avatar
            filename = f"user_{current_user.id}_{int(datetime.utcnow().timestamp())}_{secure_filename(avatar.filename)}"
            path = os.path.join(avatar_folder, filename)
            avatar.save(path)
            current_user.photo_url = f"/static/uploads/avatar/{filename}"

        db.session.commit()
        db.session.refresh(current_user)

        return jsonify({
            "success": True,
            "username": current_user.username,
            "photo_url": current_user.photo_url or "/static/avatar/default-avatar.png"
        })

    except Exception as e:
        db.session.rollback()
        print(f"❌ Update profile error: {e}")
        return jsonify({
            "success": False, 
            "error": str(e)
        }), 500

@app.route("/api/user/profile", methods=["GET"])
@login_required
def get_profile():
    """Get current user profile"""
    return jsonify({
        "username": current_user.username,
        "email": current_user.email,
        "photo_url": current_user.photo_url,
        "role": current_user.role
    })



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




        
# 5️⃣ Get stats
@app.route('/api/chat/stats', methods=['GET'])
@login_required
def get_chat_stats():
    """Get statistics about user's chats"""
    try:
        history_count = ChatHistory.query.filter_by(
            user_id=current_user.id
        ).count()
        
        archive_count = ChatArchive.query.filter_by(
            user_id=current_user.id
        ).count()
        
        return jsonify({
            "history_count": history_count,
            "archive_count": archive_count,
            "total": history_count + archive_count
        })
        
    except Exception as e:
        print(f"❌ Error getting stats: {e}")
        return jsonify({"error": str(e)}), 500
    

# ====================
# MAIN
# ====================
# ====================
# MAIN
# ====================
if __name__ == '__main__':
    # Gunakan PORT dari environment Railway, default 5000 jika di lokal
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)


    


