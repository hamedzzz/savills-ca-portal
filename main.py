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
SENDGRID_API_KEY = os.getenv("SENDGRID_API_KEY", "")
PORTAL_URL = os.getenv("PORTAL_URL", "https://savills-ca-portal.vercel.app")

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
    LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48dGl0bGU+U2F2aWxscyBMb2dvPC90aXRsZT48ZyBmaWxsPSJub25lIj48cGF0aCBmaWxsPSIjZmVkZTA3IiBkPSJNMTAwIDBIMHYxMDBoMTAweiIvPjxwYXRoIGQ9Ik0xNC41NzYgOTMuNjMzYy01LjExNCAwLTguNTgyLTIuNjItOC41ODItNy40ODV2LS4xODdIOC44di4xMjVjMCAzLjE4IDIuMzA3IDUuMDUyIDUuOCA1LjA1MiAxLjg3MSAwIDUuNDI2LS44MSA1LjQyNi0zLjgwNCAwLTUuODAxLTEzLjM0Ny0xLjY4NS0xMy4zNDctOS45OCAwLTQuMTggMy44OTItNi4wNSA3Ljc1OS02LjA1IDQuNTUzIDAgNy42NDYgMi42MiA3LjY0NiA2Ljg2di4xODhIMTkuMjh2LS4xODdjMC0yLjc0NS0xLjkzMy00LjM2Ni01LjA1Mi00LjM2Ni0yLjE4MyAwLTQuNzQuOTM2LTQuNzQgMy40MyAwIDUuNDI2IDEzLjM0NyAxLjYyMiAxMy4zNDcgOS45OCAwIDQuNDI4LTQuMTQgNi40MjQtOC4yNTcgNi40MjRNMzguOCA4Mi4wMzJjLS40MzUuMzc0LTEuNDk2LjU2Mi0yLjA1OC42MjRsLTEuOTk1LjI1Yy0zLjc0My40MzYtNy4yMzUgMS4xODQtNy4yMzUgNC40MjggMCAyLjY4MiAyLjMwNyAzLjgwNCA0LjM2NSAzLjgwNCAyLjEyMSAwIDMuOTkyLS43NDggNS4zMDItMi4wNTggMS4wNi0xLjEyMyAxLjYyMi0yLjYyIDEuNjIyLTQuMjQxdi0yLjgwN3ptLjUgMTAuOTc3Yy0uMzEzLTEuMTIzLS4zMTMtMy4zNjgtLjMxMy0zLjM2OC0xLjA2IDIuMzA4LTMuNDkyIDMuOTkyLTcuMjk2IDMuOTkyLTQuMzY2IDAtNi45ODYtMi4zNy02Ljk4Ni02LjIzNyAwLTUuNjE0IDUuMDUxLTYuMTc2IDkuOTgtNi43MzZsMS4wNi0uMTI1YzEuOTk1LS4yNSAzLjA1Ni0uNSAzLjA1Ni0yLjY4MyAwLTIuODA3LTEuNjIyLTQuMDU0LTUuMTE0LTQuMDU0LTIuOTMyIDAtNS4zMDIgMS4yNDctNS4zMDIgNC40Mjl2LjE4N2gtMi44MDd2LS4xODdjMC00LjkyNyAzLjkzLTYuOTIzIDguNDItNi45MjMgNC44NjUgMCA3LjY2IDEuOTMzIDcuNjYgNi40ODZ2MTEuNDc3YzAgLjk5OC4xNzYgMy4xMi40MjYgMy43NDJoLTIuNzg1em0yMC42NDQtMjEuMDgyaC4yNUw1Mi45NiA5My4wMDloLTMuMDU2bC03LjQ4Ni0yMS4wODJoMy4yNTVsNS43OSAxNy44NjQgNS43MjktMTcuODY0em01LjAyMi01LjU0OUExLjk3MSAxLjk3MSAwIDAgMCA2MyA2NC40MTNjLTEuMDQ4IDAtMS45NjUuODUxLTEuOTY1IDEuODk5QTEuOTcgMS45NyAwIDAgMCA2MyA2OC4yNzdhMS45NyAxLjk3IDAgMCAwIDEuOTY1LTEuOTY1di4wNjZ6bS0zLjQgNS41NDloMi45MzJ2MjEuMDgyaC0yLjkzMnptNS44MDEtNy45ODRoMi45MzFWOTMuMDFoLTIuOTN6bTUuNzM5IDBoMi45MzJWOTMuMDFoLTIuOTMyem0xMy4xOTcgMjkuNjljLTUuMTc3IDAtOC42NDUtMi42Mi04LjY0NS03LjQ4NXYtLjE4N2gyLjgwN3YuMTI1YzAgMy4xOCAyLjM3IDUuMDUyIDUuOCA1LjA1MiAxLjg3MSAwIDUuNDktLjgxIDUuNDktMy44MDQgMC01LjgwMS0xMy40MS0xLjY4NS0xMy40MS05Ljk4IDAtNC4xOCAzLjg5Mi02LjA1IDcuNzU4LTYuMDUgNC42MTYgMCA3LjcxIDIuNjIgNy43MSA2Ljg2di4xODhoLTIuODA3di0uMTg3YzAtMi43NDUtMS45MzMtNC4zNjYtNS4wNTItNC4zNjYtMi4yNDUgMC00LjgwMy45MzYtNC44MDMgMy40MyAwIDUuNDI2IDEzLjQxIDEuNjIyIDEzLjQxIDkuOTggMCA0LjQyOC00LjE0IDYuNDI0LTguMjU3IDYuNDI0IiBmaWxsPSIjYzgwYzBmIi8+PC9nPjwvc3ZnPg=="

    rows_html = ""
    for r in rows:
        coll_rate = round(float(r["total_collection"]) / float(r["total_invoices"]) * 100, 1) if r["total_invoices"] else 0
        if coll_rate >= 90:
            rate_color = "#2CA01C"; rate_bg = "#F2FBF0"; rate_border = "#B7E5B0"
        elif coll_rate >= 70:
            rate_color = "#B45309"; rate_bg = "#FFFBEB"; rate_border = "#FDE68A"
        else:
            rate_color = "#C80C0F"; rate_bg = "#FEF2F2"; rate_border = "#FECACA"

        rows_html += f"""
        <tr style="border-bottom:1px solid #F3F4F6">
          <td style="padding:14px 20px;font-size:14px;font-weight:500;color:#1C1C1C;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">{r["property_name"]}</td>
          <td style="padding:14px 20px;text-align:right;font-size:14px;color:#57647A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">EGP&nbsp;{fmt_num(r["total_invoices"])}</td>
          <td style="padding:14px 20px;text-align:right;font-size:14px;color:#57647A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">EGP&nbsp;{fmt_num(r["total_collection"])}</td>
          <td style="padding:14px 20px;text-align:right;font-size:14px;color:#57647A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">EGP&nbsp;{fmt_num(r["total_revenue_share"])}</td>
          <td style="padding:14px 20px;text-align:center">
            <span style="display:inline-block;background:{rate_bg};color:{rate_color};border:1px solid {rate_border};border-radius:20px;padding:3px 10px;font-size:13px;font-weight:600">{coll_rate}%</span>
          </td>
        </tr>"""

    notes_block = f"""
        <tr><td colspan="5" style="padding:0 32px 20px 32px">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#FFFBF0;border:1px solid #FDE68A;border-radius:8px">
            <tr><td style="padding:14px 18px;font-size:13px;color:#57647A;line-height:1.6">
              <strong style="color:#1C1C1C;display:block;margin-bottom:4px">Note</strong>{notes}
            </td></tr>
          </table>
        </td></tr>""" if notes else ""

    return f"""<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>Collection Update — {month}</title></head>
<body style="margin:0;padding:0;background:#F4F5F7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F4F5F7;padding:32px 16px">
  <tr><td align="center">
  <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;border:1px solid #E3E8EF;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08)">
    <tr><td style="background:#FEDE07;height:5px;font-size:0">&nbsp;</td></tr>
    <tr>
      <td style="padding:24px 32px;border-bottom:1px solid #F4F5F7">
        <table cellpadding="0" cellspacing="0"><tr>
          <td><img src="{LOGO}" alt="Savills" width="44" height="44" style="display:block;border-radius:4px" /></td>
          <td style="padding-left:12px;vertical-align:middle">
            <div style="font-size:10px;color:#8C96A3;letter-spacing:0.8px;text-transform:uppercase">Client Accounting Portal</div>
          </td>
        </tr></table>
      </td>
    </tr>
    <tr><td style="padding:28px 32px 0 32px">
      <div style="font-size:11px;font-weight:600;color:#8C96A3;letter-spacing:.1em;text-transform:uppercase;margin-bottom:8px">Collection Report</div>
      <div style="font-size:26px;font-weight:700;color:#1C1C1C;margin-bottom:10px">Collection Update — {month}</div>
      <div style="font-size:14px;color:#57647A;line-height:1.6">Please find below the collection performance summary for the above period.</div>
    </td></tr>
    <tr><td style="padding:20px 32px 20px 32px"><div style="height:2px;background:linear-gradient(to right,#C80C0F,#FEDE07);border-radius:2px"></div></td></tr>
    {notes_block}
    <tr><td style="padding:0 32px 0 32px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E3E8EF;border-radius:8px;overflow:hidden;border-collapse:separate;border-spacing:0">
        <tr style="background:#F8F9FA">
          <th style="padding:11px 20px;text-align:left;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E3E8EF">Property</th>
          <th style="padding:11px 20px;text-align:right;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E3E8EF">Total Invoices</th>
          <th style="padding:11px 20px;text-align:right;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E3E8EF">Collection</th>
          <th style="padding:11px 20px;text-align:right;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E3E8EF">Revenue Share</th>
          <th style="padding:11px 20px;text-align:center;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid #E3E8EF">Rate</th>
        </tr>
        {rows_html}
      </table>
    </td></tr>
    <tr><td style="padding:24px 32px">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8F9FA;border:1px solid #E3E8EF;border-radius:8px">
        <tr><td style="padding:20px 24px">
          <div style="font-size:14px;font-weight:600;color:#1C1C1C;margin-bottom:6px">View Detailed Reports</div>
          <div style="font-size:13px;color:#57647A;margin-bottom:16px">Access full collection data, historical trends, and Power BI dashboards on the Client Accounting Portal.</div>
          <a href="{portal_url}" style="display:inline-block;background:#C80C0F;color:#ffffff;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600">Access Portal &rarr;</a>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:0 32px 28px 32px;border-top:1px solid #F4F5F7">
      <table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-top:20px;font-size:12px;color:#8C96A3;line-height:1.6">
          This email was sent from the <strong style="color:#57647A">Savills Egypt CA Portal</strong>.<br>
          Savills Egypt &middot; Client Accounting &middot; Property Management
        </td>
        <td style="padding-top:20px;text-align:right;vertical-align:top">
          <span style="font-size:11px;color:#C4CBD6">Confidential</span>
        </td>
      </tr></table>
    </td></tr>
  </table>
  </td></tr>
</table>
</body></html>"""


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
