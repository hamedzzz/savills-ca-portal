from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import os, httpx, jwt, bcrypt, psycopg2, psycopg2.extras
from datetime import datetime, timedelta

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# Config
SECRET_KEY = os.getenv("SECRET_KEY", "savills-ca-portal-2026")
DATABASE_URL = os.getenv("DATABASE_URL", "")
AZURE_TENANT_ID = os.getenv("AZURE_TENANT_ID", "6330831d-7629-4e63-8850-6be5d7c5aeef")
AZURE_CLIENT_ID = os.getenv("AZURE_CLIENT_ID", "b567dafc-5c6e-4161-ad01-0dd25dd90363")
AZURE_CLIENT_SECRET = os.getenv("AZURE_CLIENT_SECRET", "")
PBI_WORKSPACE_ID = os.getenv("PBI_WORKSPACE_ID", "a889dfd6-b0ce-49dd-b41d-c79de2dfd0b5")

# DB
def get_db():
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)
    return conn

def init_db():
    conn = get_db(); c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS ca_users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        email TEXT DEFAULT '',
        title TEXT DEFAULT '',
        hashed_password TEXT NOT NULL,
        role TEXT DEFAULT 'viewer',
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW()
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        location TEXT DEFAULT '',
        system TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT TRUE
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS collection_logs (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id),
        month TEXT NOT NULL,
        total_collection NUMERIC DEFAULT 0,
        total_invoices NUMERIC DEFAULT 0,
        total_revenue_share NUMERIC DEFAULT 0,
        notes TEXT DEFAULT '',
        created_by INTEGER NOT NULL REFERENCES ca_users(id),
        created_at TIMESTAMP DEFAULT NOW()
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS email_logs (
        id SERIAL PRIMARY KEY,
        subject TEXT NOT NULL,
        recipients TEXT NOT NULL,
        property_names TEXT NOT NULL,
        month TEXT NOT NULL,
        status TEXT DEFAULT 'sent',
        sent_by INTEGER NOT NULL REFERENCES ca_users(id),
        sent_at TIMESTAMP DEFAULT NOW()
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS user_property_access (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES ca_users(id) ON DELETE CASCADE,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        UNIQUE(user_id, property_id)
    )""")
    c.execute("""CREATE TABLE IF NOT EXISTS pbi_reports (
        id SERIAL PRIMARY KEY,
        property_id INTEGER REFERENCES properties(id),
        report_name TEXT NOT NULL,
        report_type TEXT NOT NULL,
        pbi_report_id TEXT DEFAULT '',
        pbi_workspace_id TEXT DEFAULT '',
        embed_url TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT TRUE
    )""")
    c.execute("""ALTER TABLE pbi_reports ADD COLUMN IF NOT EXISTS embed_url TEXT DEFAULT ''""")
    # Remove duplicate properties (keep lowest id)
    try:
        c.execute("""DELETE FROM properties WHERE id NOT IN (
            SELECT MIN(id) FROM properties GROUP BY name
        )""")
    except: pass
    # Default admin
    try:
        hashed = bcrypt.hashpw("123456".encode(), bcrypt.gensalt()).decode()
        c.execute("""INSERT INTO ca_users (username,full_name,email,title,hashed_password,role)
                     VALUES ('ahmed.hamed','Ahmed Hamed','ahmed.hamed@savills.me',
                     'Associate Director - Property Finance',%s,'admin')
                     ON CONFLICT (username) DO NOTHING""", (hashed,))
        # Default properties
        for name, loc, sys in [
            ("Arkan","6th of October","Oracle"),
            ("Royal Park","New Cairo","Yardi"),
            ("Majarrah","New Cairo","Yardi"),
            ("205","Downtown","Oracle"),
        ]:
            c.execute("INSERT INTO properties (name,location,system) VALUES (%s,%s,%s) ON CONFLICT DO NOTHING",
                     (name,loc,sys))
    except: pass
    conn.commit(); conn.close()
    print("CA Portal DB initialized")

@app.on_event("startup")
def startup(): init_db()

@app.get("/health")
def health(): return {"ok": True}

# Auth
def hash_password(p): return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()
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
    if user["role"] != "admin": raise HTTPException(403)
    return user

class LoginData(BaseModel):
    username: str; password: str

class UserCreate(BaseModel):
    username: str; full_name: str; email: str = ""; title: str = ""; password: str; role: str = "viewer"

class UserUpdate(BaseModel):
    full_name: Optional[str]=None; email: Optional[str]=None
    title: Optional[str]=None; role: Optional[str]=None; password: Optional[str]=None

class PropertyCreate(BaseModel):
    name: str; location: str = ""; system: str = ""

class CollectionLogCreate(BaseModel):
    property_id: int; month: str
    total_collection: float = 0; total_invoices: float = 0
    total_revenue_share: float = 0; notes: str = ""

class CollectionEmailSend(BaseModel):
    property_ids: list; month: str
    collections: dict  # property_id -> {collection, invoices, revenue_share}
    recipient_user_ids: list; notes: str = ""

class ReportCreate(BaseModel):
    property_id: int; report_name: str; report_type: str
    pbi_report_id: str = ""; pbi_workspace_id: str = ""
    embed_url: str = ""

class ReportUpdate(BaseModel):
    report_name: Optional[str]=None; report_type: Optional[str]=None
    embed_url: Optional[str]=None; pbi_report_id: Optional[str]=None

# ── Auth ──────────────────────────────────────────────────────────────────────
@app.post("/auth/login")
def login(data: LoginData):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM ca_users WHERE username=%s AND is_active=TRUE", (data.username,))
    user = c.fetchone(); conn.close()
    if not user or not verify_password(data.password, user["hashed_password"]):
        raise HTTPException(401, "Invalid credentials")
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
    conn.commit(); conn.close()
    return {"ok": True}

# ── Users ─────────────────────────────────────────────────────────────────────
@app.get("/users")
def list_users(admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT id,username,full_name,email,title,role,is_active FROM ca_users ORDER BY id")
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.post("/users", status_code=201)
def create_user(data: UserCreate, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    try:
        c.execute("INSERT INTO ca_users (username,full_name,email,title,hashed_password,role) VALUES (%s,%s,%s,%s,%s,%s) RETURNING id",
                 (data.username, data.full_name, data.email, data.title, hash_password(data.password), data.role))
        new_id = c.fetchone()["id"]; conn.commit(); conn.close()
        return {"id": new_id}
    except: raise HTTPException(400, "Username already exists")

@app.patch("/users/{user_id}")
def update_user(user_id: int, data: UserUpdate, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    fields = {k: v for k, v in data.dict().items() if v is not None}
    if "password" in fields: fields["hashed_password"] = hash_password(fields.pop("password"))
    if not fields: raise HTTPException(400, "Nothing to update")
    set_clause = ", ".join(f"{k}=%s" for k in fields)
    c.execute(f"UPDATE ca_users SET {set_clause} WHERE id=%s", (*fields.values(), user_id))
    conn.commit(); conn.close(); return {"ok": True}

@app.delete("/users/{user_id}")
def delete_user(user_id: int, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("DELETE FROM ca_users WHERE id=%s", (user_id,))
    conn.commit(); conn.close(); return {"ok": True}

# ── Properties ────────────────────────────────────────────────────────────────
@app.get("/properties")
def list_properties(archived: bool = False, current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM properties WHERE is_active=%s ORDER BY id", (not archived,))
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.post("/properties", status_code=201)
def create_property(data: PropertyCreate, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("INSERT INTO properties (name,location,system) VALUES (%s,%s,%s) RETURNING id",
             (data.name, data.location, data.system))
    new_id = c.fetchone()["id"]; conn.commit(); conn.close(); return {"id": new_id}

@app.patch("/properties/{prop_id}")
def update_property(prop_id: int, data: dict, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    allowed = {k: v for k, v in data.items() if k in ("name","location","system","is_active")}
    if not allowed: raise HTTPException(400, "Nothing to update")
    set_clause = ", ".join(f"{k}=%s" for k in allowed)
    c.execute(f"UPDATE properties SET {set_clause} WHERE id=%s", (*allowed.values(), prop_id))
    conn.commit(); conn.close(); return {"ok": True}

@app.delete("/properties/{prop_id}")
def delete_property(prop_id: int, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("DELETE FROM properties WHERE id=%s", (prop_id,))
    conn.commit(); conn.close(); return {"ok": True}

@app.get("/properties/archived")
def list_archived(admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("SELECT * FROM properties WHERE is_active=FALSE ORDER BY id")
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

# ── PBI Reports ───────────────────────────────────────────────────────────────
@app.get("/reports")
def list_reports(current_user=Depends(get_current_user)):
    conn = get_db(); c = conn.cursor()
    c.execute("""SELECT r.*,p.name as property_name FROM pbi_reports r
                 JOIN properties p ON r.property_id=p.id
                 WHERE r.is_active=TRUE ORDER BY r.property_id,r.id""")
    rows = [dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.post("/reports", status_code=201)
def create_report(data: ReportCreate, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("""INSERT INTO pbi_reports (property_id,report_name,report_type,pbi_report_id,pbi_workspace_id,embed_url)
                 VALUES (%s,%s,%s,%s,%s,%s) RETURNING id""",
             (data.property_id, data.report_name, data.report_type, data.pbi_report_id, data.pbi_workspace_id, data.embed_url))
    new_id = c.fetchone()["id"]; conn.commit(); conn.close(); return {"id": new_id}


@app.patch("/reports/{report_id}")
def update_report(report_id: int, data: ReportUpdate, admin=Depends(require_admin)):
    conn=get_db(); c=conn.cursor()
    fields={k:v for k,v in data.dict().items() if v is not None}
    if not fields: raise HTTPException(400,"Nothing to update")
    set_clause=", ".join(f"{k}=%s" for k in fields)
    c.execute(f"UPDATE pbi_reports SET {set_clause} WHERE id=%s",(*fields.values(),report_id))
    conn.commit(); conn.close(); return {"ok":True}


# ── Collection ────────────────────────────────────────────────────────────────
def fmt_num(n):
    """Format number with commas"""
    try: return f"{float(n):,.2f}"
    except: return str(n)

def send_collection_email(to_email: str, to_name: str, subject: str, html_body: str):
    if not SENDGRID_API_KEY: return False
    try:
        resp = httpx.post(
            "https://api.sendgrid.com/v3/mail/send",
            headers={"Authorization": f"Bearer {SENDGRID_API_KEY}", "Content-Type": "application/json"},
            json={"personalizations": [{"to": [{"email": to_email, "name": to_name}]}],
                  "from": {"email": "ahmed.hamed@savills.me", "name": "Savills Egypt — Client Accounting"},
                  "subject": subject, "content": [{"type": "text/html", "value": html_body}]},
            timeout=10
        )
        return resp.status_code == 202
    except Exception as e:
        print(f"Email error: {e}"); return False

def build_collection_email(month: str, rows: list, notes: str, portal_url: str) -> str:
    rows_html = ""
    for r in rows:
        coll_rate = round(float(r["total_collection"]) / float(r["total_invoices"]) * 100, 1) if r["total_invoices"] else 0
        rows_html += f"""
        <tr>
            <td style="padding:12px 16px;border-bottom:1px solid #f0ede8;font-weight:500;color:#111">{r["property_name"]}</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0ede8;text-align:right;color:#111">EGP {fmt_num(r["total_invoices"])}</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0ede8;text-align:right;color:#111">EGP {fmt_num(r["total_collection"])}</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0ede8;text-align:right;color:#111">EGP {fmt_num(r["total_revenue_share"])}</td>
            <td style="padding:12px 16px;border-bottom:1px solid #f0ede8;text-align:right;color:{'#3B6D11' if coll_rate >= 90 else '#854F0B' if coll_rate >= 70 else '#A32D2D'};font-weight:500">{coll_rate}%</td>
        </tr>"""

    notes_section = f"""<div style="background:#f5f4f0;border-radius:8px;padding:16px;margin:24px 0;font-size:14px;color:#444">{notes}</div>""" if notes else ""

    return f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:0 auto;background:#fff">
      <div style="background:#111;padding:24px 32px;border-radius:8px 8px 0 0">
        <div style="display:flex;align-items:center;gap:12px">
          <div style="width:36px;height:36px;background:#F5B800;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;color:#111">S</div>
          <div>
            <div style="color:#fff;font-size:16px;font-weight:600">Savills Egypt</div>
            <div style="color:#888;font-size:12px">Client Accounting · Property Management</div>
          </div>
        </div>
      </div>
      <div style="padding:32px">
        <h2 style="margin:0 0 8px;color:#111;font-size:20px">Collection Update — {month}</h2>
        <p style="color:#666;font-size:14px;margin:0 0 24px">Please find below the collection performance summary for the above period.</p>
        {notes_section}
        <table style="width:100%;border-collapse:collapse;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden">
          <thead>
            <tr style="background:#f5f4f0">
              <th style="padding:12px 16px;text-align:left;font-size:12px;color:#888;font-weight:500;text-transform:uppercase;letter-spacing:.05em">Property</th>
              <th style="padding:12px 16px;text-align:right;font-size:12px;color:#888;font-weight:500;text-transform:uppercase;letter-spacing:.05em">Total Invoices</th>
              <th style="padding:12px 16px;text-align:right;font-size:12px;color:#888;font-weight:500;text-transform:uppercase;letter-spacing:.05em">Collection</th>
              <th style="padding:12px 16px;text-align:right;font-size:12px;color:#888;font-weight:500;text-transform:uppercase;letter-spacing:.05em">Revenue Share</th>
              <th style="padding:12px 16px;text-align:right;font-size:12px;color:#888;font-weight:500;text-transform:uppercase;letter-spacing:.05em">Rate</th>
            </tr>
          </thead>
          <tbody>{rows_html}</tbody>
        </table>
        <div style="margin-top:32px;padding:20px;background:#f5f4f0;border-radius:8px;text-align:center">
          <p style="margin:0 0 12px;color:#444;font-size:14px">View detailed collection reports on the Client Accounting Portal</p>
          <a href="{portal_url}" style="display:inline-block;background:#111;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:500">Access Portal →</a>
          <p style="margin:12px 0 0;color:#888;font-size:12px">Login with your username and password</p>
        </div>
        <div style="margin-top:24px;padding-top:24px;border-top:1px solid #e0e0e0;font-size:12px;color:#aaa;text-align:center">
          Savills Egypt · Client Accounting · Property Management<br>This email was sent from the Savills Egypt CA Portal
        </div>
      </div>
    </div>"""

@app.get("/collection-logs")
def list_collection_logs(property_id: int = None, month: str = None, admin=Depends(require_admin)):
    conn=get_db(); c=conn.cursor()
    q = """SELECT cl.*,p.name as property_name,u.full_name as created_by_name
           FROM collection_logs cl JOIN properties p ON cl.property_id=p.id
           JOIN ca_users u ON cl.created_by=u.id WHERE 1=1"""
    params = []
    if property_id: q += " AND cl.property_id=%s"; params.append(property_id)
    if month: q += " AND cl.month=%s"; params.append(month)
    q += " ORDER BY cl.created_at DESC LIMIT 100"
    c.execute(q, params)
    rows=[dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.get("/email-logs")
def list_email_logs(admin=Depends(require_admin)):
    conn=get_db(); c=conn.cursor()
    c.execute("""SELECT el.*,u.full_name as sent_by_name FROM email_logs el
                 JOIN ca_users u ON el.sent_by=u.id ORDER BY el.sent_at DESC LIMIT 100""")
    rows=[dict(r) for r in c.fetchall()]; conn.close(); return rows

@app.post("/collection/send-email")
def send_collection_email_endpoint(data: CollectionEmailSend, admin=Depends(require_admin)):
    conn=get_db(); c=conn.cursor()

    # Get properties
    c.execute("SELECT id,name FROM properties WHERE id=ANY(%s)", (data.property_ids,))
    props = {p["id"]: p["name"] for p in c.fetchall()}

    # Get recipients
    c.execute("SELECT id,full_name,email FROM ca_users WHERE id=ANY(%s) AND is_active=TRUE", (data.recipient_user_ids,))
    recipients = [dict(r) for r in c.fetchall()]

    # Build rows for email
    email_rows = []
    for pid in data.property_ids:
        cdata = data.collections.get(str(pid), data.collections.get(pid, {}))
        email_rows.append({
            "property_name": props.get(pid, str(pid)),
            "total_invoices": cdata.get("invoices", 0),
            "total_collection": cdata.get("collection", 0),
            "total_revenue_share": cdata.get("revenue_share", 0),
        })
        # Save to collection log
        c.execute("""INSERT INTO collection_logs (property_id,month,total_collection,total_invoices,total_revenue_share,notes,created_by)
                     VALUES (%s,%s,%s,%s,%s,%s,%s)""",
                  (pid, data.month, cdata.get("collection",0), cdata.get("invoices",0),
                   cdata.get("revenue_share",0), data.notes, admin["id"]))

    # Build and send emails
    subject = f"Collection Update — {data.month} | Savills Egypt"
    html = build_collection_email(data.month, email_rows, data.notes, PORTAL_URL)
    sent_to = []
    for r in recipients:
        if r.get("email"):
            ok = send_collection_email(r["email"], r["full_name"], subject, html)
            if ok: sent_to.append(r["full_name"])

    # Log email
    c.execute("""INSERT INTO email_logs (subject,recipients,property_names,month,status,sent_by)
                 VALUES (%s,%s,%s,%s,%s,%s)""",
              (subject, ", ".join(r["full_name"] for r in recipients),
               ", ".join(props.values()), data.month,
               f"Sent to {len(sent_to)} recipients", admin["id"]))

    conn.commit(); conn.close()
    return {"ok": True, "sent_to": sent_to, "logs_saved": len(data.property_ids)}

# User Property Access
@app.get("/user-access")
def get_all_access(admin=Depends(require_admin)):
    conn=get_db(); c=conn.cursor()
    c.execute("SELECT user_id, array_agg(property_id) as property_ids FROM user_property_access GROUP BY user_id")
    rows=c.fetchall(); conn.close()
    return {row["user_id"]: row["property_ids"] for row in rows}

@app.post("/user-access/{user_id}")
def set_user_access(user_id: int, data: dict, admin=Depends(require_admin)):
    conn=get_db(); c=conn.cursor()
    c.execute("DELETE FROM user_property_access WHERE user_id=%s",(user_id,))
    for pid in data.get("property_ids",[]):
        c.execute("INSERT INTO user_property_access (user_id,property_id) VALUES (%s,%s) ON CONFLICT DO NOTHING",(user_id,pid))
    conn.commit(); conn.close(); return {"ok":True}

@app.delete("/reports/{report_id}")
def delete_report(report_id: int, admin=Depends(require_admin)):
    conn = get_db(); c = conn.cursor()
    c.execute("UPDATE pbi_reports SET is_active=FALSE WHERE id=%s", (report_id,))
    conn.commit(); conn.close(); return {"ok": True}

# ── Power BI Embed Token ──────────────────────────────────────────────────────
@app.get("/pbi/embed-token/{report_id}")
async def get_embed_token(report_id: str, workspace_id: str = PBI_WORKSPACE_ID, current_user=Depends(get_current_user)):
    try:
        # Get Azure AD token
        async with httpx.AsyncClient() as client:
            token_resp = await client.post(
                f"https://login.microsoftonline.com/{AZURE_TENANT_ID}/oauth2/v2.0/token",
                data={
                    "grant_type": "client_credentials",
                    "client_id": AZURE_CLIENT_ID,
                    "client_secret": AZURE_CLIENT_SECRET,
                    "scope": "https://analysis.windows.net/powerbi/api/.default"
                }
            )
            if token_resp.status_code != 200:
                raise HTTPException(500, f"Azure token error: {token_resp.text}")
            access_token = token_resp.json()["access_token"]

            # Get embed token from Power BI
            embed_resp = await client.post(
                f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}/GenerateToken",
                headers={"Authorization": f"Bearer {access_token}", "Content-Type": "application/json"},
                json={"accessLevel": "View"}
            )
            if embed_resp.status_code != 200:
                raise HTTPException(500, f"PBI embed error: {embed_resp.text}")

            embed_data = embed_resp.json()
            # Get embed URL
            report_resp = await client.get(
                f"https://api.powerbi.com/v1.0/myorg/groups/{workspace_id}/reports/{report_id}",
                headers={"Authorization": f"Bearer {access_token}"}
            )
            report_data = report_resp.json()

            return {
                "token": embed_data["token"],
                "tokenId": embed_data["tokenId"],
                "expiration": embed_data["expiration"],
                "embedUrl": report_data.get("embedUrl", ""),
                "reportId": report_id
            }
    except HTTPException: raise
    except Exception as e:
        raise HTTPException(500, str(e))
