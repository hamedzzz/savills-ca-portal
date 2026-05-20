import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

// ── QuickBooks Design Tokens ──────────────────────────────────────────────────
const QB = {
  // Colors
  bgPage:      "#F4F5F7",
  bgCard:      "#FFFFFF",
  bgSidebar:   "#F8F9FA",
  borderCard:  "#E3E8EF",
  borderInput: "#C4CBD6",
  borderLight: "#EEF0F3",

  // Brand
  blue:        "#0077C5",   // QB primary blue
  blueDark:    "#005F9E",
  blueLight:   "#E8F4FD",
  blueLighter: "#F0F8FF",

  // Text
  textPrimary:   "#1C1C1C",
  textSecondary: "#57647A",
  textMuted:     "#8C96A3",
  textLink:      "#0077C5",

  // Status
  green:       "#2CA01C",
  greenBg:     "#F2FBF0",
  greenBorder: "#B7E5B0",
  amber:       "#B45309",
  amberBg:     "#FFFBEB",
  amberBorder: "#FDE68A",
  red:         "#C93B1B",
  redBg:       "#FEF2F2",
  redBorder:   "#FECACA",

  // Typography
  fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontSizeXS:  11,
  fontSizeSM:  12,
  fontSizeMD:  13,
  fontSizeLG:  14,
  fontSizeXL:  16,
  fontSizeH2:  20,

  // Radius
  radiusSM: 4,
  radiusMD: 6,
  radiusLG: 8,

  // Shadows
  shadowCard: "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
  shadowModal: "0 10px 40px rgba(0,0,0,0.15)",
};

function Avatar({ name, size = 32 }) {
  const initials = name.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
  const palettes = [
    ["#DBEAFE","#1D4ED8"],["#D1FAE5","#065F46"],
    ["#EDE9FE","#5B21B6"],["#FEF3C7","#92400E"]
  ];
  const [bg, color] = palettes[name.charCodeAt(0) % palettes.length];
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: size * 0.36, fontWeight: 600, flexShrink: 0,
      fontFamily: QB.fontFamily, letterSpacing: 0.3,
    }}>{initials}</div>
  );
}

// Badge pill component
function Badge({ label, color = "blue" }) {
  const map = {
    blue:   { bg: QB.blueLight,  text: QB.blue,   border: "#BFDFFA" },
    green:  { bg: QB.greenBg,   text: QB.green,  border: QB.greenBorder },
    amber:  { bg: QB.amberBg,   text: QB.amber,  border: QB.amberBorder },
    red:    { bg: QB.redBg,     text: QB.red,    border: QB.redBorder },
    purple: { bg: "#EDE9FE",    text: "#5B21B6", border: "#C4B5FD" },
    gray:   { bg: "#F1F3F5",    text: "#57647A", border: "#D4D9E0" },
  };
  const c = map[color] || map.gray;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 20,
      fontSize: QB.fontSizeXS, fontWeight: 600,
      background: c.bg, color: c.text,
      border: `1px solid ${c.border}`,
      fontFamily: QB.fontFamily, letterSpacing: 0.2,
    }}>{label}</span>
  );
}

// Rate badge with percentage
function RateBadge({ rate }) {
  const color = rate >= 90 ? "green" : rate >= 70 ? "amber" : "red";
  return <Badge label={`${rate}%`} color={color} />;
}

export default function Portal() {
  const { user, logout, apiFetch, isAdmin } = useAuth();
  const [tab, setTab] = useState("properties");
  const [properties, setProperties] = useState([]);
  const [archivedProps, setArchivedProps] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [userAccess, setUserAccess] = useState({});
  const [selectedProp, setSelectedProp] = useState(null);
  const [selectedReport, setSelectedReport] = useState(null);
  const [msg, setMsg] = useState(null);
  const [showPwModal, setShowPwModal] = useState(false);
  const [pwForm, setPwForm] = useState({ current_password: "", new_password: "", confirm: "" });
  const [newReport, setNewReport] = useState({ property_id: "", report_name: "", report_type: "Collection", embed_url: "" });
  const [newUser, setNewUser] = useState({ username: "", full_name: "", email: "", title: "", password: "", role: "viewer" });
  const [newUserAccess, setNewUserAccess] = useState([]);
  const [newProp, setNewProp] = useState({ name: "", location: "", system: "" });
  const [editProp, setEditProp] = useState(null);
  const [editPropForm, setEditPropForm] = useState({ name: "", location: "", system: "" });
  const [editReport, setEditReport] = useState(null);
  const [collectionLogs, setCollectionLogs] = useState([]);
  const [emailLogs, setEmailLogs] = useState([]);
  const [collMonth, setCollMonth] = useState(new Date().toISOString().slice(0,7));
  const [collData, setCollData] = useState({});
  const [collNotes, setCollNotes] = useState("");
  const [collRecipients, setCollRecipients] = useState([]);
  const [collProps, setCollProps] = useState([]);
  const [sending, setSending] = useState(false);
  const [collView, setCollView] = useState("form");
  const [editReportForm, setEditReportForm] = useState({ report_name: "", report_type: "", embed_url: "" });

  const flash = (text, type = "success") => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 3500);
  };

  const load = async () => {
    const [p, r] = await Promise.all([apiFetch("/properties"), apiFetch("/reports")]);
    if (p) setProperties(p);
    if (r) setReports(r);
    if (isAdmin) {
      const u = await apiFetch("/users"); if (u) setUsers(u);
      const a = await apiFetch("/properties/archived"); if (a) setArchivedProps(a);
      const cl = await apiFetch("/collection-logs"); if (cl) setCollectionLogs(cl);
      const el = await apiFetch("/email-logs"); if (el) setEmailLogs(el);
      const acc = await apiFetch("/user-access"); if (acc) setUserAccess(acc);
    }
  };

  useEffect(() => { load(); }, []);

  const visibleProps = isAdmin ? properties : properties.filter(p =>
    userAccess[user?.id]?.includes(p.id) || userAccess[user?.id] === null
  );

  const propReports = reports.filter(r => r.property_id === selectedProp?.id);
  const reportTypes = ["Collection", "Aging", "Budget vs Actual", "Invoice Reconciliation", "Income Statement", "Other"];

  // ── Shared style objects ──────────────────────────────────────────────────
  const s = {
    // Layout
    wrap: {
      maxWidth: 1140, margin: "0 auto",
      padding: "0 24px 40px",
      fontFamily: QB.fontFamily,
    },

    // Top bar
    topbar: {
      display: "flex", alignItems: "center",
      justifyContent: "space-between",
      padding: "14px 24px",
      background: QB.bgCard,
      borderBottom: `1px solid ${QB.borderCard}`,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      marginBottom: 0,
      position: "sticky", top: 0, zIndex: 50,
    },

    // Tab bar (QB uses a horizontal nav with underline indicator)
    tabBar: {
      display: "flex", gap: 0,
      borderBottom: `2px solid ${QB.borderLight}`,
      marginBottom: 24, marginTop: 24,
      background: "transparent",
    },
    tab: (active) => ({
      padding: "10px 20px",
      fontSize: QB.fontSizeMD,
      fontWeight: active ? 600 : 400,
      border: "none",
      borderBottom: active ? `2px solid ${QB.blue}` : "2px solid transparent",
      marginBottom: -2,
      background: "transparent",
      color: active ? QB.blue : QB.textSecondary,
      cursor: "pointer",
      fontFamily: QB.fontFamily,
      letterSpacing: 0.1,
      transition: "color 0.15s",
    }),

    // Cards
    card: {
      background: QB.bgCard,
      border: `1px solid ${QB.borderCard}`,
      borderRadius: QB.radiusLG,
      padding: "20px 24px",
      marginBottom: 16,
      boxShadow: QB.shadowCard,
    },
    cardTitle: {
      fontSize: QB.fontSizeLG,
      fontWeight: 600,
      color: QB.textPrimary,
      marginBottom: 16,
      fontFamily: QB.fontFamily,
    },

    // Form inputs — QB style: light border, no radius-pill
    input: {
      width: "100%",
      padding: "8px 10px",
      fontSize: QB.fontSizeMD,
      border: `1px solid ${QB.borderInput}`,
      borderRadius: QB.radiusMD,
      outline: "none",
      boxSizing: "border-box",
      background: QB.bgCard,
      color: QB.textPrimary,
      fontFamily: QB.fontFamily,
      transition: "border-color 0.15s",
    },
    label: {
      display: "block",
      fontSize: QB.fontSizeSM,
      color: QB.textSecondary,
      marginBottom: 4,
      fontWeight: 500,
      fontFamily: QB.fontFamily,
      letterSpacing: 0.1,
    },

    // Buttons — QB blue primary
    btnP: {
      background: QB.blue,
      color: "#fff",
      border: "none",
      borderRadius: QB.radiusMD,
      padding: "9px 20px",
      fontSize: QB.fontSizeMD,
      fontWeight: 600,
      cursor: "pointer",
      fontFamily: QB.fontFamily,
      letterSpacing: 0.2,
      transition: "background 0.15s",
    },
    btnS: {
      background: QB.bgCard,
      color: QB.textPrimary,
      border: `1px solid ${QB.borderInput}`,
      borderRadius: QB.radiusMD,
      padding: "9px 20px",
      fontSize: QB.fontSizeMD,
      fontWeight: 500,
      cursor: "pointer",
      fontFamily: QB.fontFamily,
    },
    btnLink: {
      background: "none",
      border: "none",
      color: QB.blue,
      fontSize: QB.fontSizeMD,
      fontWeight: 500,
      cursor: "pointer",
      padding: 0,
      fontFamily: QB.fontFamily,
    },
    iconBtn: {
      background: "none", border: "none", cursor: "pointer", padding: 2,
      fontFamily: QB.fontFamily,
    },

    // Table
    th: {
      padding: "10px 16px",
      textAlign: "left",
      fontSize: QB.fontSizeXS,
      color: QB.textSecondary,
      fontWeight: 600,
      textTransform: "uppercase",
      letterSpacing: ".08em",
      background: QB.bgSidebar,
      borderBottom: `1px solid ${QB.borderCard}`,
      fontFamily: QB.fontFamily,
    },
    td: {
      padding: "12px 16px",
      fontSize: QB.fontSizeMD,
      color: QB.textPrimary,
      borderBottom: `1px solid ${QB.borderLight}`,
      fontFamily: QB.fontFamily,
    },

    // Overlay / Modal
    overlay: {
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.35)",
      display: "flex", alignItems: "center", justifyContent: "center",
      zIndex: 1000,
    },
    modal: {
      background: QB.bgCard,
      borderRadius: QB.radiusLG,
      padding: "28px 28px 24px",
      width: 500,
      border: `1px solid ${QB.borderCard}`,
      maxHeight: "90vh",
      overflowY: "auto",
      boxShadow: QB.shadowModal,
      fontFamily: QB.fontFamily,
    },
    modalTitle: {
      fontSize: QB.fontSizeXL,
      fontWeight: 600,
      color: QB.textPrimary,
      marginBottom: 20,
      fontFamily: QB.fontFamily,
    },
    formGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 14,
      marginBottom: 16,
    },
  };

  // ── Topbar logo ───────────────────────────────────────────────────────────
  const SAVILLS_LOGO = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48dGl0bGU+U2F2aWxscyBMb2dvPC90aXRsZT48ZyBmaWxsPSJub25lIj48cGF0aCBmaWxsPSIjZmVkZTA3IiBkPSJNMTAwIDBIMHYxMDBoMTAweiIvPjxwYXRoIGQ9Ik0xNC41NzYgOTMuNjMzYy01LjExNCAwLTguNTgyLTIuNjItOC41ODItNy40ODV2LS4xODdIOC44di4xMjVjMCAzLjE4IDIuMzA3IDUuMDUyIDUuOCA1LjA1MiAxLjg3MSAwIDUuNDI2LS44MSA1LjQyNi0zLjgwNCAwLTUuODAxLTEzLjM0Ny0xLjY4NS0xMy4zNDctOS45OCAwLTQuMTggMy44OTItNi4wNSA3Ljc1OS02LjA1IDQuNTUzIDAgNy42NDYgMi42MiA3LjY0NiA2Ljg2di4xODhIMTkuMjh2LS4xODdjMC0yLjc0NS0xLjkzMy00LjM2Ni01LjA1Mi00LjM2Ni0yLjE4MyAwLTQuNzQuOTM2LTQuNzQgMy40MyAwIDUuNDI2IDEzLjM0NyAxLjYyMiAxMy4zNDcgOS45OCAwIDQuNDI4LTQuMTQgNi40MjQtOC4yNTcgNi40MjRNMzguOCA4Mi4wMzJjLS40MzUuMzc0LTEuNDk2LjU2Mi0yLjA1OC42MjRsLTEuOTk1LjI1Yy0zLjc0My40MzYtNy4yMzUgMS4xODQtNy4yMzUgNC40MjggMCAyLjY4MiAyLjMwNyAzLjgwNCA0LjM2NSAzLjgwNCAyLjEyMSAwIDMuOTkyLS43NDggNS4zMDItMi4wNTggMS4wNi0xLjEyMyAxLjYyMi0yLjYyIDEuNjIyLTQuMjQxdi0yLjgwN3ptLjUgMTAuOTc3Yy0uMzEzLTEuMTIzLS4zMTMtMy4zNjgtLjMxMy0zLjM2OC0xLjA2IDIuMzA4LTMuNDkyIDMuOTkyLTcuMjk2IDMuOTkyLTQuMzY2IDAtNi45ODYtMi4zNy02Ljk4Ni02LjIzNyAwLTUuNjE0IDUuMDUxLTYuMTc2IDkuOTgtNi43MzZsMS4wNi0uMTI1YzEuOTk1LS4yNSAzLjA1Ni0uNSAzLjA1Ni0yLjY4MyAwLTIuODA3LTEuNjIyLTQuMDU0LTUuMTE0LTQuMDU0LTIuOTMyIDAtNS4zMDIgMS4yNDctNS4zMDIgNC40Mjl2LjE4N2gtMi44MDd2LS4xODdjMC00LjkyNyAzLjkzLTYuOTIzIDguNDItNi45MjMgNC44NjUgMCA3LjY2IDEuOTMzIDcuNjYgNi40ODZ2MTEuNDc3YzAgLjk5OC4xNzYgMy4xMi40MjYgMy43NDJoLTIuNzg1em0yMC42NDQtMjEuMDgyaC4yNUw1Mi45NiA5My4wMDloLTMuMDU2bC03LjQ4Ni0yMS4wODJoMy4yNTVsNS43OSAxNy44NjQgNS43MjktMTcuODY0em01LjAyMi01LjU0OUExLjk3MSAxLjk3MSAwIDAgMCA2MyA2NC40MTNjLTEuMDQ4IDAtMS45NjUuODUxLTEuOTY1IDEuODk5QTEuOTcgMS45NyAwIDAgMCA2MyA2OC4yNzdhMS45NyAxLjk3IDAgMCAwIDEuOTY1LTEuOTY1di4wNjZ6bS0zLjQgNS41NDloMi45MzJ2MjEuMDgyaC0yLjkzMnptNS44MDEtNy45ODRoMi45MzFWOTMuMDFoLTIuOTN6bTUuNzM5IDBoMi45MzJWOTMuMDFoLTIuOTMyem0xMy4xOTcgMjkuNjljLTUuMTc3IDAtOC42NDUtMi42Mi04LjY0NS03LjQ4NXYtLjE4N2gyLjgwN3YuMTI1YzAgMy4xOCAyLjM3IDUuMDUyIDUuOCA1LjA1MiAxLjg3MSAwIDUuNDktLjgxIDUuNDktMy44MDQgMC01LjgwMS0xMy40MS0xLjY4NS0xMy40MS05Ljk4IDAtNC4xOCAzLjg5Mi02LjA1IDcuNzU4LTYuMDUgNC42MTYgMCA3LjcxIDIuNjIgNy43MSA2Ljg2di4xODhoLTIuODA3di0uMTg3YzAtMi43NDUtMS45MzMtNC4zNjYtNS4wNTItNC4zNjYtMi4yNDUgMC00LjgwMy45MzYtNC44MDMgMy40MyAwIDUuNDI2IDEzLjQxIDEuNjIyIDEzLjQxIDkuOTggMCA0LjQyOC00LjE0IDYuNDI0LTguMjU3IDYuNDI0IiBmaWxsPSIjYzgwYzBmIi8+PC9nPjwvc3ZnPg==";
  const Logo = () => (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img src={SAVILLS_LOGO} alt="Savills" style={{ width: 38, height: 38, borderRadius: QB.radiusMD }} />
      <div style={{ fontSize: 10, color: QB.textMuted, letterSpacing: 0.6, textTransform: "uppercase", paddingTop: 2 }}>
        Client Accounting Portal
      </div>
    </div>
  );

  // ── Section divider line ──────────────────────────────────────────────────
  const Divider = () => <div style={{ height: 1, background: QB.borderLight, margin: "16px 0" }} />;

  // ── Flash message ─────────────────────────────────────────────────────────
  const Flash = () => msg ? (
    <div style={{
      position: "fixed", top: 20, right: 20, zIndex: 9999,
      padding: "12px 18px", borderRadius: QB.radiusLG,
      background: msg.type === "error" ? QB.redBg : QB.greenBg,
      color: msg.type === "error" ? QB.red : QB.green,
      border: `1px solid ${msg.type === "error" ? QB.redBorder : QB.greenBorder}`,
      fontSize: QB.fontSizeMD, fontWeight: 500,
      boxShadow: QB.shadowCard, fontFamily: QB.fontFamily,
    }}>{msg.text}</div>
  ) : null;

  // ── Empty state ───────────────────────────────────────────────────────────
  const Empty = ({ text }) => (
    <div style={{
      textAlign: "center", padding: "40px 20px",
      color: QB.textMuted, fontSize: QB.fontSizeMD,
      fontFamily: QB.fontFamily,
    }}>{text}</div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: QB.bgPage, fontFamily: QB.fontFamily }}>
      <Flash />

      {/* ── TOP NAV BAR ── */}
      <div style={s.topbar}>
        <Logo />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginRight: 8 }}>
            <Avatar name={user?.full_name || "U"} size={28} />
            <div>
              <div style={{ fontSize: QB.fontSizeMD, fontWeight: 600, color: QB.textPrimary }}>{user?.full_name}</div>
              <div style={{ fontSize: QB.fontSizeXS, color: QB.textMuted }}>{user?.title || user?.role}</div>
            </div>
          </div>
          <button onClick={() => setShowPwModal(true)} style={{ ...s.btnS, padding: "6px 14px", fontSize: QB.fontSizeSM }}>Change password</button>
          <button onClick={logout} style={{ ...s.btnS, padding: "6px 14px", fontSize: QB.fontSizeSM, color: QB.red, borderColor: "#FECACA" }}>Sign out</button>
        </div>
      </div>

      <div style={s.wrap}>

        {/* ── TAB BAR ── */}
        <div style={s.tabBar}>
          {(isAdmin ? ["properties", "collection", "reports", "users"] : ["properties"]).map(t => (
            <button key={t} style={s.tab(tab === t)}
              onClick={() => { setTab(t); setSelectedProp(null); setSelectedReport(null); }}>
              {{ properties: "Properties", collection: "Collection Update", reports: "Manage Reports", users: "Users" }[t]}
            </button>
          ))}
        </div>


        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* PROPERTIES TAB                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "properties" && !selectedProp && <>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 16, marginBottom: 20 }}>
            {visibleProps.map(p => (
              <div key={p.id} style={{
                ...s.card, marginBottom: 0,
                cursor: "pointer",
                transition: "box-shadow 0.15s, transform 0.1s",
              }}>
                <div onClick={() => { setSelectedProp(p); setSelectedReport(null); }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 6 }}>
                    <div style={{ fontSize: QB.fontSizeXL, fontWeight: 700, color: QB.textPrimary }}>{p.name}</div>
                    <Badge label={p.system || "—"} color={p.system === "Oracle" ? "purple" : "green"} />
                  </div>
                  <div style={{ fontSize: QB.fontSizeSM, color: QB.textMuted, marginBottom: 12 }}>{p.location}</div>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 12 }}>
                    {reports.filter(r => r.property_id === p.id).map(r => (
                      <Badge key={r.id} label={r.report_name} color="gray" />
                    ))}
                    {reports.filter(r => r.property_id === p.id).length === 0 && (
                      <span style={{ fontSize: QB.fontSizeXS, color: QB.textMuted }}>No reports yet</span>
                    )}
                  </div>
                  <div style={{ fontSize: QB.fontSizeSM, color: QB.blue, fontWeight: 500 }}>View reports →</div>
                </div>

                {isAdmin && <>
                  <Divider />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={{ ...s.btnS, padding: "4px 12px", fontSize: QB.fontSizeSM }}
                      onClick={() => { setEditProp(p); setEditPropForm({ name: p.name, location: p.location || "", system: p.system || "" }); }}>
                      Edit
                    </button>
                    <button style={{ ...s.btnS, padding: "4px 12px", fontSize: QB.fontSizeSM, color: QB.amber, borderColor: QB.amberBorder }}
                      onClick={async () => {
                        if (!confirm(`Archive "${p.name}"?`)) return;
                        await apiFetch(`/properties/${p.id}`, { method: "PATCH", body: JSON.stringify({ is_active: false }) });
                        load(); flash("Property archived");
                      }}>Archive</button>
                    <button style={{ ...s.btnS, padding: "4px 12px", fontSize: QB.fontSizeSM, color: QB.red, borderColor: QB.redBorder }}
                      onClick={async () => {
                        if (!confirm(`Delete "${p.name}" permanently?`)) return;
                        await apiFetch(`/properties/${p.id}`, { method: "DELETE" });
                        load(); flash("Property deleted");
                      }}>Delete</button>
                  </div>
                </>}
              </div>
            ))}
          </div>

          {isAdmin && archivedProps.length > 0 && <>
            <button onClick={() => setShowArchived(p => !p)} style={{ ...s.btnLink, marginBottom: 14, fontSize: QB.fontSizeSM }}>
              {showArchived ? "▲ Hide archived" : `▼ Show archived (${archivedProps.length})`}
            </button>
            {showArchived && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 16, marginBottom: 20 }}>
                {archivedProps.map(p => (
                  <div key={p.id} style={{ ...s.card, marginBottom: 0, opacity: 0.65, borderStyle: "dashed" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ fontSize: QB.fontSizeLG, fontWeight: 600, color: QB.textSecondary }}>{p.name}</div>
                      <Badge label="Archived" color="gray" />
                    </div>
                    <div style={{ fontSize: QB.fontSizeSM, color: QB.textMuted, marginBottom: 12 }}>{p.location}</div>
                    <button style={{ ...s.btnS, padding: "4px 12px", fontSize: QB.fontSizeSM, color: QB.green, borderColor: QB.greenBorder }}
                      onClick={async () => {
                        if (!confirm(`Restore "${p.name}"?`)) return;
                        await apiFetch(`/properties/${p.id}`, { method: "PATCH", body: JSON.stringify({ is_active: true }) });
                        load(); flash("Property restored");
                      }}>Restore</button>
                  </div>
                ))}
              </div>
            )}
          </>}

          {isAdmin && (
            <div style={s.card}>
              <div style={s.cardTitle}>Add property</div>
              <div style={s.formGrid}>
                <div><label style={s.label}>Name</label><input style={s.input} value={newProp.name} onChange={e => setNewProp(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Arkan" /></div>
                <div><label style={s.label}>Location</label><input style={s.input} value={newProp.location} onChange={e => setNewProp(p => ({ ...p, location: e.target.value }))} placeholder="e.g. 6th of October" /></div>
                <div><label style={s.label}>System</label>
                  <select style={s.input} value={newProp.system} onChange={e => setNewProp(p => ({ ...p, system: e.target.value }))}>
                    <option value="">—</option><option>Oracle</option><option>Yardi</option>
                  </select>
                </div>
              </div>
              <button style={s.btnP} onClick={async () => {
                if (!newProp.name.trim()) { flash("Name required", "error"); return; }
                try {
                  await apiFetch("/properties", { method: "POST", body: JSON.stringify(newProp) });
                  setNewProp({ name: "", location: "", system: "" }); load(); flash("Property added");
                } catch (e) { flash(e.message, "error"); }
              }}>Add property</button>
            </div>
          )}
        </>}


        {/* PROPERTY DETAIL */}
        {tab === "properties" && selectedProp && <>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
            <button style={s.btnLink} onClick={() => { setSelectedProp(null); setSelectedReport(null); }}>← Back to properties</button>
            <span style={{ color: QB.borderInput }}>|</span>
            <div>
              <span style={{ fontSize: QB.fontSizeXL, fontWeight: 700, color: QB.textPrimary }}>{selectedProp.name}</span>
              <span style={{ fontSize: QB.fontSizeSM, color: QB.textMuted, marginLeft: 10 }}>{selectedProp.location} · {selectedProp.system}</span>
            </div>
          </div>

          {propReports.length > 0 && (
            <div style={{ display: "flex", gap: 6, marginBottom: 20, flexWrap: "wrap" }}>
              {propReports.map(r => (
                <button key={r.id} onClick={() => setSelectedReport(r)} style={{
                  padding: "7px 16px",
                  fontSize: QB.fontSizeMD,
                  border: `1.5px solid ${selectedReport?.id === r.id ? QB.blue : QB.borderInput}`,
                  borderRadius: QB.radiusLG,
                  background: selectedReport?.id === r.id ? QB.blue : QB.bgCard,
                  color: selectedReport?.id === r.id ? "#fff" : QB.textSecondary,
                  cursor: "pointer", fontWeight: selectedReport?.id === r.id ? 600 : 400,
                  fontFamily: QB.fontFamily,
                }}>
                  {r.report_name}
                </button>
              ))}
            </div>
          )}

          {selectedReport ? (
            <div style={s.card}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ fontSize: QB.fontSizeLG, fontWeight: 600, color: QB.textPrimary }}>{selectedReport.report_name}</div>
                {isAdmin && (
                  <button style={{ ...s.btnS, padding: "4px 12px", fontSize: QB.fontSizeSM }}
                    onClick={() => { setEditReport(selectedReport); setEditReportForm({ report_name: selectedReport.report_name, report_type: selectedReport.report_type, embed_url: selectedReport.embed_url || "" }); }}>
                    Edit URL
                  </button>
                )}
              </div>
              {selectedReport.embed_url ? (
                <iframe src={selectedReport.embed_url} style={{ width: "100%", height: 600, border: "none", borderRadius: QB.radiusMD }} allowFullScreen title={selectedReport.report_name} />
              ) : (
                <Empty text='No embed URL set. Click "Edit URL" to add one.' />
              )}
            </div>
          ) : (
            <div style={s.card}><Empty text={propReports.length === 0 ? "No reports added for this property yet." : "Select a report above to view it."} /></div>
          )}
        </>}


        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* COLLECTION TAB                                                    */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "collection" && isAdmin && <>

          {/* Sub-tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: `2px solid ${QB.borderLight}`, marginBottom: 24 }}>
            {[{ id: "form", label: "Send Update" }, { id: "logs", label: "Collection Log" }, { id: "emails", label: "Email Log" }].map(v => (
              <button key={v.id} onClick={() => setCollView(v.id)} style={{
                padding: "8px 18px", fontSize: QB.fontSizeMD, fontWeight: collView === v.id ? 600 : 400,
                border: "none", borderBottom: collView === v.id ? `2px solid ${QB.blue}` : "2px solid transparent",
                marginBottom: -2, background: "transparent",
                color: collView === v.id ? QB.blue : QB.textSecondary,
                cursor: "pointer", fontFamily: QB.fontFamily,
              }}>{v.label}</button>
            ))}
          </div>

          {/* Send Update Form */}
          {collView === "form" && (
            <div style={s.card}>
              <div style={s.cardTitle}>Collection Update Email</div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Month</label>
                <input type="month" style={{ ...s.input, width: "auto" }} value={collMonth} onChange={e => setCollMonth(e.target.value)} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Properties to include</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  {properties.map(p => (
                    <div key={p.id}
                      onClick={() => setCollProps(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                      style={{
                        padding: "6px 14px", borderRadius: QB.radiusLG, fontSize: QB.fontSizeSM,
                        cursor: "pointer", userSelect: "none",
                        border: `1.5px solid ${collProps.includes(p.id) ? QB.blue : QB.borderInput}`,
                        background: collProps.includes(p.id) ? QB.blueLight : QB.bgCard,
                        color: collProps.includes(p.id) ? QB.blue : QB.textSecondary,
                        fontWeight: collProps.includes(p.id) ? 600 : 400,
                        fontFamily: QB.fontFamily,
                      }}>
                      {p.name} {collProps.includes(p.id) ? "✓" : ""}
                    </div>
                  ))}
                </div>
              </div>

              {collProps.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label style={s.label}>Collection figures</label>
                  <div style={{ border: `1px solid ${QB.borderCard}`, borderRadius: QB.radiusLG, overflow: "hidden", marginTop: 6 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", background: QB.bgSidebar, padding: "10px 14px", fontSize: QB.fontSizeXS, color: QB.textSecondary, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".08em" }}>
                      <span>Property</span><span>Total Invoices</span><span>Collection</span><span>Revenue Share</span>
                    </div>
                    {collProps.map(pid => {
                      const prop = properties.find(p => p.id === pid);
                      const d = collData[pid] || {};
                      return (
                        <div key={pid} style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr", gap: 8, padding: "10px 14px", borderTop: `1px solid ${QB.borderLight}`, alignItems: "center" }}>
                          <span style={{ fontSize: QB.fontSizeMD, fontWeight: 600, color: QB.textPrimary }}>{prop?.name}</span>
                          {["invoices", "collection", "revenue_share"].map(field => (
                            <input key={field} type="number" style={{ ...s.input, fontSize: QB.fontSizeSM }}
                              placeholder="0.00" value={d[field] || ""}
                              onChange={e => setCollData(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: e.target.value } }))} />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Notes <span style={{ color: QB.textMuted, fontWeight: 400 }}>(optional — will appear in email)</span></label>
                <textarea style={{ ...s.input, minHeight: 72, resize: "vertical" }} value={collNotes} onChange={e => setCollNotes(e.target.value)} placeholder="Any additional comments or highlights for this period..." />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={s.label}>Send to</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  {users.map(u => (
                    <div key={u.id}
                      onClick={() => setCollRecipients(prev => prev.includes(u.id) ? prev.filter(x => x !== u.id) : [...prev, u.id])}
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "6px 12px", borderRadius: QB.radiusLG, fontSize: QB.fontSizeSM,
                        cursor: "pointer", userSelect: "none",
                        border: `1.5px solid ${collRecipients.includes(u.id) ? QB.blue : QB.borderInput}`,
                        background: collRecipients.includes(u.id) ? QB.blueLight : QB.bgCard,
                        color: collRecipients.includes(u.id) ? QB.blue : QB.textSecondary,
                        fontWeight: collRecipients.includes(u.id) ? 600 : 400,
                        fontFamily: QB.fontFamily,
                      }}>
                      <Avatar name={u.full_name} size={20} />
                      {u.full_name.split(" ").slice(0, 2).join(" ")}
                      {collRecipients.includes(u.id) && <span>✓</span>}
                    </div>
                  ))}
                </div>
              </div>

              <button style={{ ...s.btnP, opacity: sending ? 0.6 : 1 }} disabled={sending} onClick={async () => {
                if (collProps.length === 0) { alert("Select at least one property"); return; }
                if (collRecipients.length === 0) { alert("Select at least one recipient"); return; }
                setSending(true);
                try {
                  const res = await apiFetch("/collection/send-email", { method: "POST", body: JSON.stringify({ property_ids: collProps, month: collMonth, collections: collData, recipient_user_ids: collRecipients, notes: collNotes }) });
                  if (res) { flash(`Email sent to ${res.sent_to.length} recipients`); setCollProps([]); setCollData({}); setCollNotes(""); setCollRecipients([]); setCollView("emails"); load(); }
                } catch (e) { flash(e.message, "error"); }
                finally { setSending(false); }
              }}>{sending ? "Sending..." : "Send collection update"}</button>
            </div>
          )}

          {/* Collection Log */}
          {collView === "logs" && (
            <div style={s.card}>
              <div style={s.cardTitle}>Collection Log</div>
              {collectionLogs.length === 0 ? <Empty text="No collection records yet" /> : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Property", "Month", "Total Invoices", "Collection", "Revenue Share", "Rate", "Recorded by", "Date"].map(h => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {collectionLogs.map(log => {
                        const rate = log.total_invoices > 0 ? Math.round(log.total_collection / log.total_invoices * 100) : 0;
                        return (
                          <tr key={log.id}>
                            <td style={{ ...s.td, fontWeight: 600 }}>{log.property_name}</td>
                            <td style={{ ...s.td, color: QB.textSecondary }}>{log.month}</td>
                            <td style={{ ...s.td, color: QB.textSecondary }}>EGP {parseFloat(log.total_invoices).toLocaleString("en", { minimumFractionDigits: 2 })}</td>
                            <td style={{ ...s.td, fontWeight: 600 }}>EGP {parseFloat(log.total_collection).toLocaleString("en", { minimumFractionDigits: 2 })}</td>
                            <td style={{ ...s.td, color: QB.textSecondary }}>EGP {parseFloat(log.total_revenue_share).toLocaleString("en", { minimumFractionDigits: 2 })}</td>
                            <td style={s.td}><RateBadge rate={rate} /></td>
                            <td style={{ ...s.td, color: QB.textSecondary }}>{log.created_by_name}</td>
                            <td style={{ ...s.td, color: QB.textMuted, fontSize: QB.fontSizeSM }}>
                              {new Date(log.created_at.endsWith("Z") ? log.created_at : log.created_at + "Z").toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Africa/Cairo" })}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Email Log */}
          {collView === "emails" && (
            <div style={s.card}>
              <div style={s.cardTitle}>Email Log</div>
              {emailLogs.length === 0 ? <Empty text="No emails sent yet" /> : emailLogs.map(log => (
                <div key={log.id} style={{ padding: "14px 0", borderBottom: `1px solid ${QB.borderLight}` }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: QB.fontSizeMD, fontWeight: 600, color: QB.textPrimary, marginBottom: 3 }}>{log.subject}</div>
                      <div style={{ fontSize: QB.fontSizeSM, color: QB.textSecondary, marginBottom: 2 }}>Properties: {log.property_names}</div>
                      <div style={{ fontSize: QB.fontSizeSM, color: QB.textMuted }}>To: {log.recipients}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <Badge label={log.status} color="green" />
                      <div style={{ fontSize: QB.fontSizeXS, color: QB.textMuted, marginTop: 5 }}>
                        {new Date(log.sent_at.endsWith("Z") ? log.sent_at : log.sent_at + "Z").toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Cairo" })}
                      </div>
                      <div style={{ fontSize: QB.fontSizeXS, color: QB.textMuted }}>by {log.sent_by_name}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>}


        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* MANAGE REPORTS TAB                                                */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "reports" && isAdmin && <>
          <div style={s.card}>
            <div style={s.cardTitle}>All reports</div>
            {reports.length === 0 ? <Empty text="No reports added yet" /> : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Report name", "Property", "Type", "", ""].map((h, i) => <th key={i} style={s.th}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {reports.map(r => (
                    <tr key={r.id}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{r.report_name}</td>
                      <td style={{ ...s.td, color: QB.textSecondary }}>{r.property_name}</td>
                      <td style={s.td}><Badge label={r.report_type} color="blue" /></td>
                      <td style={s.td}>
                        <button style={{ ...s.btnS, padding: "3px 10px", fontSize: QB.fontSizeSM }}
                          onClick={() => { setEditReport(r); setEditReportForm({ report_name: r.report_name, report_type: r.report_type, embed_url: r.embed_url || "" }); }}>Edit</button>
                      </td>
                      <td style={s.td}>
                        <button style={{ ...s.iconBtn, color: QB.red, fontSize: QB.fontSizeSM, fontWeight: 600 }}
                          onClick={async () => { if (!confirm("Delete this report?")) return; await apiFetch(`/reports/${r.id}`, { method: "DELETE" }); load(); flash("Deleted"); }}>✕</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Add report</div>
            <div style={s.formGrid}>
              <div>
                <label style={s.label}>Property</label>
                <select style={s.input} value={newReport.property_id} onChange={e => setNewReport(p => ({ ...p, property_id: e.target.value }))}>
                  <option value="">Select property</option>
                  {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={s.label}>Report name</label><input style={s.input} value={newReport.report_name} onChange={e => setNewReport(p => ({ ...p, report_name: e.target.value }))} placeholder="e.g. Collection Update - Arkan" /></div>
              <div>
                <label style={s.label}>Report type</label>
                <select style={s.input} value={newReport.report_type} onChange={e => setNewReport(p => ({ ...p, report_type: e.target.value }))}>
                  {reportTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={s.label}>Embed URL <span style={{ color: QB.textMuted, fontWeight: 400 }}>(Power BI → File → Embed → Publish to web)</span></label>
                <input style={s.input} value={newReport.embed_url} onChange={e => setNewReport(p => ({ ...p, embed_url: e.target.value }))} placeholder="https://app.powerbi.com/reportEmbed?reportId=..." />
              </div>
            </div>
            <button style={s.btnP} onClick={async () => {
              if (!newReport.property_id || !newReport.report_name) { flash("Please fill required fields", "error"); return; }
              try { await apiFetch("/reports", { method: "POST", body: JSON.stringify({ ...newReport, property_id: parseInt(newReport.property_id) }) }); setNewReport({ property_id: "", report_name: "", report_type: "Collection", embed_url: "" }); load(); flash("Report added"); }
              catch (e) { flash(e.message, "error"); }
            }}>Add report</button>
          </div>
        </>}


        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* USERS TAB                                                         */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {tab === "users" && isAdmin && <>
          <div style={s.card}>
            <div style={s.cardTitle}>Team members</div>
            {users.map(u => (
              <div key={u.id} style={{ padding: "14px 0", borderBottom: `1px solid ${QB.borderLight}` }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1.8fr 1.5fr 100px 32px", gap: 10, alignItems: "center" }}>
                  <span style={{ color: QB.textMuted, fontFamily: "monospace", fontSize: QB.fontSizeSM }}>{u.username}</span>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <Avatar name={u.full_name} size={28} />
                    <div>
                      <div style={{ fontSize: QB.fontSizeMD, fontWeight: 600, color: QB.textPrimary }}>{u.full_name}</div>
                      {u.title && <div style={{ fontSize: QB.fontSizeXS, color: QB.textMuted }}>{u.title}</div>}
                    </div>
                  </div>
                  <span style={{ fontSize: QB.fontSizeSM, color: QB.textSecondary }}>{u.email || "—"}</span>
                  <Badge label={u.role} color={u.role === "admin" ? "purple" : "gray"} />
                  {u.id !== user?.id && (
                    <button style={{ ...s.iconBtn, color: QB.red, fontSize: QB.fontSizeSM, fontWeight: 600 }}
                      onClick={async () => { if (!confirm("Delete this user?")) return; await apiFetch(`/users/${u.id}`, { method: "DELETE" }); load(); flash("User deleted"); }}>✕</button>
                  )}
                </div>

                {u.role !== "admin" && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                    <span style={{ fontSize: QB.fontSizeXS, color: QB.textMuted, marginRight: 4 }}>Access:</span>
                    {properties.map(p => {
                      const hasAccess = !userAccess[u.id] || userAccess[u.id]?.includes(p.id);
                      return (
                        <span key={p.id} onClick={async () => {
                          const current = userAccess[u.id] || properties.map(x => x.id);
                          const updated = hasAccess ? current.filter(id => id !== p.id) : [...current, p.id];
                          await apiFetch(`/user-access/${u.id}`, { method: "POST", body: JSON.stringify({ property_ids: updated }) });
                          load();
                        }} style={{
                          padding: "2px 9px", borderRadius: 20, fontSize: QB.fontSizeXS, cursor: "pointer",
                          background: hasAccess ? QB.greenBg : "#F1F3F5",
                          color: hasAccess ? QB.green : QB.textMuted,
                          border: `1px solid ${hasAccess ? QB.greenBorder : QB.borderLight}`,
                          fontFamily: QB.fontFamily, fontWeight: 500,
                        }}>{p.name}</span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Add user</div>
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
            {newUser.role === "viewer" && (
              <div style={{ marginBottom: 16 }}>
                <label style={s.label}>Property access</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                  {properties.map(p => (
                    <div key={p.id} onClick={() => setNewUserAccess(prev => prev.includes(p.id) ? prev.filter(x => x !== p.id) : [...prev, p.id])}
                      style={{
                        padding: "5px 12px", borderRadius: 20, fontSize: QB.fontSizeSM, cursor: "pointer",
                        border: `1.5px solid ${newUserAccess.includes(p.id) ? QB.blue : QB.borderInput}`,
                        background: newUserAccess.includes(p.id) ? QB.blueLight : QB.bgCard,
                        color: newUserAccess.includes(p.id) ? QB.blue : QB.textSecondary,
                        fontWeight: newUserAccess.includes(p.id) ? 600 : 400,
                        userSelect: "none", fontFamily: QB.fontFamily,
                      }}>
                      {p.name} {newUserAccess.includes(p.id) ? "✓" : ""}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: QB.fontSizeXS, color: QB.textMuted, marginTop: 4 }}>No selection = access to all properties</div>
              </div>
            )}
            <button style={s.btnP} onClick={async () => {
              if (!newUser.username || !newUser.full_name || !newUser.password) { flash("Please fill required fields", "error"); return; }
              try {
                const res = await apiFetch("/users", { method: "POST", body: JSON.stringify(newUser) });
                if (res && newUserAccess.length > 0) await apiFetch(`/user-access/${res.id}`, { method: "POST", body: JSON.stringify({ property_ids: newUserAccess }) });
                setNewUser({ username: "", full_name: "", email: "", title: "", password: "", role: "viewer" }); setNewUserAccess([]); load(); flash("User added");
              } catch (e) { flash(e.message, "error"); }
            }}>Add user</button>
          </div>
        </>}


        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* MODALS                                                            */}
        {/* ══════════════════════════════════════════════════════════════════ */}

        {/* Edit Report Modal */}
        {editReport && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <div style={s.modalTitle}>Edit report — {editReport.report_name}</div>
              <div style={{ marginBottom: 14 }}><label style={s.label}>Report name</label><input style={s.input} value={editReportForm.report_name} onChange={e => setEditReportForm(p => ({ ...p, report_name: e.target.value }))} /></div>
              <div style={{ marginBottom: 14 }}><label style={s.label}>Report type</label>
                <select style={s.input} value={editReportForm.report_type} onChange={e => setEditReportForm(p => ({ ...p, report_type: e.target.value }))}>
                  {reportTypes.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: 20 }}><label style={s.label}>Embed URL</label><textarea style={{ ...s.input, minHeight: 80, resize: "vertical" }} value={editReportForm.embed_url} onChange={e => setEditReportForm(p => ({ ...p, embed_url: e.target.value }))} placeholder="https://app.powerbi.com/reportEmbed?..." /></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={s.btnP} onClick={async () => {
                  try { await apiFetch(`/reports/${editReport.id}`, { method: "PATCH", body: JSON.stringify(editReportForm) }); setEditReport(null); load(); flash("Report updated"); if (selectedReport?.id === editReport.id) setSelectedReport({ ...selectedReport, ...editReportForm }); }
                  catch (e) { flash(e.message, "error"); }
                }}>Save changes</button>
                <button style={s.btnS} onClick={() => setEditReport(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Property Modal */}
        {editProp && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, width: 420 }}>
              <div style={s.modalTitle}>Edit property — {editProp.name}</div>
              <div style={{ marginBottom: 14 }}><label style={s.label}>Name</label><input style={s.input} value={editPropForm.name} onChange={e => setEditPropForm(p => ({ ...p, name: e.target.value }))} /></div>
              <div style={{ marginBottom: 14 }}><label style={s.label}>Location</label><input style={s.input} value={editPropForm.location} onChange={e => setEditPropForm(p => ({ ...p, location: e.target.value }))} /></div>
              <div style={{ marginBottom: 20 }}><label style={s.label}>System</label>
                <select style={s.input} value={editPropForm.system} onChange={e => setEditPropForm(p => ({ ...p, system: e.target.value }))}>
                  <option value="">—</option><option>Oracle</option><option>Yardi</option>
                </select>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={s.btnP} onClick={async () => {
                  try { await apiFetch(`/properties/${editProp.id}`, { method: "PATCH", body: JSON.stringify(editPropForm) }); setEditProp(null); load(); flash("Property updated"); }
                  catch (e) { flash(e.message, "error"); }
                }}>Save changes</button>
                <button style={s.btnS} onClick={() => setEditProp(null)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        {/* Change Password Modal */}
        {showPwModal && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, width: 380 }}>
              <div style={s.modalTitle}>Change password</div>
              <div style={{ marginBottom: 14 }}><label style={s.label}>Current password</label><input type="password" style={s.input} value={pwForm.current_password} onChange={e => setPwForm(p => ({ ...p, current_password: e.target.value }))} /></div>
              <div style={{ marginBottom: 14 }}><label style={s.label}>New password</label><input type="password" style={s.input} value={pwForm.new_password} onChange={e => setPwForm(p => ({ ...p, new_password: e.target.value }))} /></div>
              <div style={{ marginBottom: 20 }}><label style={s.label}>Confirm new password</label><input type="password" style={s.input} value={pwForm.confirm} onChange={e => setPwForm(p => ({ ...p, confirm: e.target.value }))} /></div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={s.btnP} onClick={async () => {
                  if (pwForm.new_password !== pwForm.confirm) { flash("Passwords don't match", "error"); return; }
                  try { await apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify(pwForm) }); setShowPwModal(false); flash("Password changed"); }
                  catch (e) { flash(e.message, "error"); }
                }}>Update password</button>
                <button style={s.btnS} onClick={() => setShowPwModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
