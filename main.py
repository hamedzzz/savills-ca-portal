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
    c.execute("""CREATE TABLE IF NOT EXISTS pbi_reports (
        id SERIAL PRIMARY KEY,
        property_id INTEGER REFERENCES properties(id),
        report_name TEXT NOT NULL,
        report_type TEXT NOT NULL,
        pbi_report_id TEXT NOT NULL,
        pbi_workspace_id TEXT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE
    )""")
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

class ReportCreate(BaseModel):
    property_id: int; report_name: str; report_type: str
    pbi_report_id: str; pbi_workspace_id: str = PBI_WORKSPACE_ID

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
    c.execute("""INSERT INTO pbi_reports (property_id,report_name,report_type,pbi_report_id,pbi_workspace_id)
                 VALUES (%s,%s,%s,%s,%s) RETURNING id""",
             (data.property_id, data.report_name, data.report_type, data.pbi_report_id, data.pbi_workspace_id))
    new_id = c.fetchone()["id"]; conn.commit(); conn.close(); return {"id": new_id}

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
