import { useState, useEffect, useRef } from "react";
import { useAuth } from "../context/AuthContext";

function Avatar({ name, size = 32 }) {
  const initials = name.split(" ").slice(0, 2).map(w => w[0]).join("").toUpperCase();
  const palettes = [["#E6F1FB","#185FA5"],["#E1F5EE","#0F6E56"],["#EEEDFE","#534AB7"],["#FAEEDA","#854F0B"]];
  const [bg, color] = palettes[name.charCodeAt(0) % palettes.length];
  return <div style={{width:size,height:size,borderRadius:"50%",background:bg,color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.36,fontWeight:500,flexShrink:0}}>{initials}</div>;
}

function PBIReport({ reportId, workspaceId, apiUrl, token }) {
  const containerRef = useRef(null);
  const [embedData, setEmbedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!reportId) return;
    setLoading(true); setError(null);
    fetch(`${apiUrl}/pbi/embed-token/${reportId}?workspace_id=${workspaceId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { if (d.detail) throw new Error(d.detail); setEmbedData(d); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [reportId]);

  useEffect(() => {
    if (!embedData || !containerRef.current || !window.powerbi) return;
    const config = {
      type: "report",
      id: embedData.reportId,
      embedUrl: embedData.embedUrl,
      accessToken: embedData.token,
      tokenType: window.models?.TokenType?.Embed ?? 1,
      settings: { navContentPaneEnabled: true, filterPaneEnabled: true }
    };
    window.powerbi.embed(containerRef.current, config);
  }, [embedData]);

  if (loading) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:500,color:"#888",fontSize:13}}>Loading report...</div>;
  if (error) return <div style={{display:"flex",alignItems:"center",justifyContent:"center",height:500,color:"#A32D2D",fontSize:13}}>Error: {error}</div>;
  return <div ref={containerRef} style={{width:"100%",height:600,border:"none"}}/>;
}

export default function Portal() {
  const { user, logout, apiFetch, isAdmin, API } = useAuth();
  const [tab, setTab] = useState("properties");
  const [properties, setProperties] = useState([]);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedProp, setSelectedProp] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [newReport, setNewReport] = useState({ property_id: "", report_name: "", report_type: "Collection", pbi_report_id: "", pbi_workspace_id: "a889dfd6-b0ce-49dd-b41d-c79de2dfd0b5" });
  const [newUser, setNewUser] = useState({ username: "", full_name: "", email: "", title: "", password: "", role: "viewer" });
  const [newProp, setNewProp] = useState({ name: "", location: "", system: "" });
  const token = localStorage.getItem("ca_token");

  const flash = (text, type = "success") => { setMsg({ text, type }); setTimeout(() => setMsg(null), 3500); };

  const load = async () => {
    const [p, r] = await Promise.all([apiFetch("/properties"), apiFetch("/reports")]);
    if (p) setProperties(p);
    if (r) setReports(r);
    if (isAdmin) { const u = await apiFetch("/users"); if (u) setUsers(u); }
  };

  useEffect(() => { load(); }, []);

  const propReports = reports.filter(r => r.property_id === selectedProp?.id);

  const s = {
    wrap: { maxWidth: 1100, margin: "0 auto", padding: "1rem" },
    topbar: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem", paddingBottom: "1rem", borderBottom: "0.5px solid #e0e0e0" },
    tabBar: { display: "flex", gap: 4, marginBottom: "1.5rem", background: "#f0ede8", borderRadius: 8, padding: 4 },
    tab: (a) => ({ padding: "8px 20px", fontSize: 13, border: "none", background: a ? "#fff" : "transparent", borderRadius: 6, cursor: "pointer", color: a ? "#111" : "#888", fontWeight: a ? 500 : 400, ...(a ? { border: "0.5px solid #ddd" } : {}) }),
    card: { background: "#fff", border: "0.5px solid #e0e0e0", borderRadius: 12, padding: "1rem 1.25rem", marginBottom: "1rem" },
    input: { width: "100%", padding: "8px 10px", fontSize: 13, border: "0.5px solid #ccc", borderRadius: 8, outline: "none", boxSizing: "border-box", background: "#fff", color: "#111" },
    label: { display: "block", fontSize: 12, color: "#666", marginBottom: 4, fontWeight: 500 },
    btnP: { background: "#111", color: "#fff", border: "none", borderRadius: 8, padding: "9px 20px", fontSize: 13, fontWeight: 500, cursor: "pointer" },
    btnS: { background: "transparent", color: "#111", border: "0.5px solid #ccc", borderRadius: 8, padding: "9px 20px", fontSize: 13, cursor: "pointer" },
    overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 },
    modal: { background: "#fff", borderRadius: 12, padding: "1.5rem", width: 420, border: "0.5px solid #e0e0e0" },
    formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: "1rem" },
    iconBtn: { background: "none", border: "none", cursor: "pointer", padding: 2 },
  };

  const reportTypes = ["Collection", "Aging", "Budget vs Actual", "Invoice Reconciliation", "Income Statement", "Other"];

  return (
    <div style={{ minHeight: "100vh", background: "#f5f4f0" }}>
      {msg && <div style={{ position: "fixed", top: 16, right: 16, zIndex: 999, padding: "10px 16px", borderRadius: 8, background: msg.type === "error" ? "#FCEBEB" : "#EAF3DE", color: msg.type === "error" ? "#A32D2D" : "#3B6D11", fontSize: 13, fontWeight: 500 }}>{msg.text}</div>}

      {/* Load Power BI SDK */}
      <script src="https://cdn.jsdelivr.net/npm/powerbi-client@2.23.0/dist/powerbi.min.js" />

      <div style={s.wrap}>
        {/* Topbar */}
        <div style={s.topbar}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{ width: 32, height: 32, background: "#F5B800", borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: "#111" }}>S</span>
            </div>
            <div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "#111" }}>Savills Egypt</div>
              <div style={{ fontSize: 11, color: "#888" }}>Client Accounting Portal</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#888" }}>{user?.full_name}</span>
            <button onClick={() => setShowPwModal(true)} style={{ ...s.btnS, padding: "6px 14px", fontSize: 12 }}>Change password</button>
            <button onClick={logout} style={{ ...s.btnS, padding: "6px 14px", fontSize: 12 }}>Sign out</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={s.tabBar}>
          {(isAdmin ? ["properties", "reports", "users"] : ["properties"]).map(t => (
            <button key={t} style={s.tab(tab === t)} onClick={() => { setTab(t); setSelectedProp(null); setSelectedReport(null); }}>
              {{ properties: "Properties", reports: "Manage Reports", users: "Users" }[t]}
            </button>
          ))}
        </div>

        {/* PROPERTIES TAB */}
        {tab === "properties" && !selectedProp && <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "1rem", marginBottom: "1rem" }}>
            {properties.map(p => (
              <div key={p.id} onClick={() => { setSelectedProp(p); setSelectedReport(null); }}
                style={{ ...s.card, cursor: "pointer", marginBottom: 0, transition: "box-shadow .2s" }}
                onMouseEnter={e => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.08)"}
                onMouseLeave={e => e.currentTarget.style.boxShadow = "none"}>
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#111" }}>{p.name}</div>
                  <span style={{ padding: "2px 8px", borderRadius: 20, fontSize: 11, background: p.system === "Oracle" ? "#EEEDFE" : "#E1F5EE", color: p.system === "Oracle" ? "#534AB7" : "#0F6E56", fontWeight: 500 }}>{p.system || "—"}</span>
                </div>
                <div style={{ fontSize: 12, color: "#888", marginBottom: 12 }}>{p.location}</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {reports.filter(r => r.property_id === p.id).map(r => (
                    <span key={r.id} style={{ padding: "3px 8px", borderRadius: 20, fontSize: 11, background: "#f0ede8", color: "#666" }}>{r.report_name}</span>
                  ))}
                  {reports.filter(r => r.property_id === p.id).length === 0 && <span style={{ fontSize: 11, color: "#bbb" }}>No reports added yet</span>}
                </div>
                <div style={{ marginTop: 12, fontSize: 12, color: "#185FA5" }}>View reports →</div>
              </div>
            ))}
          </div>
          {isAdmin && <div style={s.card}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: "1rem" }}>Add property</div>
            <div style={s.formGrid}>
              <div><label style={s.label}>Name</label><input style={s.input} value={newProp.name} onChange={e => setNewProp(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Arkan" /></div>
              <div><label style={s.label}>Location</label><input style={s.input} value={newProp.location} onChange={e => setNewProp(p => ({ ...p, location: e.target.value }))} placeholder="e.g. 6th of October" /></div>
              <div><label style={s.label}>System</label><select style={s.input} value={newProp.system} onChange={e => setNewProp(p => ({ ...p, system: e.target.value }))}><option value="">—</option><option>Oracle</option><option>Yardi</option></select></div>
            </div>
            <button style={s.btnP} onClick={async () => {
              if (!newProp.name.trim()) { flash("Name required", "error"); return; }
              try { await apiFetch("/properties", { method: "POST", body: JSON.stringify(newProp) }); setNewProp({ name: "", location: "", system: "" }); load(); flash("Property added"); } catch (e) { flash(e.message, "error"); }
            }}>Add property</button>
          </div>}
        </>}

        {/* PROPERTY DETAIL */}
        {tab === "properties" && selectedProp && <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1.25rem" }}>
            <button style={{ ...s.btnS, padding: "6px 14px", fontSize: 12 }} onClick={() => { setSelectedProp(null); setSelectedReport(null); }}>← Back</button>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600, color: "#111" }}>{selectedProp.name}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{selectedProp.location} · {selectedProp.system}</div>
            </div>
          </div>

          {/* Report tabs */}
          {propReports.length > 0 && (
            <div style={{ display: "flex", gap: 4, marginBottom: "1.5rem", flexWrap: "wrap" }}>
              {propReports.map(r => (
                <button key={r.id} onClick={() => setSelectedReport(r)}
                  style={{ padding: "8px 16px", fontSize: 13, border: `1.5px solid ${selectedReport?.id === r.id ? "#111" : "#ddd"}`, borderRadius: 8, background: selectedReport?.id === r.id ? "#111" : "#fff", color: selectedReport?.id === r.id ? "#fff" : "#111", cursor: "pointer", fontWeight: selectedReport?.id === r.id ? 500 : 400 }}>
                  {r.report_name}
                </button>
              ))}
            </div>
          )}

          {selectedReport ? (
            <div style={s.card}>
              <div style={{ fontSize: 14, fontWeight: 500, color: "#111", marginBottom: "1rem" }}>{selectedReport.report_name}</div>
              <PBIReport reportId={selectedReport.pbi_report_id} workspaceId={selectedReport.pbi_workspace_id} apiUrl={API} token={token} />
            </div>
          ) : (
            <div style={{ ...s.card, textAlign: "center", padding: "3rem", color: "#aaa", fontSize: 13 }}>
              {propReports.length === 0 ? "No reports added for this property yet." : "Select a report above to view it."}
            </div>
          )}
        </>}

        {/* MANAGE REPORTS TAB */}
        {tab === "reports" && isAdmin && <>
          <div style={s.card}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: "1rem" }}>All reports</div>
            {reports.length === 0 && <div style={{ textAlign: "center", padding: "2rem", color: "#aaa", fontSize: 13 }}>No reports added yet</div>}
            {reports.map(r => (
              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid #eee", fontSize: 13 }}>
                <span style={{ fontWeight: 500 }}>{r.report_name}</span>
                <span style={{ color: "#888" }}>{r.property_name}</span>
                <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 11, background: "#E6F1FB", color: "#185FA5", width: "fit-content" }}>{r.report_type}</span>
                <button style={{ ...s.iconBtn, color: "#A32D2D", fontSize: 12 }} onClick={async () => { if (!confirm("Delete?")) return; await apiFetch(`/reports/${r.id}`, { method: "DELETE" }); load(); flash("Deleted"); }}>✕</button>
              </div>
            ))}
          </div>

          <div style={s.card}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: "1rem" }}>Add report</div>
            <div style={s.formGrid}>
              <div><label style={s.label}>Property</label>
                <select style={s.input} value={newReport.property_id} onChange={e => setNewReport(p => ({ ...p, property_id: e.target.value }))}>
                  <option value="">Select property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={s.label}>Report name</label><input style={s.input} value={newReport.report_name} onChange={e => setNewReport(p => ({ ...p, report_name: e.target.value }))} placeholder="e.g. Collection Update - Arkan" /></div>
              <div><label style={s.label}>Report type</label>
                <select style={s.input} value={newReport.report_type} onChange={e => setNewReport(p => ({ ...p, report_type: e.target.value }))}>
                  {reportTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={s.label}>Power BI Report ID</label><input style={s.input} value={newReport.pbi_report_id} onChange={e => setNewReport(p => ({ ...p, pbi_report_id: e.target.value }))} placeholder="From Power BI URL" /></div>
              <div style={{ gridColumn: "1/-1" }}><label style={s.label}>Workspace ID</label><input style={s.input} value={newReport.pbi_workspace_id} onChange={e => setNewReport(p => ({ ...p, pbi_workspace_id: e.target.value }))} /></div>
            </div>
            <button style={s.btnP} onClick={async () => {
              if (!newReport.property_id || !newReport.report_name || !newReport.pbi_report_id) { flash("Please fill all required fields", "error"); return; }
              try { await apiFetch("/reports", { method: "POST", body: JSON.stringify({ ...newReport, property_id: parseInt(newReport.property_id) }) }); setNewReport({ property_id: "", report_name: "", report_type: "Collection", pbi_report_id: "", pbi_workspace_id: "a889dfd6-b0ce-49dd-b41d-c79de2dfd0b5" }); load(); flash("Report added"); } catch (e) { flash(e.message, "error"); }
            }}>Add report</button>
          </div>
        </>}

        {/* USERS TAB */}
        {tab === "users" && isAdmin && <>
          <div style={s.card}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: "1rem" }}>Team members</div>
            {users.map(u => (
              <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 1.5fr 1fr auto", gap: 8, alignItems: "center", padding: "10px 0", borderBottom: "0.5px solid #eee", fontSize: 13 }}>
                <span style={{ color: "#666", fontFamily: "monospace", fontSize: 12 }}>{u.username}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Avatar name={u.full_name} size={26} />
                  <div><div style={{ color: "#111" }}>{u.full_name}</div>{u.title && <div style={{ fontSize: 11, color: "#888" }}>{u.title}</div>}</div>
                </div>
                <span style={{ color: "#666", fontSize: 12 }}>{u.email || "—"}</span>
                <span style={{ padding: "3px 8px", borderRadius: 20, fontSize: 11, background: u.role === "admin" ? "#EEEDFE" : "#F1EFE8", color: u.role === "admin" ? "#534AB7" : "#5F5E5A", fontWeight: 500 }}>{u.role}</span>
                {u.id !== user?.id && <button style={{ ...s.iconBtn, color: "#A32D2D", fontSize: 12 }} onClick={async () => { if (!confirm("Delete?")) return; await apiFetch(`/users/${u.id}`, { method: "DELETE" }); load(); flash("User deleted"); }}>✕</button>}
              </div>
            ))}
          </div>
          <div style={s.card}>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: "1rem" }}>Add user</div>
            <div style={s.formGrid}>
              <div><label style={s.label}>Username</label><input style={s.input} value={newUser.username} onChange={e => setNewUser(p => ({ ...p, username: e.target.value }))} placeholder="first.last" /></div>
              <div><label style={s.label}>Full name</label><input style={s.input} value={newUser.full_name} onChange={e => setNewUser(p => ({ ...p, full_name: e.target.value }))} /></div>
              <div><label style={s.label}>Email</label><input style={s.input} value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} /></div>
              <div><label style={s.label}>Title</label><input style={s.input} value={newUser.title} onChange={e => setNewUser(p => ({ ...p, title: e.target.value }))} /></div>
              <div><label style={s.label}>Password</label><input type="password" style={s.input} value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} /></div>
              <div><label style={s.label}>Role</label>
                <select style={s.input} value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                  <option value="viewer">Viewer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
            <button style={s.btnP} onClick={async () => {
              if (!newUser.username || !newUser.full_name || !newUser.password) { flash("Please fill required fields", "error"); return; }
              try { await apiFetch("/users", { method: "POST", body: JSON.stringify(newUser) }); setNewUser({ username: "", full_name: "", email: "", title: "", password: "", role: "viewer" }); load(); flash("User added"); } catch (e) { flash(e.message, "error"); }
            }}>Add user</button>
          </div>
        </>}

        {/* CHANGE PASSWORD MODAL */}
        {showPwModal && <div style={s.overlay}>
          <div style={{ ...s.modal, width: 360 }}>
            <div style={{ fontSize: 15, fontWeight: 500, marginBottom: "1.25rem" }}>Change password</div>
            <div style={{ marginBottom: 12 }}><label style={s.label}>Current password</label><input type="password" style={s.input} value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} /></div>
            <div style={{ marginBottom: 12 }}><label style={s.label}>New password</label><input type="password" style={s.input} value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} /></div>
            <div style={{ marginBottom: "1rem" }}><label style={s.label}>Confirm</label><input type="password" style={s.input} value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} /></div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={s.btnP} onClick={async () => {
                if (pwForm.new_password !== pwForm.confirm) { flash("Passwords don't match", "error"); return; }
                try { await apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify(pwForm) }); setShowPwModal(false); flash("Password changed"); } catch (e) { flash(e.message, "error"); }
              }}>Update</button>
              <button style={s.btnS} onClick={() => setShowPwModal(false)}>Cancel</button>
            </div>
          </div>
        </div>}
      </div>
    </div>
  );
}
