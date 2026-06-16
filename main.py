# CA Portal v3.1
from fastapi import FastAPI, HTTPException, Depends, Header, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import os, json, io, httpx, jwt, bcrypt, psycopg2, psycopg2.extras, random, string, base64
from datetime import datetime, timedelta

app = FastAPI()
ALLOWED_ORIGINS = [
    "https://savills-ca-portal.vercel.app",
    "https://savills-ca-portal-git-main-ahmed-hamed-s-projects.vercel.app",
    "http://localhost:5173",  # local dev
]
app.add_middleware(CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"])

SECRET_KEY = os.getenv("SECRET_KEY", "savills-ca-portal-2026")
DATABASE_URL = os.getenv("DATABASE_URL", "")
AZURE_TENANT_ID = os.getenv("AZURE_TENANT_ID", "6330831d-7629-4e63-8850-6be5d7c5aeef")
AZURE_CLIENT_ID = os.getenv("AZURE_CLIENT_ID", "b567dafc-5c6e-4161-ad01-0dd25dd90363")
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET", "")
PBI_WORKSPACE_ID = os.getenv("PBI_WORKSPACE_ID", "a889dfd6-b0ce-49dd-b41d-c79de2dfd0b5")
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
PORTAL_URL = os.getenv("PORTAL_URL", "https://savills-ca-portal.vercel.app")

def get_db():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

def safe_exec(c, conn, sql, params=None):
    try:
        c.execute("SAVEPOINT sp")
        if params:
            c.execute(sql, params)
        else:
            c.execute(sql)
        c.execute("RELEASE SAVEPOINT sp")
    except Exception as e:
        c.execute("ROLLBACK TO SAVEPOINT sp")
        print(f"[init_db] skipped: {str(e)[:120]}")

def init_db():
    conn = get_db(); c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS ca_users (
        id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, full_name TEXT NOT NULL,
        email TEXT DEFAULT '', title TEXT DEFAULT '', hashed_password TEXT NOT NULL,
        role TEXT DEFAULT 'viewer', is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY, name TEXT UNIQUE NOT NULL, location TEXT DEFAULT '',
        system TEXT DEFAULT '', logo_url TEXT DEFAULT '', is_active BOOLEAN DEFAULT TRUE,
        landlord_name TEXT DEFAULT ''
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS user_property_access (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES ca_users(id) ON DELETE CASCADE,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        UNIQUE(user_id, property_id)
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS collection_logs (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id),
        month TEXT NOT NULL,
        total_invoices NUMERIC DEFAULT 0,
        total_revenue_share NUMERIC DEFAULT 0,
        total_collection NUMERIC DEFAULT 0,
        notes TEXT DEFAULT '',
        created_by INTEGER NOT NULL REFERENCES ca_users(id),
        updated_by INTEGER REFERENCES ca_users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY, subject TEXT NOT NULL, recipients TEXT NOT NULL,
        property_names TEXT NOT NULL, month TEXT NOT NULL, status TEXT DEFAULT 'sent',
        sent_by INTEGER NOT NULL REFERENCES ca_users(id), sent_at TIMESTAMP DEFAULT NOW()
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS pbi_reports (
        id SERIAL PRIMARY KEY, property_id INTEGER REFERENCES properties(id),
        report_name TEXT NOT NULL, report_type TEXT NOT NULL,
        category TEXT DEFAULT '',
        pbi_report_id TEXT DEFAULT '', pbi_workspace_id TEXT DEFAULT '',
        embed_url TEXT DEFAULT '', is_active BOOLEAN DEFAULT TRUE
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS rent_roll_uploads (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id),
        sub_location TEXT DEFAULT '',
        filename TEXT NOT NULL,
        uploaded_by INTEGER NOT NULL REFERENCES ca_users(id),
        upload_date TIMESTAMP DEFAULT NOW(),
        report_date TEXT NOT NULL,
        active_leases INTEGER DEFAULT 0,
        unique_tenants INTEGER DEFAULT 0,
        total_gla NUMERIC DEFAULT 0,
        annualized_rent NUMERIC DEFAULT 0,
        monthly_rent NUMERIC DEFAULT 0,
        monthly_sc NUMERIC DEFAULT 0,
        expiry_0_1yr INTEGER DEFAULT 0,
        expiry_1_2yr INTEGER DEFAULT 0,
        expiry_2_3yr INTEGER DEFAULT 0,
        expiry_3plus INTEGER DEFAULT 0
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS rent_roll_leases (
        id SERIAL PRIMARY KEY,
        upload_id INTEGER NOT NULL REFERENCES rent_roll_uploads(id) ON DELETE CASCADE,
        property_id INTEGER NOT NULL REFERENCES properties(id),
        document_no TEXT DEFAULT '',
        document_type TEXT DEFAULT '',
        tenant_number TEXT DEFAULT '',
        tenant_brand TEXT DEFAULT '',
        tenant_legal TEXT DEFAULT '',
        unit_code TEXT DEFAULT '',
        unit_type TEXT DEFAULT '',
        floor TEXT DEFAULT '',
        gla NUMERIC DEFAULT 0,
        lease_start DATE,
        lease_end DATE,
        remaining_years NUMERIC DEFAULT 0,
        remaining_months NUMERIC DEFAULT 0,
        annualized_rent NUMERIC DEFAULT 0,
        annualized_sc NUMERIC DEFAULT 0,
        monthly_rent NUMERIC DEFAULT 0,
        rent_per_sqm NUMERIC DEFAULT 0,
        sc_per_sqm NUMERIC DEFAULT 0,
        escalation_rate NUMERIC DEFAULT 0,
        revenue_sharing_rate NUMERIC DEFAULT 0,
        security_deposit NUMERIC DEFAULT 0
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS rent_roll_monthly (
        id SERIAL PRIMARY KEY,
        lease_id INTEGER NOT NULL REFERENCES rent_roll_leases(id) ON DELETE CASCADE,
        upload_id INTEGER NOT NULL REFERENCES rent_roll_uploads(id) ON DELETE CASCADE,
        property_id INTEGER NOT NULL REFERENCES properties(id),
        month TEXT NOT NULL,
        rent NUMERIC DEFAULT 0,
        sc NUMERIC DEFAULT 0
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS invoice_uploads (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id),
        sub_location TEXT DEFAULT '',
        filename TEXT NOT NULL,
        uploaded_by INTEGER NOT NULL REFERENCES ca_users(id),
        upload_date TIMESTAMP DEFAULT NOW(),
        report_month TEXT NOT NULL,
        total_lines INTEGER DEFAULT 0,
        invoiced_count INTEGER DEFAULT 0,
        not_invoiced_count INTEGER DEFAULT 0,
        invoiced_amount NUMERIC DEFAULT 0,
        not_invoiced_amount NUMERIC DEFAULT 0
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS invoice_lines (
        id SERIAL PRIMARY KEY,
        upload_id INTEGER NOT NULL REFERENCES invoice_uploads(id) ON DELETE CASCADE,
        property_id INTEGER NOT NULL REFERENCES properties(id),
        sub_location TEXT DEFAULT '',
        report_month TEXT NOT NULL,
        document_no TEXT DEFAULT '',
        unit TEXT DEFAULT '',
        unit_type TEXT DEFAULT '',
        customer_name TEXT DEFAULT '',
        brand TEXT DEFAULT '',
        element_group TEXT DEFAULT '',
        ps_due_date DATE,
        ps_amount NUMERIC DEFAULT 0,
        ps_paid_amount NUMERIC DEFAULT 0,
        ps_invoiced_flag TEXT DEFAULT 'N',
        ps_revenue_amount NUMERIC DEFAULT 0,
        invoice_no TEXT DEFAULT '',
        lease_start DATE,
        lease_end DATE,
        document_status TEXT DEFAULT ''
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS recon_comments (
        id SERIAL PRIMARY KEY,
        line_id INTEGER NOT NULL REFERENCES invoice_lines(id) ON DELETE CASCADE,
        property_id INTEGER NOT NULL REFERENCES properties(id),
        report_month TEXT NOT NULL,
        reason TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        status TEXT DEFAULT 'open',
        created_by INTEGER NOT NULL REFERENCES ca_users(id),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS sop_documents (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        version TEXT DEFAULT '',
        description TEXT DEFAULT '',
        file_data TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        uploaded_by INTEGER NOT NULL REFERENCES ca_users(id),
        upload_date TIMESTAMP DEFAULT NOW(),
        is_active BOOLEAN DEFAULT TRUE
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS portal_guide (
        id SERIAL PRIMARY KEY,
        section TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        order_index INTEGER DEFAULT 0,
        created_by INTEGER NOT NULL REFERENCES ca_users(id),
        updated_by INTEGER REFERENCES ca_users(id),
        updated_at TIMESTAMP DEFAULT NOW()
    )""")
    safe_exec(c, conn, "ALTER TABLE portal_guide ADD CONSTRAINT IF NOT EXISTS portal_guide_section_unique UNIQUE (section)")

    c.execute("""CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        brand_name TEXT NOT NULL,
        legal_name TEXT DEFAULT '',
        unit_code TEXT DEFAULT '',
        unit_type TEXT DEFAULT '',
        location TEXT DEFAULT '',
        lease_type TEXT DEFAULT '',
        property_id INTEGER REFERENCES properties(id),
        sub_location TEXT DEFAULT '',
        bank_account TEXT DEFAULT '',
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        notes TEXT DEFAULT '',
        source TEXT DEFAULT 'manual',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(brand_name, unit_code)
    )""")

    c.execute("""CREATE TABLE IF NOT EXISTS edit_requests (
        id SERIAL PRIMARY KEY,
        requested_by INTEGER NOT NULL REFERENCES ca_users(id),
        property_id INTEGER NOT NULL REFERENCES properties(id),
        log_id INTEGER REFERENCES collection_logs(id),
        month TEXT NOT NULL,
        field_changes JSONB NOT NULL,
        reason TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',
        reviewed_by INTEGER REFERENCES ca_users(id),
        review_note TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW(),
        reviewed_at TIMESTAMP
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS activity_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES ca_users(id),
        action TEXT NOT NULL,
        entity_type TEXT DEFAULT '',
        entity_name TEXT DEFAULT '',
        details TEXT DEFAULT '',
        created_at TIMESTAMP DEFAULT NOW()
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS app_settings (
        id SERIAL PRIMARY KEY,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TIMESTAMP DEFAULT NOW()
    )""")
    conn.commit()

    safe_exec(c, conn, "ALTER TABLE properties ADD COLUMN IF NOT EXISTS logo_url TEXT DEFAULT ''")
    safe_exec(c, conn, "ALTER TABLE properties ADD COLUMN IF NOT EXISTS landlord_name TEXT DEFAULT ''")
    safe_exec(c, conn, "ALTER TABLE pbi_reports ADD COLUMN IF NOT EXISTS embed_url TEXT DEFAULT ''")
    safe_exec(c, conn, "ALTER TABLE pbi_reports ADD COLUMN IF NOT EXISTS category TEXT DEFAULT ''")
    safe_exec(c, conn, "ALTER TABLE collection_logs ADD COLUMN IF NOT EXISTS total_revenue_share NUMERIC DEFAULT 0")
    safe_exec(c, conn, "ALTER TABLE collection_logs ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES ca_users(id)")
    safe_exec(c, conn, "ALTER TABLE collection_logs ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW()")
    safe_exec(c, conn, "ALTER TABLE collection_logs ADD CONSTRAINT collection_logs_property_month UNIQUE (property_id, month)")
    safe_exec(c, conn, "DELETE FROM properties WHERE id NOT IN (SELECT MIN(id) FROM properties GROUP BY name)")
    safe_exec(c, conn, "ALTER TABLE rent_roll_uploads ADD COLUMN IF NOT EXISTS sub_location TEXT DEFAULT ''")
    safe_exec(c, conn, "ALTER TABLE rent_roll_leases ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT ''")
    safe_exec(c, conn, "ALTER TABLE rent_roll_leases ADD COLUMN IF NOT EXISTS tenant_number TEXT DEFAULT ''")
    safe_exec(c, conn, """CREATE INDEX IF NOT EXISTS idx_rrm_lease_month ON rent_roll_monthly(lease_id, month)""")
    safe_exec(c, conn, """CREATE INDEX IF NOT EXISTS idx_rrm_upload_month ON rent_roll_monthly(upload_id, month)""")
    safe_exec(c, conn, "ALTER TABLE invoice_uploads ADD COLUMN IF NOT EXISTS report_month TEXT DEFAULT ''")
    safe_exec(c, conn, """CREATE TABLE IF NOT EXISTS otp_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES ca_users(id) ON DELETE CASCADE,
        otp_code TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        used BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW()
    )""")
    safe_exec(c, conn, "ALTER TABLE customers ADD COLUMN IF NOT EXISTS tenant_number TEXT DEFAULT ''")
    # Seed default How to use guide
    default_guide = [
        ("getting-started", "Getting Started", "Welcome to the Savills Egypt CA Portal. This guide will help you navigate and use the portal effectively.", 1),
        ("collection", "Collection Module", "The Collection module allows you to view and track rent collection data across all properties. Use the filters to narrow down by property and month.", 2),
        ("rent-roll", "Rent Roll", "The Rent Roll section shows all active leases. You can filter by property, sub-location, unit type, and expiry date. Click any lease to view its full details including the payment schedule.", 3),
        ("invoice-recon", "Invoice Reconciliation", "Upload the Oracle Lease Summary Report to reconcile invoiced vs not-invoiced leases for any month. Use the status filter to focus on not-invoiced items and add comments with reasons.", 4),
        ("reports", "Reports", "Access Power BI reports embedded directly in the portal. Click any report card to open the full dashboard.", 5),
        ("kpis", "KPI Dashboard", "The KPI Dashboard shows a summary of collection performance and rent roll metrics for all properties. Use the property selector to filter by property.", 6),
    ]
    for section, title, content, order in default_guide:
        safe_exec(c, conn, """INSERT INTO portal_guide (section, title, content, order_index, created_by)
            VALUES (%s,%s,%s,%s,1) ON CONFLICT (section) DO NOTHING""",
            (section, title, content, order))
    safe_exec(c, conn, "ALTER TABLE customers ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT ''")
    safe_exec(c, conn, "ALTER TABLE customers ADD COLUMN IF NOT EXISTS document_no TEXT DEFAULT ''")
    conn.commit()

    default_settings = [
        ("app_name", "Savills Egypt CA"),
        ("logo_url", "https://savills-ca-portal.vercel.app/savills-logo.svg"),
        ("primary_color", "#0077C5"),
        ("accent_color", "#FEDE07"),
        ("font_family", "Inter"),
        ("email_sender_name", "Savills Egypt — Client Accounting"),
        ("email_sender_email", "ahmed.hamed@savills.me"),
        ("portal_tagline", "Client Accounting · Property Management"),
    ]
    for key, value in default_settings:
        safe_exec(c, conn, "INSERT INTO app_settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO NOTHING", (key, value))
    conn.commit()

    try:
        hashed = bcrypt.hashpw("123456".encode(), bcrypt.gensalt()).decode()
        c.execute("""INSERT INTO ca_users (username,full_name,email,title,hashed_password,role)
                     VALUES ('ahmed.hamed','Ahmed Hamed','ahmed.hamed@savills.me',
                     'Associate Director - Property Finance',%s,'admin')
                     ON CONFLICT (username) DO NOTHING""", (hashed,))
        for name, loc, sys in [("Arkan","Sheikh Zayed","Oracle"),("Royal Park","New Cairo","Yardi"),
                                ("Majarrah","New Cairo","Yardi"),("205","Downtown","Oracle")]:
            c.execute("INSERT INTO properties (name,location,system) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING", (name, loc, sys))
        conn.commit()
    except Exception as e:
        conn.rollback()
        print(f"[init_db] seed skipped: {e}")

    conn.close()
    print("✅ CA Portal DB v3 initialized")

@app.on_event("startup")
def startup(): init_db()

@app.get("/health")
def health(): return {"ok": True}

def hash_password(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()

def generate_otp():
    return ''.join(random.choices(string.digits, k=6))

def send_otp_email(to_email: str, to_name: str, otp: str) -> bool:
    if not SENDGRID_API_KEY: return False
    try:
        html = (
            "<!DOCTYPE html><html><body style='font-family:-apple-system,sans-serif;background:#F4F5F7;padding:32px'>"
            "<div style='max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px;border:1px solid #E3E8EF'>"
            "<div style='height:4px;background:#FEDE07;border-radius:2px;margin-bottom:24px'></div>"
            "<div style='font-size:18px;font-weight:700;color:#1C1C1C;margin-bottom:8px'>Login Verification</div>"
            f"<div style='font-size:14px;color:#57647A;margin-bottom:24px'>Hi {to_name}, use the code below to sign in to Savills Egypt CA Portal.</div>"
            "<div style='text-align:center;padding:20px;background:#F8F9FA;border-radius:8px;border:1px solid #E3E8EF;margin-bottom:20px'>"
            f"<div style='font-size:36px;font-weight:700;letter-spacing:8px;color:#0077C5'>{otp}</div>"
            "<div style='font-size:12px;color:#8C96A3;margin-top:8px'>Valid for 10 minutes</div>"
            "</div>"
            "<div style='font-size:12px;color:#8C96A3'>If you did not request this, please ignore this email.</div>"
            "<div style='margin-top:20px;padding-top:16px;border-top:1px solid #F4F5F7;font-size:11px;color:#C4CBD6'>Savills Egypt · Client Accounting · Property Management</div>"
            "</div></body></html>"
        )
        payload = {
            "personalizations": [{"to": [{"email": to_email, "name": to_name}]}],
            "from": {"email": "ahmed.hamed@savills.me", "name": "Savills Egypt — CA Portal"},
            "subject": f"Your login code: {otp}",
            "content": [{"type": "text/html", "value": html}]
        }
        resp = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {SENDGRID_API_KEY}", "Content-Type": "application/json"},
            json=payload,
            timeout=10
        )
        if resp.status_code == 202:
            return True
        print(f"SendGrid error {resp.status_code}: {resp.text}")
        return False
    except Exception as e:
        print(f"OTP email error: {e}"); return False
def verify_password(p, h): return bcrypt.checkpw(p.encode(), h.encode())
def create_token(data): return jwt.encode({**data, "exp": datetime.utcnow()+timedelta(days=7)}, SECRET_KEY, algorithm="HS256")

def get_current_user(authorization: str = Header(default="")):
    try:
        token = authorization.replace("Bearer ", "")
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        conn = get_db(); c = conn.cursor()
        c.execute("SELECT * FROM ca_users WHERE id=%s AND is_active=TRUE", (payload["id"],))
        user = c.fetchone(); conn.close()
        if not user: raise HTTPException(401)
        return dict(user)
    except: raise HTTPException(401, "Unauthorized")

def require_admin(user=Depends(get_current_user)):
    if user["role"] != "admin": raise HTTPException(403, "Admin only")
    return user

def require_editor(user=Depends(get_current_user)):
    if user["role"] not in ("admin", "editor"): raise HTTPException(403, "Editor+ required")
    return user

def log_activity(conn, user_id: int, action: str, entity_type: str = "", entity_name: str = "", details: str = ""):
    try:
        c = conn.cursor()
        c.execute("INSERT INTO activity_logs (user_id, action, entity_type, entity_name, details) VALUES (%s,%s,%s,%s,%s)",
                  (user_id, action, entity_type, entity_name, details))
    except Exception as e:
        print(f"Activity log error: {e}")

def fmt_short(n):
    try:
        v = float(n)
        if v >= 1_000_000: m = v/1_000_000; return (f"{m:.1f}".rstrip('0').rstrip('.'))+"M"
        if v >= 1_000: k = v/1_000; return (f"{k:.1f}".rstrip('0').rstrip('.'))+"K"
        return f"{v:,.0f}"
    except: return str(n)

def fmt_num(n):
    try: return f"{float(n):,.2f}"
    except: return str(n)

class LoginData(BaseModel): username: str; password: str
class UserCreate(BaseModel):
    username: str; full_name: str; email: str = ""; title: str = ""; password: str; role: str = "viewer"
class UserUpdate(BaseModel):
    full_name: Optional[str]=None; email: Optional[str]=None; title: Optional[str]=None
    role: Optional[str]=None; password: Optional[str]=None; is_active: Optional[bool]=None
class PropertyCreate(BaseModel):
    name: str; location: str=""; system: str=""; logo_url: str=""; landlord_name: str=""
class CollectionLogCreate(BaseModel):
    property_id: int; month: str; total_invoices: float=0; total_revenue_share: float=0; total_collection: float=0; notes: str=""
class CollectionLogUpdate(BaseModel):
    total_invoices: Optional[float]=None; total_revenue_share: Optional[float]=None
    total_collection: Optional[float]=None; notes: Optional[str]=None
class CollectionEmailSend(BaseModel):
    property_ids: list; month: str; collections: dict; recipient_user_ids: list; notes: str=""
class ReportCreate(BaseModel):
    property_id: int; report_name: str; report_type: str; category: str=""; embed_url: str=""
    pbi_report_id: str=""; pbi_workspace_id: str=""
class ReportUpdate(BaseModel):
    report_name: Optional[str]=None; report_type: Optional[str]=None
    category: Optional[str]=None; embed_url: Optional[str]=None; pbi_report_id: Optional[str]=None

@app.post("/auth/login")
def login(data: LoginData):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM ca_users WHERE username=%s AND is_active=TRUE", (data.username,))
    user = c.fetchone()
    if not user or not verify_password(data.password, user["hashed_password"]):
        conn.close(); raise HTTPException(401, "Invalid credentials")

    # Check if user has email for OTP
    if user.get("email"):
        # Generate OTP
        otp = generate_otp()
        expires = datetime.utcnow() + timedelta(minutes=10)
        # Clean old OTPs for this user
        c.execute("DELETE FROM otp_sessions WHERE user_id=%s", (user["id"],))
        c.execute("INSERT INTO otp_sessions (user_id, otp_code, expires_at) VALUES (%s,%s,%s)",
                  (user["id"], otp, expires))
        conn.commit()
        # Send OTP email
        sent = send_otp_email(user["email"], user["full_name"], otp)
        conn.close()
        resp = {"otp_required": True, "user_id": user["id"],
                "message": f"OTP sent to {user['email'][:3]}***@{user['email'].split('@')[1]}"}
        # If SendGrid not configured, return OTP directly for testing
        if not sent:
            resp["dev_otp"] = otp
            resp["message"] = "Email not configured — use dev_otp field"
        return resp

    # No email — direct login (fallback)
    log_activity(conn, user["id"], "login", "auth", user["username"])
    conn.commit(); conn.close()
    token = create_token({"id": user["id"], "username": user["username"], "role": user["role"]})
    return {"token": token, "user": {k: v for k, v in dict(user).items() if k != "hashed_password"}}

@app.post("/auth/verify-otp")
def verify_otp(data: dict):
    user_id = data.get("user_id")
    otp_code = data.get("otp_code","").strip()
    conn = get_db(); c = conn.cursor()

    c.execute("""SELECT * FROM otp_sessions
                 WHERE user_id=%s AND used=FALSE AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1""", (user_id,))
    session = c.fetchone()

    if not session or session["otp_code"] != otp_code:
        conn.close(); raise HTTPException(401, "Invalid or expired OTP")

    # Mark OTP as used
    c.execute("UPDATE otp_sessions SET used=TRUE WHERE id=%s", (session["id"],))

    # Get user
    c.execute("SELECT * FROM ca_users WHERE id=%s AND is_active=TRUE", (user_id,))
    user = c.fetchone()
    if not user: conn.close(); raise HTTPException(401, "User not found")

    log_activity(conn, user["id"], "login", "auth", user["username"])
    conn.commit(); conn.close()
    token = create_token({"id": user["id"], "username": user["username"], "role": user["role"]})
    return {"token": token, "user": {k: v for k, v in dict(user).items() if k != "hashed_password"}}

@app.get("/auth/me")
def me(current_user=Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k != "hashed_password"}

@app.post("/auth/change-password")
def change_password(data: dict, current_user=Depends(get_current_user)):
    if not verify_password(data["current_password"], current_user["hashed_password"]):
        raise HTTPException(400, "Current password incorrect")
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE ca_users SET hashed_password=%s WHERE id=%s", (hash_password(data["new_password"]), current_user["id"]))
    log_activity(conn, current_user["id"], "changed password", "auth", current_user["username"])
    conn.commit(); conn.close()
    return {"ok": True}

@app.patch("/auth/profile")
def update_profile(data: dict, current_user=Depends(get_current_user)):
    allowed = {k: v for k, v in data.items() if k in ("full_name","email","title")}
    if not allowed: raise HTTPException(400, "Nothing to update")
    conn = get_db(); c = conn.cursor()
    set_clause = ", ".join(f"{k}=%s" for k in allowed)
    c.execute(f"UPDATE ca_users SET {set_clause} WHERE id=%s", (*allowed.values(), current_user["id"]))
    log_activity(conn, current_user["id"], "updated profile", "auth", current_user["username"])
    conn.commit(); conn.close()
    return {"ok": True}

@app.get("/users")
def list_users(admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id,username,full_name,email,title,role,is_active,created_at FROM ca_users ORDER BY id")
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.post("/users", status_code=201)
def create_user(data: UserCreate, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    try:
        c.execute("INSERT INTO ca_users (username,full_name,email,title,hashed_password,role) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                  (data.username, data.full_name, data.email, data.title, hash_password(data.password), data.role))
        new_id = c.fetchone()["id"]
        log_activity(conn, admin["id"], "created user", "user", data.username, f"role={data.role}")
        conn.commit(); conn.close(); return {"id": new_id}
    except: raise HTTPException(400, "Username already exists")

@app.patch("/users/{user_id}")
def update_user(user_id: int, data: UserUpdate, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    fields = {k: v for k, v in data.dict().items() if v is not None}
    if "password" in fields: fields["hashed_password"] = hash_password(fields.pop("password"))
    if not fields: raise HTTPException(400, "Nothing to update")
    set_clause = ", ".join(f"{k}=%s" for k in fields)
    c.execute(f"UPDATE ca_users SET {set_clause} WHERE id=%s", (*fields.values(), user_id))
    c.execute("SELECT username FROM ca_users WHERE id=%s", (user_id,))
    row = c.fetchone()
    log_activity(conn, admin["id"], "updated user", "user", row["username"] if row else str(user_id),
                 ", ".join(f"{k}={v}" for k,v in fields.items() if k!="hashed_password"))
    conn.commit(); conn.close(); return {"ok": True}

@app.get("/properties")
def list_properties(current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM properties WHERE is_active=TRUE ORDER BY id")
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.post("/properties", status_code=201)
def create_property(data: PropertyCreate, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("INSERT INTO properties (name,location,system,logo_url,landlord_name) VALUES (%s,%s,%s,%s,%s) RETURNING id",
              (data.name, data.location, data.system, data.logo_url, data.landlord_name))
    new_id = c.fetchone()["id"]
    log_activity(conn, admin["id"], "added property", "property", data.name)
    conn.commit(); conn.close(); return {"id": new_id}

@app.patch("/properties/{prop_id}")
def update_property(prop_id: int, data: dict, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    allowed = {k: v for k, v in data.items() if k in ("name","location","system","logo_url","landlord_name","is_active")}
    if not allowed: raise HTTPException(400, "Nothing to update")
    set_clause = ", ".join(f"{k}=%s" for k in allowed)
    c.execute(f"UPDATE properties SET {set_clause} WHERE id=%s", (*allowed.values(), prop_id))
    c.execute("SELECT name FROM properties WHERE id=%s", (prop_id,))
    row = c.fetchone()
    action = "archived property" if allowed.get("is_active")==False else "restored property" if allowed.get("is_active")==True else "updated property"
    log_activity(conn, admin["id"], action, "property", row["name"] if row else str(prop_id))
    conn.commit(); conn.close(); return {"ok": True}

@app.delete("/properties/{prop_id}")
def delete_property(prop_id: int, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT name FROM properties WHERE id=%s", (prop_id,))
    row = c.fetchone()
    c.execute("DELETE FROM properties WHERE id=%s", (prop_id,))
    log_activity(conn, admin["id"], "deleted property", "property", row["name"] if row else str(prop_id))
    conn.commit(); conn.close(); return {"ok": True}

@app.get("/properties/archived")
def list_archived(admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM properties WHERE is_active=FALSE ORDER BY id")
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.get("/properties/{prop_id}/summary")
def property_summary(prop_id: int, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT month, total_invoices, total_collection, total_revenue_share FROM collection_logs WHERE property_id=%s ORDER BY month DESC LIMIT 3", (prop_id,))
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.get("/user-access")
def get_all_access(admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT user_id, array_agg(property_id) as property_ids FROM user_property_access GROUP BY user_id")
    rows = c.fetchall(); conn.close()
    return {row["user_id"]: row["property_ids"] for row in rows}

@app.get("/user-access/me")
def get_my_access(current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT property_id FROM user_property_access WHERE user_id=%s", (current_user["id"],))
    rows = [r["property_id"] for r in c.fetchall()]; conn.close()
    return {"property_ids": rows}

@app.post("/user-access/{user_id}")
def set_user_access(user_id: int, data: dict, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("DELETE FROM user_property_access WHERE user_id=%s", (user_id,))
    for pid in data.get("property_ids", []):
        c.execute("INSERT INTO user_property_access (user_id,property_id) VALUES (%s,%s) ON CONFLICT DO NOTHING", (user_id, pid))
    c.execute("SELECT username FROM ca_users WHERE id=%s", (user_id,))
    row = c.fetchone()
    log_activity(conn, admin["id"], "updated access", "user", row["username"] if row else str(user_id), f"properties={data.get('property_ids',[])}")
    conn.commit(); conn.close(); return {"ok": True}

@app.post("/reports/{report_id}/view")
def log_report_view(report_id: int, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT r.report_name, p.name as property_name FROM pbi_reports r JOIN properties p ON r.property_id=p.id WHERE r.id=%s", (report_id,))
    row = c.fetchone()
    if row:
        log_activity(conn, current_user["id"], "viewed report", "report", row["report_name"], f"property={row['property_name']}")
        conn.commit()
    conn.close(); return {"ok": True}

@app.get("/reports")
def list_reports(current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT r.*,p.name as property_name FROM pbi_reports r JOIN properties p ON r.property_id=p.id WHERE r.is_active=TRUE ORDER BY r.property_id,r.id")
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.post("/reports", status_code=201)
def create_report(data: ReportCreate, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("INSERT INTO pbi_reports (property_id,report_name,report_type,category,pbi_report_id,pbi_workspace_id,embed_url) VALUES (%s,%s,%s,%s,%s,%s,%s) RETURNING id",
              (data.property_id, data.report_name, data.report_type, data.category, data.pbi_report_id, data.pbi_workspace_id, data.embed_url))
    new_id = c.fetchone()["id"]
    log_activity(conn, admin["id"], "added report", "report", data.report_name)
    conn.commit(); conn.close(); return {"id": new_id}

@app.patch("/reports/{report_id}")
def update_report(report_id: int, data: ReportUpdate, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    fields = {k: v for k, v in data.dict().items() if v is not None}
    if not fields: raise HTTPException(400, "Nothing to update")
    set_clause = ", ".join(f"{k}=%s" for k in fields)
    c.execute(f"UPDATE pbi_reports SET {set_clause} WHERE id=%s", (*fields.values(), report_id))
    log_activity(conn, admin["id"], "updated report", "report", str(report_id))
    conn.commit(); conn.close(); return {"ok": True}

@app.delete("/reports/{report_id}")
def delete_report(report_id: int, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT report_name FROM pbi_reports WHERE id=%s", (report_id,))
    row = c.fetchone()
    c.execute("UPDATE pbi_reports SET is_active=FALSE WHERE id=%s", (report_id,))
    log_activity(conn, admin["id"], "deleted report", "report", row["report_name"] if row else str(report_id))
    conn.commit(); conn.close(); return {"ok": True}

@app.get("/collection-logs")
def list_collection_logs(property_id: int = None, month: str = None, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    q = """SELECT cl.*, p.name as property_name, u.full_name as created_by_name, u2.full_name as updated_by_name
           FROM collection_logs cl JOIN properties p ON cl.property_id=p.id
           JOIN ca_users u ON cl.created_by=u.id LEFT JOIN ca_users u2 ON cl.updated_by=u2.id WHERE 1=1"""
    params = []
    if property_id: q += " AND cl.property_id=%s"; params.append(property_id)
    if month: q += " AND cl.month=%s"; params.append(month)
    q += " ORDER BY cl.month DESC, cl.property_id LIMIT 200"
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.post("/collection-logs", status_code=201)
def create_collection_log(data: CollectionLogCreate, current_user=Depends(require_editor)):
    conn = get_db(); c = conn.cursor()
    if current_user["role"] != "admin":
        c.execute("""INSERT INTO edit_requests (requested_by,property_id,log_id,month,field_changes,reason)
            VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
            (current_user["id"], data.property_id, None, data.month,
             json.dumps({"total_invoices":data.total_invoices,"total_revenue_share":data.total_revenue_share,
                         "total_collection":data.total_collection,"notes":data.notes,"_new_record":True}),
             "New collection record request"))
        req_id = c.fetchone()["id"]
        log_activity(conn, current_user["id"], "submitted add record request", "collection", data.month, f"property_id={data.property_id}")
        conn.commit(); conn.close(); return {"id": req_id, "pending_approval": True}
    try:
        c.execute("""INSERT INTO collection_logs (property_id,month,total_invoices,total_revenue_share,total_collection,notes,created_by,updated_by)
                     VALUES (%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
                  (data.property_id, data.month, data.total_invoices, data.total_revenue_share, data.total_collection, data.notes, current_user["id"], current_user["id"]))
        new_id = c.fetchone()["id"]
        c.execute("SELECT name FROM properties WHERE id=%s", (data.property_id,))
        prop = c.fetchone()
        log_activity(conn, current_user["id"], "added collection record", "collection", prop["name"] if prop else str(data.property_id),
                     f"month={data.month} invoices={data.total_invoices} collection={data.total_collection}")
        conn.commit(); conn.close(); return {"id": new_id}
    except Exception as e:
        conn.rollback(); conn.close(); raise HTTPException(400, f"Error: {str(e)}")

@app.patch("/collection-logs/{log_id}")
def update_collection_log(log_id: int, data: CollectionLogUpdate, current_user=Depends(require_editor)):
    conn = get_db(); c = conn.cursor()
    fields = {k: v for k, v in data.dict().items() if v is not None}
    if not fields: raise HTTPException(400, "Nothing to update")
    fields["updated_by"] = current_user["id"]
    fields["updated_at"] = datetime.utcnow()
    set_clause = ", ".join(f"{k}=%s" for k in fields)
    c.execute(f"UPDATE collection_logs SET {set_clause} WHERE id=%s", (*fields.values(), log_id))
    c.execute("SELECT cl.month, p.name FROM collection_logs cl JOIN properties p ON cl.property_id=p.id WHERE cl.id=%s", (log_id,))
    row = c.fetchone()
    log_activity(conn, current_user["id"], "updated collection record", "collection", row["name"] if row else str(log_id), f"month={row['month'] if row else '?'}")
    conn.commit(); conn.close(); return {"ok": True}

@app.delete("/collection-logs/{log_id}")
def delete_collection_log(log_id: int, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT cl.month, p.name FROM collection_logs cl JOIN properties p ON cl.property_id=p.id WHERE cl.id=%s", (log_id,))
    row = c.fetchone()
    c.execute("DELETE FROM edit_requests WHERE log_id=%s", (log_id,))
    c.execute("DELETE FROM collection_logs WHERE id=%s", (log_id,))
    log_activity(conn, admin["id"], "deleted collection record", "collection", row["name"] if row else str(log_id), f"month={row['month'] if row else '?'}")
    conn.commit(); conn.close(); return {"ok": True}

@app.get("/email-logs")
def list_email_logs(admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT el.*,u.full_name as sent_by_name FROM email_logs el JOIN ca_users u ON el.sent_by=u.id ORDER BY el.sent_at DESC LIMIT 100")
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.get("/activity-logs")
def list_activity_logs(user_id: int = None, days: int = 30, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    if current_user["role"] != "admin": user_id = current_user["id"]
    q = """SELECT al.*, u.full_name as user_name, u.role as user_role FROM activity_logs al
           JOIN ca_users u ON al.user_id=u.id WHERE al.created_at >= NOW() - INTERVAL '%s days'"""
    params = [days]
    if user_id: q += " AND al.user_id=%s"; params.append(user_id)
    q += " ORDER BY al.created_at DESC LIMIT 200"
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

def send_collection_email_sg(to_email, to_name, subject, html_body):
    if not SENDGRID_API_KEY: return False
    try:
        resp = httpx.post("https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {SENDGRID_API_KEY}", "Content-Type": "application/json"},
            json={"personalizations": [{"to": [{"email": to_email, "name": to_name}]}],
                  "from": {"email": "ahmed.hamed@savills.me", "name": "Savills Egypt — Client Accounting"},
                  "subject": subject, "content": [{"type": "text/html", "value": html_body}]}, timeout=10)
        return resp.status_code == 202
    except Exception as e: print(f"Email error: {e}"); return False

def build_collection_email(month, rows, notes, portal_url):
    LOGO = "https://savills-ca-portal.vercel.app/savills-logo.svg"
    rows_html = ""
    for r in rows:
        rate = round(float(r["total_collection"])/float(r["total_invoices"])*100,1) if r["total_invoices"] else 0
        if rate>=90: rc="#2CA01C";rb="#F2FBF0";rbd="#B7E5B0"
        elif rate>=70: rc="#B45309";rb="#FFFBEB";rbd="#FDE68A"
        else: rc="#C80C0F";rb="#FEF2F2";rbd="#FECACA"
        rows_html += f'<tr style="border-bottom:1px solid #F3F4F6"><td style="padding:14px 20px;font-size:14px;font-weight:500;color:#1C1C1C">{r["property_name"]}</td><td style="padding:14px 20px;text-align:right;font-size:14px;color:#57647A">EGP {fmt_short(r["total_invoices"])}</td><td style="padding:14px 20px;text-align:right;font-size:14px;color:#57647A">EGP {fmt_short(r["total_collection"])}</td><td style="padding:14px 20px;text-align:right;font-size:14px;color:#57647A">EGP {fmt_short(r["total_revenue_share"])}</td><td style="padding:14px 20px;text-align:center"><span style="display:inline-block;background:{rb};color:{rc};border:1px solid {rbd};border-radius:20px;padding:3px 10px;font-size:13px;font-weight:600">{rate}%</span></td></tr>'
    notes_block = f'<tr><td colspan="5" style="padding:0 32px 20px 32px"><table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBF0;border:1px solid #FDE68A;border-radius:8px"><tr><td style="padding:14px 18px;font-size:13px;color:#57647A;line-height:1.6"><strong style="color:#1C1C1C;display:block;margin-bottom:4px">Note</strong>{notes}</td></tr></table></td></tr>' if notes else ""
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Collection Update — {month}</title></head><body style="margin:0;padding:0;background:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:32px 16px"><tr><td align="center"><table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;border:1px solid #E3E8EF;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)"><tr><td style="background:#FEDE07;height:5px;font-size:0">&nbsp;</td></tr><tr><td style="padding:24px 32px;border-bottom:1px solid #F4F5F7"><table cellpadding="0" cellspacing="0"><tr><td><img src="{LOGO}" alt="Savills" width="44" height="44" style="display:block;border-radius:4px"/></td><td style="padding-left:12px;vertical-align:middle"><div style="font-size:10px;color:#8C96A3;letter-spacing:0.8px;text-transform:uppercase">Client Accounting Portal</div></td></tr></table></td></tr><tr><td style="padding:28px 32px 0 32px"><div style="font-size:26px;font-weight:700;color:#1C1C1C;margin-bottom:10px">Collection Update — {month}</div></td></tr><tr><td style="padding:20px 32px"><div style="height:2px;background:linear-gradient(to right,#C80C0F,#FEDE07);border-radius:2px"></div></td></tr>{notes_block}<tr><td style="padding:0 32px 0 32px"><table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E8EF;border-radius:8px;overflow:hidden;border-collapse:separate;border-spacing:0"><tr style="background:#F8F9FA"><th style="padding:11px 20px;text-align:left;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E3E8EF">Property</th><th style="padding:11px 20px;text-align:right;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E3E8EF">Invoices</th><th style="padding:11px 20px;text-align:right;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E3E8EF">Collection</th><th style="padding:11px 20px;text-align:right;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E3E8EF">Rev. Share</th><th style="padding:11px 20px;text-align:center;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E3E8EF">Rate</th></tr>{rows_html}</table></td></tr><tr><td style="padding:24px 32px"><table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;border:1px solid #E3E8EF;border-radius:8px"><tr><td style="padding:20px 24px"><div style="font-size:14px;font-weight:600;color:#1C1C1C;margin-bottom:6px">View Detailed Reports</div><a href="{portal_url}" style="display:inline-block;background:#C80C0F;color:#fff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">Access Portal &rarr;</a></td></tr></table></td></tr><tr><td style="padding:0 32px 28px 32px;border-top:1px solid #F4F5F7"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding-top:20px;font-size:12px;color:#8C96A3;line-height:1.6">This email was sent from the <strong style="color:#57647A">Savills Egypt CA Portal</strong>.<br>Savills Egypt &middot; Client Accounting &middot; Property Management</td><td style="padding-top:20px;text-align:right;vertical-align:top"><span style="font-size:11px;color:#C4CBD6">Confidential</span></td></tr></table></td></tr></table></td></tr></table></body></html>"""

@app.post("/collection/send-email")
def send_collection_email_endpoint(data: CollectionEmailSend, current_user=Depends(require_editor)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id,name FROM properties WHERE id=ANY(%s)", (data.property_ids,))
    props = {p["id"]: p["name"] for p in c.fetchall()}
    c.execute("SELECT id,full_name,email FROM ca_users WHERE id=ANY(%s) AND is_active=TRUE", (data.recipient_user_ids,))
    recipients = [dict(r) for r in c.fetchall()]
    email_rows = []
    for pid in data.property_ids:
        cdata = data.collections.get(str(pid), data.collections.get(pid, {}))
        email_rows.append({"property_name": props.get(pid, str(pid)), "total_invoices": cdata.get("invoices",0), "total_collection": cdata.get("collection",0), "total_revenue_share": cdata.get("revenue_share",0)})
    subject = f"Collection Update — {data.month} | Savills Egypt"
    html = build_collection_email(data.month, email_rows, data.notes, PORTAL_URL)
    sent_to = []
    for r in recipients:
        if r.get("email"):
            ok = send_collection_email_sg(r["email"], r["full_name"], subject, html)
            if ok: sent_to.append(r["full_name"])
    c.execute("INSERT INTO email_logs (subject,recipients,property_names,month,status,sent_by) VALUES (%s,%s,%s,%s,%s,%s)",
              (subject, ", ".join(r["full_name"] for r in recipients), ", ".join(props.values()), data.month, f"Sent to {len(sent_to)} recipients", current_user["id"]))
    log_activity(conn, current_user["id"], "sent collection email", "email", ", ".join(props.values()), f"month={data.month} recipients={len(sent_to)}")
    conn.commit(); conn.close(); return {"ok": True, "sent_to": sent_to}

@app.get("/settings")
def get_settings(current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT key, value FROM app_settings ORDER BY id")
    rows = {r["key"]: r["value"] for r in c.fetchall()}; conn.close(); return rows

@app.patch("/settings")
def update_settings(data: dict, admin=Depends(require_admin)):
    allowed_keys = {"app_name","logo_url","primary_color","accent_color","font_family","email_sender_name","email_sender_email","portal_tagline"}
    conn = get_db(); c = conn.cursor()
    updated = []
    for key, value in data.items():
        if key in allowed_keys and isinstance(value, str):
            c.execute("INSERT INTO app_settings (key,value,updated_at) VALUES (%s,%s,NOW()) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()", (key, value))
            updated.append(key)
    log_activity(conn, admin["id"], "updated app settings", "settings", ", ".join(updated))
    conn.commit(); conn.close(); return {"ok": True, "updated": updated}

@app.delete("/activity-logs/{log_id}")
def delete_activity_log(log_id: int, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("DELETE FROM activity_logs WHERE id=%s", (log_id,))
    conn.commit(); conn.close(); return {"ok": True}

@app.delete("/activity-logs")
def clear_activity_logs(admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("DELETE FROM activity_logs")
    conn.commit(); conn.close(); return {"ok": True}

@app.get("/edit-requests")
def get_edit_requests(current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    if current_user["role"] == "admin":
        c.execute("SELECT er.*, u.full_name as requester_name, p.name as property_name FROM edit_requests er JOIN ca_users u ON er.requested_by=u.id JOIN properties p ON er.property_id=p.id ORDER BY er.created_at DESC")
    else:
        c.execute("SELECT er.*, u.full_name as requester_name, p.name as property_name FROM edit_requests er JOIN ca_users u ON er.requested_by=u.id JOIN properties p ON er.property_id=p.id WHERE er.requested_by=%s ORDER BY er.created_at DESC", (current_user["id"],))
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.get("/edit-requests/pending-count")
def get_pending_count(admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT COUNT(*) as cnt FROM edit_requests WHERE status='pending'")
    cnt = c.fetchone()["cnt"]; conn.close(); return {"count": cnt}

@app.post("/edit-requests")
def create_edit_request(data: dict, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("INSERT INTO edit_requests (requested_by,property_id,log_id,month,field_changes,reason) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
              (current_user["id"], data["property_id"], data.get("log_id"), data["month"], json.dumps(data["field_changes"]), data.get("reason","")))
    req_id = c.fetchone()["id"]
    log_activity(conn, current_user["id"], "submitted edit request", "collection", data.get("month",""), f"property_id={data['property_id']}")
    conn.commit(); conn.close(); return {"id": req_id}

@app.patch("/edit-requests/{req_id}")
def review_edit_request(req_id: int, data: dict, admin=Depends(require_admin)):
    action = data.get("action"); note = data.get("note","")
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM edit_requests WHERE id=%s", (req_id,))
    req = c.fetchone()
    if not req: conn.close(); raise HTTPException(404, "Request not found")
    if action == "approve":
        fc = req["field_changes"]
        if isinstance(fc, str): changes = json.loads(fc)
        elif hasattr(fc, 'adapted'): changes = dict(fc)
        else: changes = dict(fc) if fc else {}
        allowed_fields = {"total_invoices","total_revenue_share","total_collection","notes"}
        safe_changes = {k: v for k,v in changes.items() if k in allowed_fields}
        if changes.get("_new_record") and not req["log_id"]:
            c.execute("INSERT INTO collection_logs (property_id,month,total_invoices,total_revenue_share,total_collection,notes,created_by,updated_by) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                      (req["property_id"], req["month"], safe_changes.get("total_invoices",0), safe_changes.get("total_revenue_share",0), safe_changes.get("total_collection",0), safe_changes.get("notes",""), req["requested_by"], admin["id"]))
        elif req["log_id"] and safe_changes:
            sets = ", ".join([f"{k}=%s" for k in safe_changes.keys()])
            c.execute(f"UPDATE collection_logs SET {sets}, updated_by=%s, updated_at=NOW() WHERE id=%s", (*safe_changes.values(), admin["id"], req["log_id"]))
        c.execute("UPDATE edit_requests SET status='approved', reviewed_by=%s, review_note=%s, reviewed_at=NOW() WHERE id=%s", (admin["id"], note, req_id))
        log_activity(conn, admin["id"], "approved edit request", "collection", str(req["month"]), f"req_id={req_id}")
    elif action == "reject":
        c.execute("UPDATE edit_requests SET status='rejected', reviewed_by=%s, review_note=%s, reviewed_at=NOW() WHERE id=%s", (admin["id"], note, req_id))
        log_activity(conn, admin["id"], "rejected edit request", "collection", str(req["month"]), f"req_id={req_id}")
    conn.commit(); conn.close(); return {"ok": True}

# ── Rent Roll ─────────────────────────────────────────────────────────────────
@app.post("/rent-roll/upload")
async def upload_rent_roll(property_id: int = Form(...), sub_location: str = Form(default=""), file: UploadFile = File(...), current_user=Depends(require_editor)):
    import pandas as pd
    import numpy as np
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content), header=1, skiprows=[2])
    except Exception as e:
        raise HTTPException(400, f"Could not read Excel file: {e}")
    if not sub_location and 'Project' in df.columns:
        projects = df['Project'].dropna().unique()
        projects = [p for p in projects if str(p).strip().lower() != 'total']
        if len(projects) == 1: sub_location = str(projects[0]).strip()
    rent = df[(df['Status']=='Approved') & (df['Element Group']=='Rent')].copy()
    sc_df = df[(df['Status']=='Approved') & (df['Element Group']=='Service Charge')].copy()
    if len(rent) == 0: raise HTTPException(400, "No approved rent rows found in file")
    from datetime import date
    today = date.today(); report_month = today.strftime('%Y-%m'); month_col = report_month
    month_cols = [c for c in df.columns if str(c).startswith('20') and len(str(c))==7]
    if month_col not in month_cols and month_cols: month_col = sorted(month_cols)[-1]
    def safe_sum(series):
        try: return float(series.fillna(0).sum())
        except: return 0.0
    monthly_rent = safe_sum(rent[month_col]) if month_col in rent.columns else 0
    monthly_sc = safe_sum(sc_df[month_col]) if month_col in sc_df.columns else 0
    rem = pd.to_numeric(rent['Remaining Years'], errors='coerce').fillna(0)
    summary = {'active_leases':int(len(rent)),'unique_tenants':int(rent['Tenant Brand Name'].nunique()),
               'total_gla':safe_sum(pd.to_numeric(rent['GLA'],errors='coerce')),
               'annualized_rent':safe_sum(pd.to_numeric(rent['Annualized Rent'],errors='coerce')),
               'monthly_rent':monthly_rent,'monthly_sc':monthly_sc,
               'expiry_0_1yr':int((rem<=1).sum()),'expiry_1_2yr':int(((rem>1)&(rem<=2)).sum()),
               'expiry_2_3yr':int(((rem>2)&(rem<=3)).sum()),'expiry_3plus':int((rem>3).sum())}
    conn = get_db(); c = conn.cursor()
    if sub_location:
        c.execute("DELETE FROM rent_roll_uploads WHERE property_id=%s AND sub_location=%s", (property_id, sub_location))
    else:
        c.execute("DELETE FROM rent_roll_uploads WHERE property_id=%s AND (sub_location='' OR sub_location IS NULL)", (property_id,))
    c.execute("""INSERT INTO rent_roll_uploads (property_id,sub_location,filename,uploaded_by,report_date,active_leases,unique_tenants,total_gla,annualized_rent,monthly_rent,monthly_sc,expiry_0_1yr,expiry_1_2yr,expiry_2_3yr,expiry_3plus)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
        (property_id, sub_location, file.filename, current_user["id"], report_month,
         summary['active_leases'], summary['unique_tenants'], summary['total_gla'], summary['annualized_rent'],
         summary['monthly_rent'], summary['monthly_sc'], summary['expiry_0_1yr'], summary['expiry_1_2yr'],
         summary['expiry_2_3yr'], summary['expiry_3plus']))
    upload_id = c.fetchone()["id"]
    for _, row in rent.iterrows():
        def gv(col, default=0):
            v = row.get(col, default)
            if pd.isna(v): return default
            return v
        monthly = float(row[month_col]) if month_col in rent.columns and not pd.isna(row.get(month_col)) else 0
        sc_match = sc_df[sc_df['Document No']==row.get('Document No','')]
        ann_sc = float(sc_match['Annualized Service'].iloc[0]) if len(sc_match)>0 and not pd.isna(sc_match['Annualized Service'].iloc[0]) else 0
        sc_sqm = float(sc_match['Service Per SQM'].iloc[0]) if len(sc_match)>0 and not pd.isna(sc_match['Service Per SQM'].iloc[0]) else 0
        lease_start = row.get('Lease Start'); lease_end = row.get('Lease End')
        if pd.isna(lease_start): lease_start = None
        if pd.isna(lease_end): lease_end = None
        c.execute("""INSERT INTO rent_roll_leases (upload_id,property_id,document_no,document_type,tenant_number,tenant_brand,tenant_legal,unit_code,unit_type,floor,gla,lease_start,lease_end,remaining_years,remaining_months,annualized_rent,annualized_sc,monthly_rent,rent_per_sqm,sc_per_sqm,escalation_rate,revenue_sharing_rate,security_deposit)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
            (upload_id, property_id,
             str(gv('Document No','')), str(gv('Document Type','')),
             str(int(gv('Tenant Number',0))) if gv('Tenant Number',0) else '',
             str(gv('Tenant Brand Name','')), str(gv('Tenant Legal Name','')),
             str(gv('Unit Code','')), str(gv('Unit Type','')), str(gv('Floor Number','')), float(gv('GLA',0)),
             lease_start, lease_end, float(gv('Remaining Years',0)), float(gv('Remaining Months',0)),
             float(gv('Annualized Rent',0)), ann_sc, monthly, float(gv('Indoor Rent Per Sqm',0)), sc_sqm,
             float(gv('Rent Escalation Rate',0)), float(gv('Revenue Sharing Rate',0)), float(gv('Security Deposit',0))))
    # After inserting all leases, fetch their IDs and save monthly data
    c.execute("SELECT id, document_no FROM rent_roll_leases WHERE upload_id=%s", (upload_id,))
    lease_id_map = {row["document_no"]: row["id"] for row in c.fetchall()}

    # Get all month columns from the file (format: YYYY-MM)
    month_cols = sorted([col for col in df.columns if str(col).startswith('20') and len(str(col))==7])

    # Build monthly inserts for rent + SC
    monthly_rows = []
    for _, row in rent.iterrows():
        doc_no = str(row.get('Document No',''))
        lease_id = lease_id_map.get(doc_no)
        if not lease_id:
            continue
        # Find matching SC row
        sc_row = sc_df[sc_df['Document No']==row.get('Document No','')]
        for mc in month_cols:
            r_val = 0.0
            s_val = 0.0
            try:
                rv = row.get(mc)
                if rv is not None and not pd.isna(rv):
                    r_val = float(rv)
            except: pass
            try:
                if len(sc_row)>0:
                    sv = sc_row.iloc[0].get(mc)
                    if sv is not None and not pd.isna(sv):
                        s_val = float(sv)
            except: pass
            if r_val > 0 or s_val > 0:
                monthly_rows.append((lease_id, upload_id, property_id, mc, r_val, s_val))

    # Batch insert monthly data
    if monthly_rows:
        psycopg2.extras.execute_values(c,
            "INSERT INTO rent_roll_monthly (lease_id, upload_id, property_id, month, rent, sc) VALUES %s",
            monthly_rows)

    log_activity(conn, current_user["id"], "uploaded rent roll", "property", str(property_id), f"leases={summary['active_leases']} month={report_month}")
    conn.commit(); conn.close()
    return {"ok": True, "upload_id": upload_id, "sub_location": sub_location, **summary}

@app.get("/rent-roll/{property_id}")
def get_rent_roll(property_id: int, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT DISTINCT ON (sub_location) * FROM rent_roll_uploads WHERE property_id=%s ORDER BY sub_location, upload_date DESC", (property_id,))
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.get("/rent-roll/{property_id}/leases")
def get_rent_roll_leases(property_id: int, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    # KEY FIX: include u.sub_location so frontend can filter by sub-location
    c.execute("""SELECT l.*, u.sub_location FROM rent_roll_leases l
                 JOIN rent_roll_uploads u ON l.upload_id=u.id
                 WHERE l.property_id=%s
                 ORDER BY u.sub_location, l.remaining_years ASC""", (property_id,))
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.get("/rent-roll")
def get_all_rent_rolls(current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("""SELECT DISTINCT ON (u.property_id, u.sub_location) u.*, p.name as property_name
                 FROM rent_roll_uploads u JOIN properties p ON u.property_id=p.id
                 ORDER BY u.property_id, u.sub_location, u.upload_date DESC""")
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.get("/rent-roll/{property_id}/monthly")
def get_rent_roll_monthly(property_id: int, month: str, current_user=Depends(get_current_user)):
    """Get monthly rent + SC for all leases in a property for a specific month"""
    conn = get_db(); c = conn.cursor()
    c.execute("""
        SELECT m.lease_id, m.month, m.rent, m.sc,
               l.tenant_brand, l.unit_code, l.unit_type, l.floor, l.gla,
               l.remaining_years, l.lease_start, l.lease_end, l.escalation_rate,
               u.sub_location
        FROM rent_roll_monthly m
        JOIN rent_roll_leases l ON m.lease_id=l.id
        JOIN rent_roll_uploads u ON m.upload_id=u.id
        WHERE m.property_id=%s AND m.month=%s
        ORDER BY u.sub_location, l.remaining_years ASC
    """, (property_id, month))
    rows = [dict(r) for r in c.fetchall()]
    conn.close()
    return rows

@app.get("/rent-roll/{property_id}/months")
def get_rent_roll_months(property_id: int, current_user=Depends(get_current_user)):
    """Get list of available months for a property's rent roll"""
    conn = get_db(); c = conn.cursor()
    c.execute("""
        SELECT DISTINCT month FROM rent_roll_monthly
        WHERE property_id=%s ORDER BY month
    """, (property_id,))
    rows = [r["month"] for r in c.fetchall()]
    conn.close()
    return rows

# ── Invoice Reconciliation ────────────────────────────────────────────────────
@app.post("/invoice-recon/upload")
async def upload_invoice_recon(
    property_id: int = Form(...),
    sub_location: str = Form(default=""),
    report_month: str = Form(...),
    file: UploadFile = File(...),
    current_user=Depends(require_editor)
):
    import pandas as pd
    content = await file.read()

    # Find header row
    df_raw = pd.read_excel(io.BytesIO(content), header=None)
    header_row = 2
    for i, row in df_raw.iterrows():
        if any('Document No' in str(v) for v in row.values):
            header_row = i
            break

    df = pd.read_excel(io.BytesIO(content), header=header_row)
    df.columns = [str(c).strip() for c in df.columns]

    # Filter: Approved leases, relevant element groups, target month
    if 'Document Status' in df.columns:
        df = df[df['Document Status'].isin(['Approved','Active'])]

    # Parse dates
    if 'PS Due Date' in df.columns:
        df['PS Due Date'] = pd.to_datetime(df['PS Due Date'], errors='coerce')

    # Filter element groups
    relevant = ['Rent','Service Charge']
    if 'Element Group' in df.columns:
        df = df[df['Element Group'].isin(relevant)]

    if len(df) == 0:
        raise HTTPException(400, "No matching records found")

    # Auto-detect sub_location from Project column BEFORE filtering
    if not sub_location and 'Project' in df.columns:
        projs = df['Project'].dropna().unique()
        projs = [p for p in projs if str(p).strip().lower() not in ('total','nan','none')]
        if len(projs) == 1:
            sub_location = str(projs[0]).strip()

    def safe_float(v):
        try: return float(v) if pd.notna(v) else 0.0
        except: return 0.0

    def safe_str(v):
        s = str(v).strip() if pd.notna(v) else ''
        return '' if s.lower() in ('nan','none','nat') else s

    def safe_date(v):
        if pd.isna(v): return None
        try: return pd.to_datetime(v).date()
        except: return None

    # Auto-detect sub_location from Project column
    if not sub_location and 'Project' in df.columns:
        projs = df['Project'].dropna().unique()
        projs = [p for p in projs if str(p).strip().lower() != 'total']
        if len(projs) == 1:
            sub_location = str(projs[0]).strip()

    # Filter for target month for summary KPIs
    target = pd.to_datetime(report_month + '-01')
    month_df = df[df['PS Due Date'].dt.to_period('M') == target.to_period('M')] if 'PS Due Date' in df.columns else df

    invoiced_m = month_df[month_df['PS Invoiced Flag']=='Y']
    not_invoiced_m = month_df[month_df['PS Invoiced Flag']=='N']

    summary = {
        'total_lines': len(month_df),
        'invoiced_count': len(invoiced_m),
        'not_invoiced_count': len(not_invoiced_m),
        'invoiced_amount': float(invoiced_m['PS Amount'].fillna(0).sum()),
        'not_invoiced_amount': float(not_invoiced_m['PS Amount'].fillna(0).sum()),
    }

    conn = get_db(); c = conn.cursor()

    # Delete previous upload for same property+sub_location+month
    c.execute("""DELETE FROM invoice_uploads
                 WHERE property_id=%s AND sub_location=%s AND report_month=%s""",
              (property_id, sub_location, report_month))

    c.execute("""INSERT INTO invoice_uploads
        (property_id,sub_location,filename,uploaded_by,report_month,
         total_lines,invoiced_count,not_invoiced_count,invoiced_amount,not_invoiced_amount)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
        (property_id, sub_location, file.filename, current_user["id"], report_month,
         summary['total_lines'], summary['invoiced_count'], summary['not_invoiced_count'],
         summary['invoiced_amount'], summary['not_invoiced_amount']))
    upload_id = c.fetchone()["id"]

    # Store all rows (YTD) using batch insert
    rows_data = []
    for _, row in df.iterrows():
        due = safe_date(row.get('PS Due Date'))
        # Get row-level sub_location from Project column
        row_sub = safe_str(row.get('Project', sub_location)) or sub_location
        if row_sub.lower() in ('nan','none',''): row_sub = sub_location
        # PS Amount is the invoice amount (PS Revenue Amount is always 0)
        rows_data.append((
            upload_id, property_id, row_sub, report_month,
            safe_str(row.get('Document No','')), safe_str(row.get('Unit','')),
            safe_str(row.get('Unit Type','')), safe_str(row.get('Customer Name','')),
            safe_str(row.get('Brand','')), safe_str(row.get('Element Group','')),
            due, safe_float(row.get('PS Amount',0)), safe_float(row.get('PS Paid Amount',0)),
            safe_str(row.get('PS Invoiced Flag','N')), safe_float(row.get('PS Amount',0)),
            safe_str(row.get('Invoice No.','')),
            safe_date(row.get('Lease Start Date')), safe_date(row.get('Lease End Date')),
            safe_str(row.get('Document Status',''))
        ))
    psycopg2.extras.execute_values(c,
        """INSERT INTO invoice_lines
            (upload_id,property_id,sub_location,report_month,document_no,unit,unit_type,
             customer_name,brand,element_group,ps_due_date,ps_amount,ps_paid_amount,
             ps_invoiced_flag,ps_revenue_amount,invoice_no,lease_start,lease_end,document_status)
           VALUES %s""", rows_data)

    log_activity(conn, current_user["id"], "uploaded invoice recon", "invoice",
                 f"{sub_location} {report_month}",
                 f"lines={summary['total_lines']} invoiced={summary['invoiced_count']}")
    conn.commit(); conn.close()
    return {"ok": True, "upload_id": upload_id, "sub_location": sub_location, **summary}

@app.get("/invoice-recon/uploads")
def list_invoice_uploads(property_id: int = None, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    q = """SELECT u.*, p.name as property_name, usr.full_name as uploaded_by_name
           FROM invoice_uploads u
           JOIN properties p ON u.property_id=p.id
           JOIN ca_users usr ON u.uploaded_by=usr.id
           WHERE 1=1"""
    params = []
    if property_id: q += " AND u.property_id=%s"; params.append(property_id)
    q += " ORDER BY u.report_month DESC, u.sub_location"
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.get("/invoice-recon/lines")
def get_invoice_lines(
    property_id: int, report_month: str = None,
    sub_location: str = None, element_group: str = None,
    status: str = None, current_user=Depends(get_current_user)
):
    conn = get_db(); c = conn.cursor()
    q = """SELECT l.*,
                  rc.reason, rc.notes, rc.status as comment_status,
                  rc.id as comment_id,
                  usr.full_name as comment_by,
                  rc.updated_at as comment_date
           FROM invoice_lines l
           LEFT JOIN recon_comments rc ON rc.line_id=l.id
           LEFT JOIN ca_users usr ON rc.created_by=usr.id
           WHERE l.property_id=%s
             AND (%s IS NULL OR DATE_TRUNC('month', l.ps_due_date) = DATE_TRUNC('month', %s::date))"""
    rmonth_date = (report_month + '-01') if report_month else None
    params = [property_id, rmonth_date, rmonth_date]
    if sub_location: q += " AND l.sub_location=%s"; params.append(sub_location)
    if element_group: q += " AND l.element_group=%s"; params.append(element_group)
    if status == "invoiced": q += " AND l.ps_invoiced_flag='Y'"
    elif status == "not_invoiced": q += " AND l.ps_invoiced_flag='N'"
    q += " ORDER BY l.ps_invoiced_flag ASC, l.brand, l.element_group"
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.get("/invoice-recon/months")
def get_invoice_months(property_id: int = None, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    q = "SELECT DISTINCT report_month, sub_location, property_id FROM invoice_uploads WHERE 1=1"
    params = []
    if property_id: q += " AND property_id=%s"; params.append(property_id)
    q += " ORDER BY report_month DESC"
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.post("/invoice-recon/comments")
def save_recon_comment(data: dict, current_user=Depends(require_editor)):
    conn = get_db(); c = conn.cursor()
    line_id = data["line_id"]

    # Get line info
    c.execute("SELECT property_id, report_month FROM invoice_lines WHERE id=%s", (line_id,))
    line = c.fetchone()
    if not line: conn.close(); raise HTTPException(404, "Line not found")

    # Upsert comment
    c.execute("SELECT id FROM recon_comments WHERE line_id=%s", (line_id,))
    existing = c.fetchone()
    if existing:
        c.execute("""UPDATE recon_comments SET reason=%s, notes=%s, status=%s,
                     created_by=%s, updated_at=NOW() WHERE line_id=%s""",
                  (data.get("reason",""), data.get("notes",""),
                   data.get("status","open"), current_user["id"], line_id))
    else:
        c.execute("""INSERT INTO recon_comments
                     (line_id,property_id,report_month,reason,notes,status,created_by)
                     VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                  (line_id, line["property_id"], line["report_month"],
                   data.get("reason",""), data.get("notes",""),
                   data.get("status","open"), current_user["id"]))

    log_activity(conn, current_user["id"], "added recon comment", "invoice",
                 data.get("reason",""), f"line_id={line_id}")
    conn.commit(); conn.close()
    return {"ok": True}

@app.get("/invoice-recon/summary")
def get_invoice_summary(property_id: int, report_month: str = None,
                        sub_location: str = None,
                        current_user=Depends(get_current_user)):
    """Calculate summary from actual lines filtered by month"""
    conn = get_db(); c = conn.cursor()

    # Current month — aggregate from lines
    c.execute("""
        SELECT
            COUNT(*) as total_lines,
            SUM(CASE WHEN ps_invoiced_flag='Y' THEN 1 ELSE 0 END) as invoiced_count,
            SUM(CASE WHEN ps_invoiced_flag='N' THEN 1 ELSE 0 END) as not_invoiced_count,
            SUM(CASE WHEN ps_invoiced_flag='Y' THEN ps_amount ELSE 0 END) as invoiced_amount,
            SUM(CASE WHEN ps_invoiced_flag='N' THEN ps_amount ELSE 0 END) as not_invoiced_amount
        FROM invoice_lines
        WHERE property_id=%s
          AND (%s IS NULL OR DATE_TRUNC('month', ps_due_date) = DATE_TRUNC('month', %s::date))
          AND (%s IS NULL OR sub_location=%s)
    """, (property_id,
           (report_month + '-01') if report_month else None,
           (report_month + '-01') if report_month else None,
           sub_location or None, sub_location or None))
    row = c.fetchone()
    current = [{
        "sub_location": "All",
        "total_lines": row["total_lines"] or 0,
        "invoiced_count": row["invoiced_count"] or 0,
        "not_invoiced_count": row["not_invoiced_count"] or 0,
        "invoiced_amount": float(row["invoiced_amount"] or 0),
        "not_invoiced_amount": float(row["not_invoiced_amount"] or 0),
    }]

    # Previous month for delta
    prev_month = (datetime.strptime(report_month+"-01", "%Y-%m-%d")
                  .replace(day=1) - timedelta(days=1)).strftime("%Y-%m")
    c.execute("""
        SELECT
            SUM(CASE WHEN ps_invoiced_flag='Y' THEN 1 ELSE 0 END) as invoiced_count,
            SUM(CASE WHEN ps_invoiced_flag='N' THEN 1 ELSE 0 END) as not_invoiced_count
        FROM invoice_lines
        WHERE property_id=%s
          AND (%s IS NULL OR DATE_TRUNC('month', ps_due_date) = DATE_TRUNC('month', %s::date))
          AND (%s IS NULL OR sub_location=%s)
    """, (property_id,
           (prev_month + '-01') if prev_month else None,
           (prev_month + '-01') if prev_month else None,
           sub_location or None, sub_location or None))
    prev = c.fetchone()
    if prev and prev["invoiced_count"] is not None:
        current[0]["delta_invoiced"] = current[0]["invoiced_count"] - (prev["invoiced_count"] or 0)
        current[0]["delta_not_invoiced"] = current[0]["not_invoiced_count"] - (prev["not_invoiced_count"] or 0)
    else:
        current[0]["delta_invoiced"] = None
        current[0]["delta_not_invoiced"] = None

    conn.close()
    return current

# ── Customers ─────────────────────────────────────────────────────────────────
@app.get("/customers")
def list_customers(search: str = None, property_id: int = None,
                   current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    q = """SELECT c.*, p.name as property_name FROM customers c
           LEFT JOIN properties p ON c.property_id=p.id WHERE 1=1"""
    params = []
    if search:
        q += """ AND (c.brand_name ILIKE %s OR c.legal_name ILIKE %s OR c.unit_code ILIKE %s
                  OR c.tenant_number ILIKE %s OR c.document_no ILIKE %s OR c.document_type ILIKE %s)"""
        params += [f"%{search}%"]*6
    if property_id:
        q += " AND c.property_id=%s"; params.append(property_id)
    q += " ORDER BY c.brand_name ASC LIMIT 500"
    c.execute(q, params)
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.get("/customers/{customer_id}")
def get_customer(customer_id: int, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("""SELECT c.*, p.name as property_name FROM customers c
                 LEFT JOIN properties p ON c.property_id=p.id WHERE c.id=%s""", (customer_id,))
    row = c.fetchone(); conn.close()
    if not row: raise HTTPException(404, "Customer not found")
    return dict(row)

@app.post("/customers", status_code=201)
def create_customer(data: dict, current_user=Depends(require_editor)):
    conn = get_db(); c = conn.cursor()
    brand = data.get("brand_name","").strip()
    unit = data.get("unit_code","").strip()
    if not brand: raise HTTPException(400, "Brand name required")
    # Check duplicate
    c.execute("SELECT id FROM customers WHERE brand_name ILIKE %s AND unit_code ILIKE %s",
              (brand, unit))
    if c.fetchone():
        conn.close(); raise HTTPException(409, f"Customer '{brand}' with unit '{unit}' already exists")
    c.execute("""INSERT INTO customers
        (brand_name,legal_name,unit_code,unit_type,location,lease_type,property_id,
         sub_location,bank_account,phone,email,notes,source,
         tenant_number,document_type,document_no)
        VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) RETURNING id""",
        (brand, data.get("legal_name",""), unit,
         data.get("unit_type",""), data.get("location",""),
         data.get("lease_type",""), data.get("property_id") or None,
         data.get("sub_location",""), data.get("bank_account",""),
         data.get("phone",""), data.get("email",""),
         data.get("notes",""), data.get("source","manual"),
         data.get("tenant_number",""), data.get("document_type",""),
         data.get("document_no","")))
    new_id = c.fetchone()["id"]
    log_activity(conn, current_user["id"], "added customer", "customer", brand)
    conn.commit(); conn.close(); return {"id": new_id}

@app.patch("/customers/{customer_id}")
def update_customer(customer_id: int, data: dict, current_user=Depends(require_editor)):
    conn = get_db(); c = conn.cursor()
    allowed = {k: v for k, v in data.items() if k in (
        "brand_name","legal_name","unit_code","unit_type","location","lease_type",
        "property_id","sub_location","bank_account","phone","email","notes",
        "tenant_number","document_type","document_no")}
    if not allowed: raise HTTPException(400, "Nothing to update")
    allowed["updated_at"] = datetime.utcnow()
    set_clause = ", ".join(f"{k}=%s" for k in allowed)
    c.execute(f"UPDATE customers SET {set_clause} WHERE id=%s", (*allowed.values(), customer_id))
    c.execute("SELECT brand_name FROM customers WHERE id=%s", (customer_id,))
    row = c.fetchone()
    log_activity(conn, current_user["id"], "updated customer", "customer",
                 row["brand_name"] if row else str(customer_id))
    conn.commit(); conn.close(); return {"ok": True}

@app.delete("/customers/{customer_id}")
def delete_customer(customer_id: int, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT brand_name FROM customers WHERE id=%s", (customer_id,))
    row = c.fetchone()
    c.execute("DELETE FROM customers WHERE id=%s", (customer_id,))
    log_activity(conn, admin["id"], "deleted customer", "customer",
                 row["brand_name"] if row else str(customer_id))
    conn.commit(); conn.close(); return {"ok": True}

@app.post("/customers/import")
async def import_customers(file: UploadFile = File(...),
                           property_id: int = Form(default=None),
                           current_user=Depends(require_editor)):
    """Import customers from Excel — skips duplicates"""
    import pandas as pd
    content = await file.read()
    try:
        df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(400, f"Cannot read file: {e}")

    # Flexible column mapping
    col_map = {
        "brand_name": ["Brand","Brand Name","brand_name","Tenant Brand","Tenant Brand Name"],
        "legal_name": ["Customer Name","Legal Name","legal_name","Tenant Legal Name","Tenant Legal"],
        "unit_code":  ["Unit Code","unit_code","Unit","Account"],
        "unit_type":  ["Lease Type","Unit Type","unit_type","Type"],
        "location":   ["Location","Sub Location","location","sub_location"],
        "bank_account": ["Remittance Bank Account","Bank Account","bank_account"],
    }

    def find_col(df, candidates):
        for c in candidates:
            if c in df.columns: return c
        return None

    mapped = {}
    for field, candidates in col_map.items():
        col = find_col(df, candidates)
        if col: mapped[field] = col

    if "brand_name" not in mapped:
        raise HTTPException(400, "Cannot find Brand Name column")

    conn = get_db(); c = conn.cursor()
    added = 0; skipped = 0; errors = []

    for _, row in df.iterrows():
        brand = str(row.get(mapped["brand_name"], "")).strip()
        if not brand or brand.lower() in ("nan","none",""): continue
        unit = str(row.get(mapped.get("unit_code",""), "")).strip() if "unit_code" in mapped else ""
        if unit.lower() == "nan": unit = ""

        # Check duplicate
        c.execute("SELECT id FROM customers WHERE brand_name ILIKE %s AND unit_code ILIKE %s",
                  (brand, unit))
        if c.fetchone():
            skipped += 1; continue

        try:
            legal = str(row.get(mapped.get("legal_name",""), "")).strip() if "legal_name" in mapped else ""
            utype = str(row.get(mapped.get("unit_type",""), "")).strip() if "unit_type" in mapped else ""
            loc   = str(row.get(mapped.get("location",""), "")).strip() if "location" in mapped else ""
            bank  = str(row.get(mapped.get("bank_account",""), "")).strip() if "bank_account" in mapped else ""
            for v in [legal, utype, loc, bank]:
                if v.lower() == "nan": v = ""

            c.execute("""INSERT INTO customers
                (brand_name,legal_name,unit_code,unit_type,location,property_id,bank_account,source)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)""",
                (brand, legal if legal != "nan" else "",
                 unit, utype if utype != "nan" else "",
                 loc if loc != "nan" else "",
                 property_id, bank if bank != "nan" else "", "import"))
            added += 1
        except Exception as e:
            skipped += 1; errors.append(str(e)[:100])

    log_activity(conn, current_user["id"], "imported customers", "customer",
                 file.filename, f"added={added} skipped={skipped}")
    conn.commit(); conn.close()
    return {"ok": True, "added": added, "skipped": skipped, "errors": errors[:5]}

@app.post("/customers/import-from-rent-roll")
def import_from_rent_roll(property_id: int = None, data: dict = None, current_user=Depends(require_editor)):
    if data and "property_id" in data: property_id = data["property_id"]
    """Pull customers from rent roll — insert new, update existing with missing fields"""
    conn = get_db(); c = conn.cursor()
    c.execute("""SELECT DISTINCT ON (l.tenant_brand, l.unit_code)
                 l.tenant_brand, l.tenant_legal, l.unit_code, l.unit_type,
                 l.document_no, l.document_type, l.tenant_number, l.revenue_sharing_rate,
                 u.sub_location, u.property_id
                 FROM rent_roll_leases l
                 JOIN rent_roll_uploads u ON l.upload_id=u.id
                 WHERE u.property_id=%s AND l.tenant_brand IS NOT NULL
                 ORDER BY l.tenant_brand, l.unit_code, u.upload_date DESC""", (property_id,))
    leases = c.fetchall()
    added = 0; updated = 0; skipped = 0

    for l in leases:
        brand = (l["tenant_brand"] or "").strip()
        unit  = (l["unit_code"] or "").strip()
        if not brand: continue

        doc_no    = (l["document_no"] or "").strip()
        legal     = (l["tenant_legal"] or "").strip()
        unit_type = (l["unit_type"] or "").strip()
        sub_loc   = (l["sub_location"] or "").strip()
        prop_id   = l["property_id"]

        # Check if exists
        c.execute("""SELECT id, legal_name, document_no, document_type, tenant_number, unit_type, sub_location, property_id
                     FROM customers WHERE brand_name ILIKE %s AND unit_code ILIKE %s""",
                  (brand, unit))
        existing = c.fetchone()

        if existing:
            # Build update: only fill in fields that are currently empty
            updates = {}
            if not existing["legal_name"] and legal:
                updates["legal_name"] = legal
            if not existing["document_no"] and doc_no:
                updates["document_no"] = doc_no
            if not existing.get("document_type") and l.get("document_type"):
                updates["document_type"] = l["document_type"]
            if not existing.get("tenant_number") and l.get("tenant_number"):
                updates["tenant_number"] = str(l["tenant_number"])
            if not existing["unit_type"] and unit_type:
                updates["unit_type"] = unit_type
            if not existing["sub_location"] and sub_loc:
                updates["sub_location"] = sub_loc
            if not existing["property_id"] and prop_id:
                updates["property_id"] = prop_id

            if updates:
                updates["updated_at"] = datetime.utcnow()
                set_clause = ", ".join(f"{k}=%s" for k in updates)
                c.execute(f"UPDATE customers SET {set_clause} WHERE id=%s",
                         (*updates.values(), existing["id"]))
                updated += 1
            else:
                skipped += 1
        else:
            # Insert new
            c.execute("""INSERT INTO customers
                (brand_name,legal_name,unit_code,unit_type,sub_location,property_id,
                 document_no,document_type,tenant_number,source)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                (brand, legal, unit, unit_type, sub_loc, prop_id, doc_no,
                 l.get("document_type") or "", str(l.get("tenant_number") or ""), "rent_roll"))
            added += 1

    log_activity(conn, current_user["id"], "imported from rent roll", "customer",
                 str(property_id), f"added={added} updated={updated} skipped={skipped}")
    conn.commit(); conn.close()
    return {"ok": True, "added": added, "updated": updated, "skipped": skipped}

@app.get("/rent-roll/{property_id}/history")
def get_rent_roll_history(property_id: int, current_user=Depends(get_current_user)):
    """Full upload history for a property with change deltas"""
    conn = get_db(); c = conn.cursor()
    c.execute("""
        SELECT u.*, usr.full_name as uploaded_by_name
        FROM rent_roll_uploads u
        JOIN ca_users usr ON u.uploaded_by=usr.id
        WHERE u.property_id=%s
        ORDER BY u.sub_location, u.upload_date DESC
    """, (property_id,))
    rows = [dict(r) for r in c.fetchall()]

    # Group by sub_location and compute deltas
    from collections import defaultdict
    by_sub = defaultdict(list)
    for r in rows:
        by_sub[r["sub_location"]].append(r)

    result = []
    for sub, uploads in by_sub.items():
        for i, upload in enumerate(uploads):
            prev = uploads[i+1] if i+1 < len(uploads) else None
            entry = {
                "id": upload["id"],
                "sub_location": upload["sub_location"],
                "filename": upload["filename"],
                "report_date": upload["report_date"],
                "upload_date": upload["upload_date"].isoformat() if upload["upload_date"] else None,
                "uploaded_by_name": upload["uploaded_by_name"],
                "active_leases": upload["active_leases"],
                "unique_tenants": upload["unique_tenants"],
                "total_gla": float(upload["total_gla"] or 0),
                "annualized_rent": float(upload["annualized_rent"] or 0),
                "monthly_rent": float(upload["monthly_rent"] or 0),
                "monthly_sc": float(upload["monthly_sc"] or 0),
                "expiry_0_1yr": upload["expiry_0_1yr"],
                "is_latest": i == 0,
                # Deltas vs previous upload
                "delta_leases": upload["active_leases"] - prev["active_leases"] if prev else None,
                "delta_gla": float(upload["total_gla"] or 0) - float(prev["total_gla"] or 0) if prev else None,
                "delta_rent": float(upload["annualized_rent"] or 0) - float(prev["annualized_rent"] or 0) if prev else None,
            }
            result.append(entry)

    # Sort: latest first overall
    result.sort(key=lambda x: x["upload_date"] or "", reverse=True)
    conn.close()
    return result

@app.get("/invoice-recon/available-months")
def get_available_months(property_id: int, sub_location: str = None,
                         current_user=Depends(get_current_user)):
    """Get distinct months available in invoice lines for a property"""
    conn = get_db(); c = conn.cursor()
    q = """SELECT DISTINCT TO_CHAR(DATE_TRUNC('month', ps_due_date), 'YYYY-MM') as month
           FROM invoice_lines
           WHERE property_id=%s AND ps_due_date IS NOT NULL"""
    params = [property_id]
    if sub_location:
        q += " AND sub_location=%s"; params.append(sub_location)
    q += " ORDER BY month"
    c.execute(q, params)
    rows = [r["month"] for r in c.fetchall()]
    conn.close()
    return rows

# ── Documentation ────────────────────────────────────────────────────────────
@app.post("/sop/upload")
async def upload_sop(
    version: str = Form(default=""),
    description: str = Form(default=""),
    file: UploadFile = File(...),
    current_user=Depends(require_admin)
):
    content = await file.read()
    file_b64 = base64.b64encode(content).decode()
    conn = get_db(); c = conn.cursor()
    c.execute("""INSERT INTO sop_documents (filename,version,description,file_data,file_size,uploaded_by)
                 VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
              (file.filename, version, description, file_b64, len(content), current_user["id"]))
    new_id = c.fetchone()["id"]
    log_activity(conn, current_user["id"], "uploaded SOP", "document", file.filename, f"v{version}")
    conn.commit(); conn.close()
    return {"ok": True, "id": new_id}

@app.get("/sop/documents")
def list_sop_documents(current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("""SELECT id, filename, version, description, file_size, upload_date,
                        u.full_name as uploaded_by_name, is_active
                 FROM sop_documents s JOIN ca_users u ON s.uploaded_by=u.id
                 WHERE s.is_active=TRUE ORDER BY s.upload_date DESC""")
    rows = [dict(r) for r in c.fetchall()]
    conn.close(); return rows

@app.get("/sop/download/{doc_id}")
def download_sop(doc_id: int, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT filename, file_data FROM sop_documents WHERE id=%s AND is_active=TRUE", (doc_id,))
    row = c.fetchone(); conn.close()
    if not row: raise HTTPException(404, "Document not found")
    from fastapi.responses import Response
    file_bytes = base64.b64decode(row["file_data"])
    return Response(content=file_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": f'attachment; filename="{row["filename"]}"'})

@app.delete("/sop/{doc_id}")
def delete_sop(doc_id: int, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE sop_documents SET is_active=FALSE WHERE id=%s", (doc_id,))
    log_activity(conn, admin["id"], "deleted SOP", "document", str(doc_id))
    conn.commit(); conn.close(); return {"ok": True}

@app.get("/guide")
def get_guide(current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM portal_guide ORDER BY order_index")
    rows = [dict(r) for r in c.fetchall()]
    conn.close(); return rows

@app.post("/guide")
def create_guide_section(data: dict, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("""INSERT INTO portal_guide (section,title,content,order_index,created_by)
                 VALUES (%s,%s,%s,%s,%s) RETURNING id""",
              (data["section"], data["title"], data["content"],
               data.get("order_index",99), admin["id"]))
    new_id = c.fetchone()["id"]
    conn.commit(); conn.close(); return {"id": new_id}

@app.patch("/guide/{guide_id}")
def update_guide_section(guide_id: int, data: dict, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    allowed = {k:v for k,v in data.items() if k in ("title","content","order_index")}
    allowed["updated_by"] = admin["id"]
    allowed["updated_at"] = datetime.utcnow()
    set_clause = ", ".join(f"{k}=%s" for k in allowed)
    c.execute(f"UPDATE portal_guide SET {set_clause} WHERE id=%s", (*allowed.values(), guide_id))
    conn.commit(); conn.close(); return {"ok": True}

@app.delete("/guide/{guide_id}")
def delete_guide_section(guide_id: int, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("DELETE FROM portal_guide WHERE id=%s", (guide_id,))
    conn.commit(); conn.close(); return {"ok": True}

# ── Financial Annex ───────────────────────────────────────────────────────────
@app.post("/annex/extract")
async def extract_annex_data(data: dict, current_user=Depends(require_editor)):
    """Use Claude to extract deal data from free-text input"""
    text = data.get("text", "").strip()
    if not text:
        raise HTTPException(400, "No text provided")

    prompt = """You are a real estate financial analyst at Savills Egypt.
Extract the following fields from the lease deal description below and return ONLY valid JSON.
If a field is not mentioned, use null.

Fields to extract:
{
  "tenant_name": "string — tenant/brand name",
  "unit": "string — unit number or code",
  "project": "string — project/mall name",
  "lease_start": "YYYY-MM-DD — lease commencement date",
  "num_years": integer,
  "base_monthly": float — base monthly rent EGP (Year 1, excluding VAT),
  "escalation": float — annual escalation rate as decimal (e.g. 0.10 for 10%),
  "sc_monthly_y1": float — Year 1 monthly service charge EGP,
  "sc_per_sqm": float or null — SC rate per sqm if mentioned,
  "area_sqm": float or null — total area sqm,
  "vat_rent": float — VAT on rent as decimal (default 0.01 per Law 157/2025),
  "vat_sc": float — VAT on SC as decimal (default 0.14),
  "revenue_share_years": integer — number of Revenue Share years at start (default 0),
  "marketing_rate": float or null — marketing charges as decimal (e.g. 0.05 for 5% of annual rent), null if not mentioned,
  "notes": "string — any important notes or assumptions made"
}

Deal description:
""" + text

    # Prioritize Google Gemini Direct API (GEMINI_API_KEY)
    gemini_key     = os.getenv("GEMINI_API_KEY", "")
    openrouter_key = os.getenv("OPENROUTER_API_KEY", "")

    if gemini_key:
        success = False
        content = ""
        
        # We'll try the most likely candidates directly first to save time
        # Standard model IDs for Gemini 1.5 Pro and 2.0 Flash/Pro
        candidates = [
            "gemini-1.5-pro",
            "gemini-2.0-flash-001",
            "gemini-2.0-flash",
            "gemini-1.5-flash"
        ]
        
        for model_id in candidates:
            # Try both v1 and v1beta
            for ver in ["v1", "v1beta"]:
                try:
                    url = f"https://generativelanguage.googleapis.com/{ver}/models/{model_id}:generateContent?key={gemini_key}"
                    resp = httpx.post(url, json={
                        "contents": [{"parts": [{"text": prompt}]}],
                        "generationConfig": {"maxOutputTokens": 2000, "temperature": 0.1}
                    }, timeout=60)
                    if resp.status_code == 200:
                        content = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                        success = True
                        break
                except: continue
            if success: break

        if not success:
            # Last ditch effort: Try to list models and find anything with 'gemini' and 'generateContent'
            try:
                list_url = f"https://generativelanguage.googleapis.com/v1beta/models?key={gemini_key}"
                list_resp = httpx.get(list_url, timeout=10)
                if list_resp.status_code == 200:
                    available = list_resp.json().get("models", [])
                    # Filter for models that support generateContent and have 'gemini' in name
                    viable = [m["name"] for m in available if "generateContent" in m.get("supportedGenerationMethods", []) and "gemini" in m["name"].lower()]
                    if viable:
                        # Use the first viable model (usually Pro is listed before Flash, but we'll take what we can get)
                        target = viable[0] # e.g. "models/gemini-1.5-flash"
                        url = f"https://generativelanguage.googleapis.com/v1beta/{target}:generateContent?key={gemini_key}"
                        resp = httpx.post(url, json={
                            "contents": [{"parts": [{"text": prompt}]}],
                            "generationConfig": {"maxOutputTokens": 2000, "temperature": 0.1}
                        }, timeout=60)
                        if resp.status_code == 200:
                            content = resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
                            success = True
            except: pass

        if not success:
            raise HTTPException(500, f"Gemini API error: No working models found for your API key. Please check your Google AI Studio billing/quota.")

    elif openrouter_key:
        resp = httpx.post("https://openrouter.ai/api/v1/chat/completions",
            headers={"Authorization": f"Bearer {openrouter_key}",
                     "Content-Type": "application/json"},
            json={"model": "google/gemini-pro-1.5",
                  "max_tokens": 1000,
                  "messages": [{"role": "user", "content": prompt}]},
            timeout=30)
        if resp.status_code != 200:
            raise HTTPException(500, f"OpenRouter AI error: {resp.text[:200]}")
        content = resp.json()["choices"][0]["message"]["content"].strip()

    else:
        raise HTTPException(500, "No AI API key configured — set OPENROUTER_API_KEY or GEMINI_API_KEY in Railway")
    # Robust cleaning of AI response
    import re
    content = content.strip()
    
    # Remove markdown code blocks (```json ... ``` or ``` ... ```)
    if "```" in content:
        matches = re.findall(r'```(?:json)?\s*([\s\S]*?)\s*```', content)
        if matches:
            content = matches[0].strip()
        else:
            # Fallback: just strip lines with backticks
            lines = content.splitlines()
            content = "\n".join([l for l in lines if not l.strip().startswith("```")]).strip()

    # Isolate JSON object by finding first '{' and last '}'
    start = content.find('{')
    end = content.rfind('}')
    if start != -1 and end != -1 and end > start:
        content = content[start:end+1]

    try:
        # Standard parse
        extracted = json.loads(content)
    except Exception as e:
        # If parsing fails, try to fix common JSON issues like unescaped newlines
        try:
            # This regex looks for strings in JSON and replaces actual newlines with \n
            fixed_content = re.sub(r'(?<=: ")(.*?)(?=",|(?="\s*\}))', 
                                   lambda m: m.group(1).replace('\n', '\\n').replace('\r', '\\r'), 
                                   content, flags=re.DOTALL)
            extracted = json.loads(fixed_content)
        except:
            # If all fails, provide the raw content for debugging
            raise HTTPException(500, f"Could not parse AI response: {str(e)}\nContent: {content[:200]}")

    return {"ok": True, "data": extracted}


@app.post("/annex/generate")
async def generate_annex(data: dict, current_user=Depends(require_editor)):
    """Generate Excel financial annex from structured data"""
    from datetime import date as dt_date
    import base64, io

    try:
        lease_start_str = data.get("lease_start", "")
        if isinstance(lease_start_str, str):
            from datetime import datetime
            lease_start = datetime.strptime(lease_start_str, "%Y-%m-%d").date()
        else:
            lease_start = dt_date.today()

        annex_data = {
            "tenant_name":          data.get("tenant_name", "Tenant"),
            "unit":                 data.get("unit", "—"),
            "project":              data.get("project", "—"),
            "lease_start":          lease_start,
            "num_years":            int(data.get("num_years", 5)),
            "base_monthly":         float(data.get("base_monthly", 0)),
            "escalation":           float(data.get("escalation", 0.10)),
            "sc_monthly_y1":        float(data.get("sc_monthly_y1", 0)),
            "sc_escalation":        float(data.get("sc_escalation", data.get("escalation", 0.10))),
            "vat_rent":             float(data.get("vat_rent", 0.01)),
            "vat_sc":               float(data.get("vat_sc", 0.14)),
            "revenue_share_years":  int(data.get("revenue_share_years", 0)),
            "marketing_rate":       float(data.get("marketing_rate") or 0),
        }

        # Build Excel in memory
        import sys, os
        for path in ["/app", os.path.dirname(os.path.abspath(__file__)), "."]:
    if path not in sys.path: sys.path.insert(0, path)
        from build_annex import build_annex

        tmp_path = f"/tmp/annex_{current_user['id']}_{int(__import__('time').time())}.xlsx"
        years, deposit = build_annex(annex_data, tmp_path)

        with open(tmp_path, "rb") as f:
            file_bytes = f.read()
        os.remove(tmp_path)

        file_b64 = base64.b64encode(file_bytes).decode()
        filename = f"Financial_Annex_{annex_data['tenant_name'].replace(' ','_')}_{annex_data['project'][:10].replace(' ','_')}.xlsx"

        log_activity(conn := get_db(), current_user["id"],
                     "generated annex", "document",
                     annex_data["tenant_name"], annex_data["project"])
        conn.commit(); conn.close()

        return {"ok": True, "filename": filename,
                "file_b64": file_b64,
                "summary": {
                    "years": [{k: v for k,v in y.items() if k != "label"} for y in years],
                    "deposit": deposit
                }}

    except Exception as e:
        raise HTTPException(500, f"Annex generation error: {e}")


@app.get("/pbi/embed-token/{report_id}")
async def get_embed_token(report_id: str, workspace_id: str = PBI_WORKSPACE_ID, current_user=Depends(get_current_user)):
    try:
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token",
                data={"grant_type":"client_credentials","client_id":AZURE_CLIENT_ID,"client_secret":AZURE_CLIENT_SECRET,"scope":"https://analysis.windows.net/powerbi/api/.default"})
            if token_resp.status_code != 200: raise HTTPException(500, f"Azure token error: {token_resp.text}")
            access_token = token_resp.json()["access_token"]
            embed_resp = await client.post(f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}/GenerateToken",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"}, json={"accessLevel": "View"})
            if embed_resp.status_code != 200: raise HTTPException(500, f"PBI embed error: {embed_resp.text}")
            embed_data = embed_resp.json()
            report_resp = await client.get(f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}",
                headers={"Authorization": f"Bearer {access_token}"})
            report_data = report_resp.json()
            return {"token": embed_data["token"], "tokenId": embed_data["tokenId"], "expiration": embed_data["expiration"],
                    "embedUrl": report_data.get("embedUrl",""), "reportId": report_id}
    except HTTPException: raise
    except Exception as e: raise HTTPException(500, str(e))
