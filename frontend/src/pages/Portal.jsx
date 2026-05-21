import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";

function makeQB(settings = {}) {
  const blue   = settings.primary_color || "#0077C5";
  const yellow = settings.accent_color  || "#FEDE07";
  const font   = settings.font_family   || "Inter";
  // Derive light version of primary color (simple opacity trick via hex)
  return {
    bgPage:"#F4F5F7", bgCard:"#FFFFFF", bgSidebar:"#F8F9FA",
    borderCard:"#E3E8EF", borderInput:"#C4CBD6", borderLight:"#EEF0F3",
    blue, blueLight:`${blue}18`,
    red:"#C80C0F", redBg:"#FEF2F2", redBorder:"#FECACA",
    yellow,
    textPrimary:"#1C1C1C", textSecondary:"#57647A", textMuted:"#8C96A3",
    green:"#2CA01C", greenBg:"#F2FBF0", greenBorder:"#B7E5B0",
    amber:"#B45309", amberBg:"#FFFBEB", amberBorder:"#FDE68A",
    fontFamily:`'${font}',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`,
    radiusMD:6, radiusLG:8,
    shadowCard:"0 1px 3px rgba(0,0,0,0.08)",
    shadowModal:"0 10px 40px rgba(0,0,0,0.15)",
  };
}

// Static QB for components defined outside Portal (Avatar, Badge, etc.)
const QB_DEFAULT = makeQB();

function fmtShort(n) {
  const v = parseFloat(n)||0;
  if(v>=1_000_000){ const m=v/1_000_000; return(m%1===0?m.toFixed(0):m.toFixed(1))+"M"; }
  if(v>=1_000){ const k=v/1_000; return(k%1===0?k.toFixed(0):k.toFixed(1))+"K"; }
  return v.toLocaleString("en");
}

// "2026-05" → "May 2026"
function fmtMonth(m) {
  if(!m) return "";
  try {
    const [y, mo] = m.split("-");
    const date = new Date(parseInt(y), parseInt(mo)-1, 1);
    return date.toLocaleDateString("en-GB", { month:"long", year:"numeric" });
  } catch { return m; }
}

function Avatar({name,size=32}){
  const initials=name.split(" ").slice(0,2).map(w=>w[0]).join("").toUpperCase();
  const palettes=[["#DBEAFE","#1D4ED8"],["#D1FAE5","#065F46"],["#EDE9FE","#5B21B6"],["#FEF3C7","#92400E"]];
  const[bg,color]=palettes[name.charCodeAt(0)%palettes.length];
  return<div style={{width:size,height:size,borderRadius:"50%",background:bg,color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.36,fontWeight:600,flexShrink:0,fontFamily:QB_DEFAULT.fontFamily}}>{initials}</div>;
}

function Badge({label,color="blue"}){
  const map={blue:{bg:QB_DEFAULT.blueLight,text:QB_DEFAULT.blue,border:"#BFDFFA"},green:{bg:QB_DEFAULT.greenBg,text:QB_DEFAULT.green,border:QB_DEFAULT.greenBorder},amber:{bg:QB_DEFAULT.amberBg,text:QB_DEFAULT.amber,border:QB_DEFAULT.amberBorder},red:{bg:QB_DEFAULT.redBg,text:QB_DEFAULT.red,border:QB_DEFAULT.redBorder},purple:{bg:"#EDE9FE",text:"#5B21B6",border:"#C4B5FD"},gray:{bg:"#F1F3F5",text:"#57647A",border:"#D4D9E0"}};
  const c=map[color]||map.gray;
  return<span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,background:c.bg,color:c.text,border:`1px solid ${c.border}`,fontFamily:QB_DEFAULT.fontFamily}}>{label}</span>;
}

function RateBadge({rate}){return<Badge label={`${rate}%`} color={rate>=90?"green":rate>=70?"amber":"red"}/>;}

function MiniBar({value,max}){
  const pct=max>0?Math.min((value/max)*100,100):0;
  return<div style={{height:4,background:QB_DEFAULT.borderLight,borderRadius:2,marginTop:4}}><div style={{height:4,width:`${pct}%`,background:QB_DEFAULT.blue,borderRadius:2}}/></div>;
}

// Property logo with PNG fallback
function PropLogo({url,name,size=36}){
  const[err,setErr]=useState(false);
  if(url&&!err) return<img src={url} alt={name} onError={()=>setErr(true)} style={{width:size,height:size,borderRadius:QB_DEFAULT.radiusMD,objectFit:"contain",border:`1px solid ${QB_DEFAULT.borderLight}`,background:"#fff"}}/>;
  return<div style={{width:size,height:size,borderRadius:QB_DEFAULT.radiusMD,background:QB_DEFAULT.blueLight,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.44,fontWeight:700,color:QB_DEFAULT.blue}}>{name?.[0]}</div>;
}

export default function Portal(){
  const{user,logout,apiFetch,isAdmin,isEditor,settings,updateSettings}=useAuth();
  const QB = makeQB(settings);

  const[tab,setTab]=useState("properties");
  const[properties,setProperties]=useState([]);
  const[archivedProps,setArchivedProps]=useState([]);
  const[showArchived,setShowArchived]=useState(false);
  const[reports,setReports]=useState([]);
  const[users,setUsers]=useState([]);
  const[userAccess,setUserAccess]=useState({});
  const[myAccess,setMyAccess]=useState(null); // null=all, array=specific
  const[propertySummaries,setPropertySummaries]=useState({});
  const[selectedProp,setSelectedProp]=useState(null);
  const[selectedReport,setSelectedReport]=useState(null);
  const[msg,setMsg]=useState(null);

  // Collection
  const[collLogs,setCollLogs]=useState([]);
  const[collView,setCollView]=useState("log");
  const[collFilterProp,setCollFilterProp]=useState("");
  const[collFilterMonth,setCollFilterMonth]=useState("");
  const[collForm,setCollForm]=useState({property_id:"",month:new Date().toISOString().slice(0,7),total_invoices:"",total_revenue_share:"",total_collection:"",notes:""});
  const[editingLog,setEditingLog]=useState(null);

  // Email
  const[emailLogs,setEmailLogs]=useState([]);
  const[collMonth,setCollMonth]=useState(new Date().toISOString().slice(0,7));
  const[collData,setCollData]=useState({});
  const[collNotes,setCollNotes]=useState("");
  const[collRecipients,setCollRecipients]=useState([]);
  const[collProps,setCollProps]=useState([]);
  const[sending,setSending]=useState(false);

  // Activity
  const[activities,setActivities]=useState([]);
  const[actFilterUser,setActFilterUser]=useState("");
  const[actFilterDays,setActFilterDays]=useState(30);

  // Users mgmt
  const[newUser,setNewUser]=useState({username:"",full_name:"",email:"",title:"",password:"",role:"viewer"});
  const[newUserAccess,setNewUserAccess]=useState([]);
  const[editUser,setEditUser]=useState(null);
  const[editUserForm,setEditUserForm]=useState({full_name:"",email:"",title:"",role:"viewer"});
  const[editUserAccess,setEditUserAccess]=useState([]);

  // Properties mgmt
  const[newProp,setNewProp]=useState({name:"",location:"",system:"",logo_url:"",landlord_name:""});
  const[editProp,setEditProp]=useState(null);
  const[editPropForm,setEditPropForm]=useState({name:"",location:"",system:"",logo_url:"",landlord_name:""});

  // Reports mgmt
  const[newReport,setNewReport]=useState({property_id:"",report_name:"",report_type:"Collection",category:"",embed_url:""});
  const[editReport,setEditReport]=useState(null);
  const[editReportForm,setEditReportForm]=useState({report_name:"",report_type:"",category:"",embed_url:""});

  // Profile modal
  // Settings control panel state
  const[settingsForm,setSettingsForm]=useState({});
  const[settingsSaving,setSettingsSaving]=useState(false);
  const[settingsPreview,setSettingsPreview]=useState(false);

  const[showProfile,setShowProfile]=useState(false);
  const[profileForm,setProfileForm]=useState({full_name:"",email:"",title:""});
  const[pwForm,setPwForm]=useState({current_password:"",new_password:"",confirm:""});
  const[profileTab,setProfileTab]=useState("info");

  const flash=(text,type="success")=>{setMsg({text,type});setTimeout(()=>setMsg(null),3500);};

  const load=async()=>{
    const[p,r]=await Promise.all([apiFetch("/properties"),apiFetch("/reports")]);
    if(p){
      setProperties(p);
      p.forEach(async prop=>{
        const s=await apiFetch(`/properties/${prop.id}/summary`);
        if(s)setPropertySummaries(prev=>({...prev,[prop.id]:s}));
      });
    }
    if(r)setReports(r);
    if(isAdmin){
      const[u,a,acc,el]=await Promise.all([apiFetch("/users"),apiFetch("/properties/archived"),apiFetch("/user-access"),apiFetch("/email-logs")]);
      if(u)setUsers(u);
      if(a)setArchivedProps(a);
      if(acc)setUserAccess(acc);
      if(el)setEmailLogs(el);
    }
    if(isEditor){
      const cl=await apiFetch("/collection-logs");
      if(cl)setCollLogs(cl);
    }
    if(!isAdmin){
      const ma=await apiFetch("/user-access/me");
      if(ma)setMyAccess(ma.property_ids.length>0?ma.property_ids:null);
    }
  };

  // Init settings form when settings load
  useEffect(()=>{
    setSettingsForm({
      app_name: settings.app_name||"",
      logo_url: settings.logo_url||"",
      primary_color: settings.primary_color||"#0077C5",
      accent_color: settings.accent_color||"#FEDE07",
      font_family: settings.font_family||"Inter",
      email_sender_name: settings.email_sender_name||"",
      email_sender_email: settings.email_sender_email||"",
      portal_tagline: settings.portal_tagline||"",
    });
  },[settings]);

  // Filtered logs
  const filteredLogs = collLogs.filter(log=>{
    if(collFilterProp && String(log.property_id)!==String(collFilterProp)) return false;
    if(collFilterMonth && log.month!==collFilterMonth) return false;
    return true;
  });

  // Totals from filtered logs
  const collTotals = filteredLogs.reduce((acc,log)=>{
    acc.invoices   += parseFloat(log.total_invoices)||0;
    acc.revShare   += parseFloat(log.total_revenue_share)||0;
    acc.collection += parseFloat(log.total_collection)||0;
    return acc;
  },{invoices:0,revShare:0,collection:0});
  const collTotalRate = collTotals.invoices>0
    ? Math.round(collTotals.collection/collTotals.invoices*100) : 0;

  // YTD — current year, no month filter
  const currentYear = new Date().getFullYear().toString();
  const ytdLogs = collLogs.filter(log=>{
    if(log.month?.startsWith(currentYear)===false) return false;
    if(collFilterProp && String(log.property_id)!==String(collFilterProp)) return false;
    return true;
  });
  const ytdTotals = ytdLogs.reduce((acc,log)=>{
    acc.invoices   += parseFloat(log.total_invoices)||0;
    acc.revShare   += parseFloat(log.total_revenue_share)||0;
    acc.collection += parseFloat(log.total_collection)||0;
    return acc;
  },{invoices:0,revShare:0,collection:0});
  const ytdRate = ytdTotals.invoices>0
    ? Math.round(ytdTotals.collection/ytdTotals.invoices*100) : 0;

  // PDF Export function
  const exportCollectionPDF = (logs, filterProp, filterMonth, props, settings) => {
    const logoUrl = settings?.logo_url || "";
    const appName = settings?.app_name || "Savills Egypt CA";
    const tagline = settings?.portal_tagline || "Client Accounting · Property Management";
    const accentColor = settings?.accent_color || "#FEDE07";

    // Build date range label
    let dateLabel = "All periods";
    if(filterMonth) dateLabel = fmtMonth(filterMonth);
    else if(logs.length>0){
      const months = [...new Set(logs.map(l=>l.month))].sort();
      if(months.length>1) dateLabel = `${fmtMonth(months[0])} – ${fmtMonth(months[months.length-1])}`;
      else if(months.length===1) dateLabel = fmtMonth(months[0]);
    }

    const propLabel = filterProp
      ? (props.find(p=>String(p.id)===String(filterProp))?.name || "")
      : "All Properties";

    const rowsHTML = [...new Set(logs.map(l=>l.property_name))].map(propName=>{
      const propLogs = logs.filter(l=>l.property_name===propName);
      return propLogs.map((log,idx)=>{
        const rate = log.total_invoices>0?Math.round(log.total_collection/log.total_invoices*100):0;
        const rateColor = rate>=90?"#2CA01C":rate>=70?"#B45309":"#C80C0F";
        const rateBg = rate>=90?"#F2FBF0":rate>=70?"#FFFBEB":"#FEF2F2";
        return `<tr style="background:${idx%2===0?"#fff":"#F8F9FA"}">
          ${!filterProp?`<td style="padding:10px 14px;font-weight:${idx===0?700:400};color:${idx===0?"#1C1C1C":"#57647A"};border-bottom:1px solid #EEF0F3">${idx===0?propName:""}</td>`:""}
          <td style="padding:10px 14px;color:#57647A;border-bottom:1px solid #EEF0F3">${fmtMonth(log.month)}</td>
          <td style="padding:10px 14px;color:#57647A;border-bottom:1px solid #EEF0F3">EGP ${fmtShort(log.total_invoices)}</td>
          <td style="padding:10px 14px;color:#57647A;border-bottom:1px solid #EEF0F3">EGP ${fmtShort(log.total_revenue_share)}</td>
          <td style="padding:10px 14px;font-weight:600;color:#2CA01C;border-bottom:1px solid #EEF0F3">EGP ${fmtShort(log.total_collection)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF0F3"><span style="background:${rateBg};color:${rateColor};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${rate}%</span></td>
          <td style="padding:10px 14px;color:#57647A;font-size:12px;border-bottom:1px solid #EEF0F3">${log.notes||"—"}</td>
        </tr>`;
      }).join("");
    }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Collection Report — ${dateLabel}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background:#fff; color:#1C1C1C; }
  @media print {
    @page { margin: 18mm 16mm; size: A4; }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display:none !important; }
  }
</style>
</head><body>
  <!-- Top accent bar -->
  <div style="height:5px;background:${accentColor};margin-bottom:0"></div>

  <!-- Header -->
  <div style="padding:24px 32px 20px;border-bottom:1px solid #E3E8EF;display:flex;align-items:center;gap:14px">
    ${logoUrl?`<img src="${logoUrl}" alt="${appName}" style="height:44px;border-radius:6px;object-fit:contain"/>`:
      `<div style="width:44px;height:44px;background:${accentColor};border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:900">${appName[0]||"S"}</div>`}
    <div>
      <div style="font-size:16px;font-weight:700;color:#1C1C1C">${appName}</div>
      <div style="font-size:11px;color:#8C96A3;letter-spacing:0.4px">${tagline}</div>
    </div>
  </div>

  <!-- Report title -->
  <div style="padding:24px 32px 0">
    <div style="font-size:11px;font-weight:600;color:#8C96A3;text-transform:uppercase;letter-spacing:.1em;margin-bottom:6px">Collection Report</div>
    <div style="font-size:22px;font-weight:700;color:#1C1C1C;margin-bottom:4px">Collection Report — ${propLabel}</div>
    <div style="font-size:13px;color:#57647A">${dateLabel}</div>
    <div style="height:2px;background:linear-gradient(to right,#C80C0F,${accentColor});border-radius:2px;margin-top:16px"></div>
  </div>

  <!-- Table -->
  <div style="padding:20px 32px">
    <table style="width:100%;border-collapse:collapse;border:1px solid #E3E8EF;border-radius:8px;overflow:hidden">
      <thead>
        <tr style="background:#F8F9FA">
          ${!filterProp?`<th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid #E3E8EF">Property</th>`:""}
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid #E3E8EF">Month</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid #E3E8EF">Invoices</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid #E3E8EF">Rev. Share</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid #E3E8EF">Collection</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid #E3E8EF">Rate</th>
          <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid #E3E8EF">Notes</th>
        </tr>
      </thead>
      <tbody>${rowsHTML}
        <tr style="background:#F8F9FA;border-top:2px solid #E3E8EF">
          <td style="padding:10px 14px;font-weight:700;color:#1C1C1C;border-bottom:1px solid #EEF0F3;font-size:12px;text-transform:uppercase">TOTAL</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF0F3"></td>
          <td style="padding:10px 14px;font-weight:700;color:#1C1C1C;border-bottom:1px solid #EEF0F3">EGP ${fmtShort(logs.reduce((a,l)=>a+(parseFloat(l.total_invoices)||0),0))}</td>
          <td style="padding:10px 14px;font-weight:700;color:#1C1C1C;border-bottom:1px solid #EEF0F3">EGP ${fmtShort(logs.reduce((a,l)=>a+(parseFloat(l.total_revenue_share)||0),0))}</td>
          <td style="padding:10px 14px;font-weight:700;color:#2CA01C;border-bottom:1px solid #EEF0F3">EGP ${fmtShort(logs.reduce((a,l)=>a+(parseFloat(l.total_collection)||0),0))}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF0F3">
            <span style="background:#F2FBF0;color:#2CA01C;padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">
              ${Math.round(logs.reduce((a,l)=>a+(parseFloat(l.total_collection)||0),0)/Math.max(logs.reduce((a,l)=>a+(parseFloat(l.total_invoices)||0),0),1)*100)}%
            </span>
          </td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF0F3"></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div style="padding:16px 32px 24px;border-top:1px solid #EEF0F3;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:11px;color:#8C96A3;line-height:1.6">
      Generated by <strong style="color:#57647A">${appName}</strong> · ${tagline}<br>
      Generated on ${new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"})}
    </div>
    <div style="font-size:11px;color:#C4CBD6">Confidential</div>
  </div>
</body></html>`;

    const win = window.open("", "_blank");
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(()=>{ win.print(); }, 500);
  };

  const loadActivities=async()=>{
    let url=`/activity-logs?days=${actFilterDays}`;
    if(actFilterUser)url+=`&user_id=${actFilterUser}`;
    const d=await apiFetch(url);
    if(d)setActivities(d);
  };

  useEffect(()=>{load();},[]);
  useEffect(()=>{if(tab==="activity")loadActivities();},[tab,actFilterUser,actFilterDays]);
  useEffect(()=>{if(showProfile)setProfileForm({full_name:user?.full_name||"",email:user?.email||"",title:user?.title||""});},[showProfile]);

  const visibleProps=isAdmin?properties:properties.filter(p=>!myAccess||myAccess.includes(p.id));
  const propReports=reports.filter(r=>r.property_id===selectedProp?.id);
  const reportTypes=["Collection","Aging","Budget vs Actual","Invoice Reconciliation","Income Statement","Other"];

  const tabs=isAdmin
    ?["properties","reports","collection","email","manage-reports","users","activity","settings"]
    :isEditor
    ?["properties","reports","collection","email","activity"]
    :["properties","reports","collection","activity"];

  const tabLabels={
    properties:"Properties",
    reports:"Reports",
    collection:"Collection",
    email:"Email",
    "manage-reports":"Manage Reports",
    users:"Users",
    activity:"Activity",
    settings:"⚙ Settings"
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const s={
    topbar:{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 24px",background:QB.bgCard,borderBottom:`1px solid ${QB.borderCard}`,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",position:"sticky",top:0,zIndex:50},
    wrap:{maxWidth:1160,margin:"0 auto",padding:"0 24px 40px",fontFamily:QB.fontFamily},
    tabBar:{display:"flex",gap:0,borderBottom:`2px solid ${QB.borderLight}`,marginBottom:24,marginTop:24},
    tab:(a)=>({padding:"10px 18px",fontSize:13,fontWeight:a?600:400,border:"none",borderBottom:a?`2px solid ${QB.blue}`:"2px solid transparent",marginBottom:-2,background:"transparent",color:a?QB.blue:QB.textSecondary,cursor:"pointer",fontFamily:QB.fontFamily}),
    card:{background:QB.bgCard,border:`1px solid ${QB.borderCard}`,borderRadius:QB.radiusLG,padding:"20px 24px",marginBottom:16,boxShadow:QB.shadowCard},
    cardTitle:{fontSize:14,fontWeight:600,color:QB.textPrimary,marginBottom:16,fontFamily:QB.fontFamily},
    input:{width:"100%",padding:"8px 10px",fontSize:13,border:`1px solid ${QB.borderInput}`,borderRadius:QB.radiusMD,outline:"none",boxSizing:"border-box",background:QB.bgCard,color:QB.textPrimary,fontFamily:QB.fontFamily},
    label:{display:"block",fontSize:12,color:QB.textSecondary,marginBottom:4,fontWeight:500,fontFamily:QB.fontFamily},
    btnP:{background:QB.blue,color:"#fff",border:"none",borderRadius:QB.radiusMD,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:QB.fontFamily},
    btnR:{background:QB.red,color:"#fff",border:"none",borderRadius:QB.radiusMD,padding:"9px 20px",fontSize:13,fontWeight:600,cursor:"pointer",fontFamily:QB.fontFamily},
    btnS:{background:QB.bgCard,color:QB.textPrimary,border:`1px solid ${QB.borderInput}`,borderRadius:QB.radiusMD,padding:"9px 20px",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:QB.fontFamily},
    btnLink:{background:"none",border:"none",color:QB.blue,fontSize:13,fontWeight:500,cursor:"pointer",padding:0,fontFamily:QB.fontFamily},
    th:{padding:"10px 16px",textAlign:"left",fontSize:11,color:QB.textSecondary,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",background:QB.bgSidebar,borderBottom:`1px solid ${QB.borderCard}`,fontFamily:QB.fontFamily},
    td:{padding:"12px 16px",fontSize:13,color:QB.textPrimary,borderBottom:`1px solid ${QB.borderLight}`,fontFamily:QB.fontFamily},
    overlay:{position:"fixed",inset:0,background:"rgba(0,0,0,0.35)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000},
    modal:{background:QB.bgCard,borderRadius:QB.radiusLG,padding:"28px 28px 24px",width:500,border:`1px solid ${QB.borderCard}`,maxHeight:"90vh",overflowY:"auto",boxShadow:QB.shadowModal,fontFamily:QB.fontFamily},
    modalTitle:{fontSize:16,fontWeight:600,color:QB.textPrimary,marginBottom:20},
    formGrid:{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16},
    divider:{height:1,background:QB.borderLight,margin:"16px 0"},
  };

  const SavillsLogo=()=>(
    <div style={{display:"flex",alignItems:"center",gap:10}}>
      <div style={{width:38,height:38,borderRadius:QB.radiusMD,overflow:"hidden",border:`1px solid ${QB.borderLight}`,flexShrink:0,background:QB.yellow}}>
        <img src={settings.logo_url||"https://savills-ca-portal.vercel.app/savills-logo.svg"} alt={settings.app_name||"Portal"}
          style={{width:38,height:38,display:"block",objectFit:"contain"}}
          onError={e=>{e.target.style.display="none";}}/>
      </div>
      <div>
        <div style={{fontSize:13,fontWeight:700,color:QB.textPrimary,lineHeight:1.2}}>{settings.app_name||"CA Portal"}</div>
        <div style={{fontSize:10,color:QB.textMuted,letterSpacing:0.4}}>{settings.portal_tagline||"Client Accounting"}</div>
      </div>
    </div>
  );

  const Flash=()=>msg?<div style={{position:"fixed",top:20,right:20,zIndex:9999,padding:"12px 18px",borderRadius:QB.radiusLG,background:msg.type==="error"?QB.redBg:QB.greenBg,color:msg.type==="error"?QB.red:QB.green,border:`1px solid ${msg.type==="error"?QB.redBorder:QB.greenBorder}`,fontSize:13,fontWeight:500,boxShadow:QB.shadowCard}}>{msg.text}</div>:null;
  const Empty=({text})=><div style={{textAlign:"center",padding:"40px 20px",color:QB.textMuted,fontSize:13}}>{text}</div>;

  // ── Property Summary ────────────────────────────────────────────────────────
  const PropertySummary=({propId})=>{
    const data=propertySummaries[propId]||[];
    if(data.length===0)return<div style={{fontSize:12,color:QB.textMuted,marginBottom:10}}>No collection data yet</div>;
    const maxInv=Math.max(...data.map(d=>parseFloat(d.total_invoices)||0));

    // YTD from all collection logs for this property
    const currentYear=new Date().getFullYear().toString();
    const propYtdLogs=collLogs.filter(l=>String(l.property_id)===String(propId)&&l.month?.startsWith(currentYear));
    const propYtd=propYtdLogs.reduce((acc,l)=>({
      invoices:   acc.invoices   + (parseFloat(l.total_invoices)||0),
      collection: acc.collection + (parseFloat(l.total_collection)||0),
      revShare:   acc.revShare   + (parseFloat(l.total_revenue_share)||0),
    }),{invoices:0,collection:0,revShare:0});
    const propYtdRate=propYtd.invoices>0?Math.round(propYtd.collection/propYtd.invoices*100):0;

    return(
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>Last {data.length} {data.length===1?"month":"months"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {data.map((d,i)=>{
            const rate=d.total_invoices>0?Math.round(parseFloat(d.total_collection)/parseFloat(d.total_invoices)*100):0;
            return(
              <div key={i} style={{background:QB.bgSidebar,borderRadius:QB.radiusMD,padding:"8px 10px",border:`1px solid ${QB.borderLight}`}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:11,fontWeight:600,color:QB.textSecondary}}>{fmtMonth(d.month)}</span>
                  <RateBadge rate={rate}/>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
                  <div><div style={{fontSize:10,color:QB.textMuted}}>Invoices</div><div style={{fontSize:12,fontWeight:600,color:QB.textPrimary}}>EGP {fmtShort(d.total_invoices)}</div></div>
                  <div><div style={{fontSize:10,color:QB.textMuted}}>Collection</div><div style={{fontSize:12,fontWeight:600,color:QB.green}}>EGP {fmtShort(d.total_collection)}</div></div>
                  <div><div style={{fontSize:10,color:QB.textMuted}}>Rev. Share</div><div style={{fontSize:12,fontWeight:600,color:QB.blue}}>EGP {fmtShort(d.total_revenue_share)}</div></div>
                </div>
                <MiniBar value={parseFloat(d.total_collection)} max={maxInv}/>
              </div>
            );
          })}
        </div>

        {/* YTD Total */}
        {propYtdLogs.length>0&&(
          <div style={{marginTop:8,padding:"10px 12px",background:QB.blueLight,borderRadius:QB.radiusMD,border:`1px solid ${QB.blue}22`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <span style={{fontSize:11,fontWeight:700,color:QB.blue,textTransform:"uppercase",letterSpacing:".06em"}}>YTD {currentYear}</span>
              <RateBadge rate={propYtdRate}/>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
              <div><div style={{fontSize:10,color:QB.textSecondary}}>Invoices</div><div style={{fontSize:12,fontWeight:700,color:QB.textPrimary}}>EGP {fmtShort(propYtd.invoices)}</div></div>
              <div><div style={{fontSize:10,color:QB.textSecondary}}>Collection</div><div style={{fontSize:12,fontWeight:700,color:QB.green}}>EGP {fmtShort(propYtd.collection)}</div></div>
              <div><div style={{fontSize:10,color:QB.textSecondary}}>Rev. Share</div><div style={{fontSize:12,fontWeight:700,color:QB.blue}}>EGP {fmtShort(propYtd.revShare)}</div></div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ── Activity icon ───────────────────────────────────────────────────────────
  const actIcon=(action)=>{
    if(action.includes("login"))return"🔐";
    if(action.includes("collection"))return"📊";
    if(action.includes("email"))return"📧";
    if(action.includes("user"))return"👤";
    if(action.includes("property"))return"🏢";
    if(action.includes("report"))return"📋";
    if(action.includes("password")||action.includes("profile"))return"⚙️";
    return"📌";
  };

  return(
    <div style={{minHeight:"100vh",background:QB.bgPage,fontFamily:QB.fontFamily}}>
      <Flash/>

      {/* TOP NAV */}
      <div style={s.topbar}>
        <SavillsLogo/>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginRight:4}}>
            <Avatar name={user?.full_name||"U"} size={28}/>
            <div>
              <div style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}>{user?.full_name}</div>
              <div style={{fontSize:11,color:QB.textMuted}}>{user?.title||user?.role}</div>
            </div>
          </div>
          <button onClick={()=>setShowProfile(true)} style={{...s.btnS,padding:"6px 16px",fontSize:12}}>Profile</button>
          <button onClick={logout} style={{...s.btnS,padding:"6px 14px",fontSize:12,color:QB.red,borderColor:QB.redBorder}}>Sign out</button>
        </div>
      </div>

      <div style={s.wrap}>
        {/* TAB BAR */}
        <div style={s.tabBar}>
          {tabs.map(t=>(
            <button key={t} style={s.tab(tab===t)} onClick={()=>{setTab(t);setSelectedProp(null);setSelectedReport(null);}}>
              {tabLabels[t]}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════════════════════════
            PROPERTIES TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="properties"&&!selectedProp&&(
          <>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16,marginBottom:20}}>
              {visibleProps.map(p=>(
                <div key={p.id} style={{...s.card,marginBottom:0}}>
                  <div style={{cursor:"pointer"}} onClick={()=>{setSelectedProp(p);setSelectedReport(null);}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <PropLogo url={p.logo_url} name={p.name} size={36}/>
                        <div>
                          <div style={{fontSize:16,fontWeight:700,color:QB.textPrimary}}>{p.name}</div>
                          <div style={{fontSize:12,color:QB.textMuted}}>{p.location}</div>
                      {p.landlord_name&&<div style={{fontSize:11,color:QB.textMuted,marginTop:1}}>👤 {p.landlord_name}</div>}
                        </div>
                      </div>
                      <Badge label={p.system||"—"} color={p.system==="Oracle"?"purple":"green"}/>
                    </div>
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:10}}>
                      {reports.filter(r=>r.property_id===p.id).map(r=><Badge key={r.id} label={r.report_name} color="gray"/>)}
                      {reports.filter(r=>r.property_id===p.id).length===0&&<span style={{fontSize:11,color:QB.textMuted}}>No reports yet</span>}
                    </div>
                    <PropertySummary propId={p.id}/>
                    <div style={{fontSize:12,color:QB.blue,fontWeight:500}}>View reports →</div>
                  </div>
                  {isAdmin&&<>
                    <div style={s.divider}/>
                    <div style={{display:"flex",gap:8}}>
                      <button style={{...s.btnS,padding:"4px 12px",fontSize:12}} onClick={()=>{setEditProp(p);setEditPropForm({name:p.name,location:p.location||"",system:p.system||"",logo_url:p.logo_url||"",landlord_name:p.landlord_name||""});}}>Edit</button>
                      <button style={{...s.btnS,padding:"4px 12px",fontSize:12,color:QB.amber,borderColor:QB.amberBorder}} onClick={async()=>{if(!confirm(`Archive "${p.name}"?`))return;await apiFetch(`/properties/${p.id}`,{method:"PATCH",body:JSON.stringify({is_active:false})});load();flash("Archived");}}>Archive</button>
                      <button style={{...s.btnS,padding:"4px 12px",fontSize:12,color:QB.red,borderColor:QB.redBorder}} onClick={async()=>{if(!confirm(`Delete "${p.name}" permanently?`))return;await apiFetch(`/properties/${p.id}`,{method:"DELETE"});load();flash("Deleted");}}>Delete</button>
                    </div>
                  </>}
                </div>
              ))}
            </div>

            {isAdmin&&archivedProps.length>0&&<>
              <button onClick={()=>setShowArchived(v=>!v)} style={{...s.btnLink,marginBottom:14,fontSize:12}}>
                {showArchived?`▲ Hide archived`:`▼ Show archived (${archivedProps.length})`}
              </button>
              {showArchived&&<div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))",gap:16,marginBottom:20}}>
                {archivedProps.map(p=>(
                  <div key={p.id} style={{...s.card,marginBottom:0,opacity:0.65,borderStyle:"dashed"}}>
                    <div style={{fontSize:14,fontWeight:600,color:QB.textSecondary,marginBottom:4}}>{p.name}</div>
                    <div style={{fontSize:12,color:QB.textMuted,marginBottom:10}}>{p.location}</div>
                    <button style={{...s.btnS,padding:"4px 12px",fontSize:12,color:QB.green,borderColor:QB.greenBorder}} onClick={async()=>{if(!confirm(`Restore "${p.name}"?`))return;await apiFetch(`/properties/${p.id}`,{method:"PATCH",body:JSON.stringify({is_active:true})});load();flash("Restored");}}>Restore</button>
                  </div>
                ))}
              </div>}
            </>}

            {isAdmin&&<div style={s.card}>
              <div style={s.cardTitle}>Add property</div>
              <div style={s.formGrid}>
                <div><label style={s.label}>Name</label><input style={s.input} value={newProp.name} onChange={e=>setNewProp(p=>({...p,name:e.target.value}))} placeholder="e.g. Arkan"/></div>
                <div><label style={s.label}>Location</label><input style={s.input} value={newProp.location} onChange={e=>setNewProp(p=>({...p,location:e.target.value}))} placeholder="e.g. Sheikh Zayed"/></div>
                <div><label style={s.label}>System</label>
                  <select style={s.input} value={newProp.system} onChange={e=>setNewProp(p=>({...p,system:e.target.value}))}>
                    <option value="">—</option><option>Oracle</option><option>Yardi</option>
                  </select>
                </div>
                <div><label style={s.label}>Logo URL <span style={{color:QB.textMuted,fontWeight:400}}>(optional)</span></label>
                  <input style={s.input} value={newProp.logo_url} onChange={e=>setNewProp(p=>({...p,logo_url:e.target.value}))} placeholder="https://..."/>
                </div>
                <div><label style={s.label}>Landlord name <span style={{color:QB.textMuted,fontWeight:400}}>(optional)</span></label>
                  <input style={s.input} value={newProp.landlord_name} onChange={e=>setNewProp(p=>({...p,landlord_name:e.target.value}))} placeholder="e.g. Arkan Development"/>
                </div>
              </div>
              <button style={s.btnP} onClick={async()=>{
                if(!newProp.name.trim()){flash("Name required","error");return;}
                try{await apiFetch("/properties",{method:"POST",body:JSON.stringify(newProp)});setNewProp({name:"",location:"",system:"",logo_url:"",landlord_name:""});load();flash("Property added");}
                catch(e){flash(e.message,"error");}
              }}>Add property</button>
            </div>}
          </>
        )}

        {/* PROPERTY DETAIL */}
        {tab==="properties"&&selectedProp&&<>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:20}}>
            <button style={s.btnLink} onClick={()=>{setSelectedProp(null);setSelectedReport(null);}}>← Back</button>
            <span style={{color:QB.borderInput}}>|</span>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <PropLogo url={selectedProp.logo_url} name={selectedProp.name} size={30}/>
              <span style={{fontSize:18,fontWeight:700,color:QB.textPrimary}}>{selectedProp.name}</span>
              <span style={{fontSize:12,color:QB.textMuted}}>{selectedProp.location} · {selectedProp.system}</span>
            </div>
          </div>
          {/* Reports: sidebar + content */}
          <div style={{display:"flex",gap:16,alignItems:"flex-start"}}>
            {/* Sidebar */}
            {propReports.length>0&&<div style={{width:200,flexShrink:0}}>
              {/* Group by report_type */}
              {[...new Set(propReports.map(r=>r.category||r.report_type))].map(cat=>(
                <div key={cat} style={{marginBottom:16}}>
                  <div style={{fontSize:10,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".08em",padding:"0 12px",marginBottom:6}}>{cat}</div>
                  {propReports.filter(r=>(r.category||r.report_type)===cat).map(r=>(
                    <button key={r.id} onClick={async()=>{setSelectedReport(r);try{await apiFetch(`/reports/${r.id}/view`,{method:"POST"});}catch(e){};}} style={{display:"block",width:"100%",textAlign:"left",padding:"8px 12px",fontSize:13,border:"none",borderRadius:QB.radiusMD,background:selectedReport?.id===r.id?QB.blueLight:"transparent",color:selectedReport?.id===r.id?QB.blue:QB.textSecondary,cursor:"pointer",fontWeight:selectedReport?.id===r.id?600:400,fontFamily:QB.fontFamily,marginBottom:2}}>
                      {r.report_name}
                    </button>
                  ))}
                </div>
              ))}
            </div>}
            {/* Content */}
            <div style={{flex:1}}>
              {selectedReport
                ?<div style={s.card}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                    <div>
                      <div style={{fontSize:14,fontWeight:600,color:QB.textPrimary}}>{selectedReport.report_name}</div>
                      <div style={{fontSize:12,color:QB.textMuted,marginTop:2}}>{selectedReport.report_type}</div>
                    </div>
                    {isAdmin&&<button style={{...s.btnS,padding:"4px 12px",fontSize:12}} onClick={()=>{setEditReport(selectedReport);setEditReportForm({report_name:selectedReport.report_name,report_type:selectedReport.report_type,category:selectedReport.category||"",embed_url:selectedReport.embed_url||""});}}>Edit URL</button>}
                  </div>
                  {selectedReport.embed_url?<iframe src={selectedReport.embed_url} style={{width:"100%",height:600,border:"none",borderRadius:QB.radiusMD}} allowFullScreen title={selectedReport.report_name}/>:<Empty text='No embed URL set.'/>}
                </div>
                :<div style={s.card}><Empty text={propReports.length===0?"No reports for this property yet.":"Select a report from the sidebar."}/></div>
              }
            </div>
          </div>
        </>}

        {/* ══════════════════════════════════════════════════════════════════
            REPORTS TAB — All properties with their reports
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="reports"&&(
          <div style={{display:"flex",gap:24,alignItems:"flex-start"}}>

            {/* ── Left column: Properties list ── */}
            <div style={{width:260,flexShrink:0}}>
              <div style={{fontSize:11,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}}>Properties</div>
              {visibleProps.map(p=>{
                const propReportCount=reports.filter(r=>r.property_id===p.id).length;
                const isSelected=selectedProp?.id===p.id;
                return(
                  <div key={p.id}
                    onClick={()=>{setSelectedProp(p);setSelectedReport(null);}}
                    style={{
                      display:"flex",alignItems:"center",gap:10,
                      padding:"10px 12px",borderRadius:QB.radiusLG,
                      marginBottom:4,cursor:"pointer",
                      background:isSelected?QB.blueLight:"transparent",
                      border:`1px solid ${isSelected?QB.blue:QB.borderLight}`,
                      transition:"all 0.15s",
                    }}>
                    <PropLogo url={p.logo_url} name={p.name} size={28}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:isSelected?600:500,color:isSelected?QB.blue:QB.textPrimary,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.name}</div>
                      <div style={{fontSize:11,color:QB.textMuted,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.landlord_name||p.location}</div>
                    </div>
                    <div style={{
                      minWidth:20,height:20,borderRadius:10,
                      background:isSelected?QB.blue:QB.bgSidebar,
                      color:isSelected?"#fff":QB.textSecondary,
                      fontSize:11,fontWeight:600,
                      display:"flex",alignItems:"center",justifyContent:"center",
                      border:`1px solid ${isSelected?QB.blue:QB.borderCard}`,
                      padding:"0 6px",
                    }}>{propReportCount}</div>
                  </div>
                );
              })}
            </div>

            {/* ── Right column: Reports for selected property ── */}
            <div style={{flex:1}}>
              {!selectedProp?(
                <div style={{...s.card,textAlign:"center",padding:"60px 20px"}}>
                  <div style={{fontSize:32,marginBottom:12}}>📋</div>
                  <div style={{fontSize:14,fontWeight:600,color:QB.textPrimary,marginBottom:6}}>Select a property</div>
                  <div style={{fontSize:13,color:QB.textMuted}}>Choose a property from the left to view its reports</div>
                </div>
              ):(
                <div>
                  {/* Property header */}
                  <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:20,padding:"16px 20px",background:QB.bgCard,borderRadius:QB.radiusLG,border:`1px solid ${QB.borderCard}`,boxShadow:QB.shadowCard}}>
                    <PropLogo url={selectedProp.logo_url} name={selectedProp.name} size={40}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:17,fontWeight:700,color:QB.textPrimary}}>{selectedProp.name}</div>
                      <div style={{fontSize:12,color:QB.textMuted}}>{selectedProp.location} · {selectedProp.system}</div>
                      {selectedProp.landlord_name&&<div style={{fontSize:12,color:QB.textSecondary,marginTop:2}}>👤 {selectedProp.landlord_name}</div>}
                    </div>
                    <Badge label={selectedProp.system||"—"} color={selectedProp.system==="Oracle"?"purple":"green"}/>
                  </div>

                  {/* Reports grouped by type */}
                  {propReports.length===0?(
                    <div style={{...s.card,textAlign:"center",padding:"40px 20px"}}>
                      <div style={{fontSize:24,marginBottom:8}}>📭</div>
                      <div style={{fontSize:13,color:QB.textMuted}}>No reports added for this property yet</div>
                      {isAdmin&&<button style={{...s.btnP,marginTop:16,fontSize:12,padding:"7px 16px"}} onClick={()=>{setTab("manage-reports");}}>+ Add report</button>}
                    </div>
                  ):(
                    <div>
                      {[...new Set(propReports.map(r=>r.category||r.report_type))].map(cat=>{
                        const catReports=propReports.filter(r=>(r.category||r.report_type)===cat);
                        return(
                          <div key={cat} style={{marginBottom:20}}>
                            {/* Category header */}
                            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                              <div style={{fontSize:11,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".08em"}}>{cat}</div>
                              <div style={{flex:1,height:1,background:QB.borderLight}}/>
                              <div style={{fontSize:11,color:QB.textMuted}}>{catReports.length} report{catReports.length!==1?"s":""}</div>
                            </div>

                            {/* Report cards */}
                            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:10}}>
                              {catReports.map(r=>{
                                const isActive=selectedReport?.id===r.id;
                                return(
                                  <div key={r.id}
                                    onClick={async()=>{
                                    if(!isActive){
                                      setSelectedReport(r);
                                      // Log the view
                                      try{await apiFetch(`/reports/${r.id}/view`,{method:"POST"});}catch(e){}
                                    }else{
                                      setSelectedReport(null);
                                    }
                                  }}
                                    style={{
                                      padding:"14px 16px",
                                      background:isActive?QB.blueLight:QB.bgCard,
                                      border:`1.5px solid ${isActive?QB.blue:QB.borderCard}`,
                                      borderRadius:QB.radiusLG,
                                      cursor:"pointer",
                                      boxShadow:isActive?"none":QB.shadowCard,
                                      transition:"all 0.15s",
                                    }}>
                                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                                      <div style={{flex:1}}>
                                        <div style={{fontSize:13,fontWeight:600,color:isActive?QB.blue:QB.textPrimary,marginBottom:4}}>{r.report_name}</div>
                                        <Badge label={r.report_type} color="gray"/>
                                      </div>
                                      <div style={{fontSize:18,opacity:0.5}}>{isActive?"▼":"▶"}</div>
                                    </div>
                                    {!isActive&&(
                                      <div style={{marginTop:8,fontSize:11,color:QB.textMuted,display:"flex",alignItems:"center",gap:4}}>
                                        <span>Click to open report</span>
                                        <span>→</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}

                      {/* Expanded report iframe */}
                      {selectedReport&&selectedReport.property_id===selectedProp.id&&(
                        <div style={{...s.card,marginTop:8}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                            <div>
                              <div style={{fontSize:14,fontWeight:600,color:QB.textPrimary}}>{selectedReport.report_name}</div>
                              <div style={{fontSize:12,color:QB.textMuted,marginTop:2}}>{selectedReport.report_type}{selectedReport.category?` · ${selectedReport.category}`:""}</div>
                            </div>
                            <div style={{display:"flex",gap:8}}>
                              {isAdmin&&<button style={{...s.btnS,padding:"4px 12px",fontSize:12}} onClick={()=>{setEditReport(selectedReport);setEditReportForm({report_name:selectedReport.report_name,report_type:selectedReport.report_type,category:selectedReport.category||"",embed_url:selectedReport.embed_url||""});}}>Edit</button>}
                              <button style={{...s.btnS,padding:"4px 12px",fontSize:12}} onClick={()=>setSelectedReport(null)}>✕ Close</button>
                            </div>
                          </div>
                          {selectedReport.embed_url
                            ?<iframe src={selectedReport.embed_url} style={{width:"100%",height:600,border:"none",borderRadius:QB.radiusMD}} allowFullScreen title={selectedReport.report_name}/>
                            :<div style={{textAlign:"center",padding:"40px",color:QB.textMuted,fontSize:13}}>No embed URL set for this report.</div>
                          }
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            COLLECTION TAB — Log CRUD
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="collection"&&<>
          {/* Sub tabs */}
          <div style={{display:"flex",gap:0,borderBottom:`2px solid ${QB.borderLight}`,marginBottom:24}}>
            {[{id:"log",label:"Collection Log"},{id:"add",label:editingLog?"Edit Record":"Add Record"}].map(v=>(
              <button key={v.id} onClick={()=>setCollView(v.id)} style={{padding:"8px 18px",fontSize:13,fontWeight:collView===v.id?600:400,border:"none",borderBottom:collView===v.id?`2px solid ${QB.blue}`:"2px solid transparent",marginBottom:-2,background:"transparent",color:collView===v.id?QB.blue:QB.textSecondary,cursor:"pointer",fontFamily:QB.fontFamily}}>{v.label}</button>
            ))}
          </div>

          {/* Collection Log table */}
          {collView==="log"&&<>
            {/* YTD Summary — only when no month filter */}
            {!collFilterMonth&&ytdLogs.length>0&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
                {[
                  {label:`YTD ${currentYear} Invoices`,  value:`EGP ${fmtShort(ytdTotals.invoices)}`,  color:QB.textPrimary},
                  {label:`YTD ${currentYear} Collection`,value:`EGP ${fmtShort(ytdTotals.collection)}`,color:QB.green},
                  {label:`YTD ${currentYear} Rev. Share`,value:`EGP ${fmtShort(ytdTotals.revShare)}`,  color:QB.blue},
                  {label:`YTD ${currentYear} Rate`,      value:`${ytdRate}%`,                           color:ytdRate>=90?QB.green:ytdRate>=70?QB.amber:QB.red},
                ].map(({label,value,color})=>(
                  <div key={label} style={{...s.card,marginBottom:0,textAlign:"center",padding:"14px 16px"}}>
                    <div style={{fontSize:11,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>{label}</div>
                    <div style={{fontSize:20,fontWeight:700,color}}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            <div style={s.card}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,flexWrap:"wrap",gap:10}}>
              <div style={s.cardTitle}>Collection Records</div>
              <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                {/* Filter: Property */}
                <select style={{...s.input,width:150,fontSize:12}} value={collFilterProp} onChange={e=>setCollFilterProp(e.target.value)}>
                  <option value="">All properties</option>
                  {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                {/* Filter: Month */}
                <input type="month" style={{...s.input,width:150,fontSize:12}} value={collFilterMonth} onChange={e=>setCollFilterMonth(e.target.value)} placeholder="All months"/>
                {/* Export PDF */}
                <button style={{...s.btnS,padding:"7px 14px",fontSize:12,display:"flex",alignItems:"center",gap:5}}
                  onClick={()=>exportCollectionPDF(filteredLogs,collFilterProp,collFilterMonth,properties,settings)}>
                  📄 Export PDF
                </button>
                {/* Add Record — editors only */}
                {isEditor&&<button style={{...s.btnP,padding:"7px 16px",fontSize:12}} onClick={()=>{setEditingLog(null);setCollForm({property_id:"",month:new Date().toISOString().slice(0,7),total_invoices:"",total_revenue_share:"",total_collection:"",notes:""});setCollView("add");}}>+ Add Record</button>}
              </div>
            </div>
            {filteredLogs.length===0?<Empty text="No collection records match your filters"/>:(
              <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr>
                    {[...(!collFilterProp?["Property"]:[]),"Month","Invoices","Rev. Share","Collection","Rate","Notes","By",...(isEditor?[""]:[])].map((h,i)=><th key={i} style={s.th}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {/* Group by property */}
                    {[...new Set(filteredLogs.map(l=>l.property_name))].flatMap((propName,propIdx)=>{
                      const propLogs=filteredLogs.filter(l=>l.property_name===propName);
                      const subInv=propLogs.reduce((a,l)=>a+(parseFloat(l.total_invoices)||0),0);
                      const subColl=propLogs.reduce((a,l)=>a+(parseFloat(l.total_collection)||0),0);
                      const subRS=propLogs.reduce((a,l)=>a+(parseFloat(l.total_revenue_share)||0),0);
                      const subRate=subInv>0?Math.round(subColl/subInv*100):0;
                      const rows=[];
                      if(propIdx>0) rows.push(
                        <tr key={`sep-${propName}`}><td colSpan={9} style={{padding:"4px 0",background:QB.bgPage,borderBottom:`2px solid ${QB.borderLight}`}}></td></tr>
                      );
                      propLogs.forEach((log,idx)=>{
                        const rate=log.total_invoices>0?Math.round(log.total_collection/log.total_invoices*100):0;
                        rows.push(
                          <tr key={log.id} style={{background:QB.bgCard}}>
                            {!collFilterProp&&<td style={{...s.td,fontWeight:600,color:QB.textPrimary}}>
                              {idx===0
                                ?<div style={{display:"flex",alignItems:"center",gap:8}}>
                                  <PropLogo url={filteredLogs.find(l=>l.property_name===propName)?.logo_url||""} name={propName} size={20}/>
                                  {propName}
                                </div>
                                :<span style={{color:QB.textMuted,fontSize:11,paddingLeft:28}}>↳</span>
                              }
                            </td>}
                            <td style={{...s.td,color:QB.textSecondary}}>{fmtMonth(log.month)}</td>
                            <td style={s.td}>EGP {fmtShort(log.total_invoices)}</td>
                            <td style={s.td}>EGP {fmtShort(log.total_revenue_share)}</td>
                            <td style={{...s.td,fontWeight:600,color:QB.green}}>EGP {fmtShort(log.total_collection)}</td>
                            <td style={s.td}><RateBadge rate={rate}/></td>
                            <td style={{...s.td,color:QB.textSecondary,fontSize:12,maxWidth:180}}>{log.notes||<span style={{color:QB.textMuted}}>—</span>}</td>
                            <td style={{...s.td,color:QB.textMuted,fontSize:12}}>{log.updated_by_name||log.created_by_name}</td>
                            {isEditor&&<td style={s.td}>
                              <div style={{display:"flex",gap:6}}>
                                <button style={{...s.btnS,padding:"3px 10px",fontSize:12}} onClick={()=>{
                                  setEditingLog(log);
                                  setCollForm({property_id:log.property_id,month:log.month,total_invoices:log.total_invoices,total_revenue_share:log.total_revenue_share,total_collection:log.total_collection,notes:log.notes||""});
                                  setCollView("add");
                                }}>Edit</button>
                                {isAdmin&&<button style={{...s.btnS,padding:"3px 10px",fontSize:12,color:QB.red,borderColor:QB.redBorder}} onClick={async()=>{
                                  if(!confirm("Delete this record?"))return;
                                  await apiFetch(`/collection-logs/${log.id}`,{method:"DELETE"});
                                  load();flash("Record deleted");
                                }}>Delete</button>}
                              </div>
                            </td>}
                          </tr>
                        );
                      });
                      if(!collFilterProp&&propLogs.length>1) rows.push(
                        <tr key={`sub-${propName}`} style={{background:"#EEF5FB",borderTop:`1px dashed ${QB.borderCard}`}}>
                          <td style={{...s.td,fontWeight:600,color:QB.blue,fontSize:12,paddingLeft:36}}>{propName} subtotal</td>
                          <td style={s.td}/>
                          <td style={{...s.td,fontWeight:600,color:QB.textPrimary,fontSize:12}}>EGP {fmtShort(subInv)}</td>
                          <td style={{...s.td,fontWeight:600,color:QB.textPrimary,fontSize:12}}>EGP {fmtShort(subRS)}</td>
                          <td style={{...s.td,fontWeight:600,color:QB.green,fontSize:12}}>EGP {fmtShort(subColl)}</td>
                          <td style={s.td}><RateBadge rate={subRate}/></td>
                          <td style={s.td}/><td style={s.td}/>{isEditor&&<td style={s.td}/>}
                        </tr>
                      );
                      return rows;
                    })}
                    {/* Totals row */}
                    {filteredLogs.length>0&&<tr style={{background:QB.bgSidebar,borderTop:`2px solid ${QB.borderCard}`}}>
                      {!collFilterProp&&<td style={{...s.td,fontWeight:700,color:QB.textPrimary,fontSize:12}}>TOTAL</td>}
                      <td style={{...s.td,fontWeight:700,color:QB.textPrimary,fontSize:12}}>{collFilterProp?"TOTAL":""}</td>
                      <td style={{...s.td,fontWeight:700,color:QB.textPrimary}}>EGP {fmtShort(collTotals.invoices)}</td>
                      <td style={{...s.td,fontWeight:700,color:QB.textPrimary}}>EGP {fmtShort(collTotals.revShare)}</td>
                      <td style={{...s.td,fontWeight:700,color:QB.green}}>EGP {fmtShort(collTotals.collection)}</td>
                      <td style={s.td}><RateBadge rate={collTotalRate}/></td>
                      <td style={s.td}></td>
                      <td style={s.td}></td>
                      {isEditor&&<td style={s.td}></td>}
                    </tr>}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          </>}

          {/* Add/Edit form */}
          {collView==="add"&&<div style={s.card}>
            <div style={s.cardTitle}>{editingLog?"Edit Collection Record":"Add Collection Record"}</div>
            <div style={s.formGrid}>
              <div><label style={s.label}>Property</label>
                <select style={s.input} value={collForm.property_id} onChange={e=>setCollForm(f=>({...f,property_id:e.target.value}))} disabled={!!editingLog}>
                  <option value="">Select property</option>
                  {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={s.label}>Month</label>
                <input type="month" style={s.input} value={collForm.month} onChange={e=>setCollForm(f=>({...f,month:e.target.value}))} disabled={!!editingLog}/>
              {editingLog&&collForm.month&&<div style={{fontSize:11,color:QB.textMuted,marginTop:4}}>{fmtMonth(collForm.month)}</div>}
              </div>
              <div><label style={s.label}>Total Invoices (EGP)</label>
                <input type="number" style={s.input} value={collForm.total_invoices} onChange={e=>setCollForm(f=>({...f,total_invoices:e.target.value}))} placeholder="0.00"/>
              </div>
              <div><label style={s.label}>Revenue Share (EGP)</label>
                <input type="number" style={s.input} value={collForm.total_revenue_share} onChange={e=>setCollForm(f=>({...f,total_revenue_share:e.target.value}))} placeholder="0.00"/>
              </div>
              <div><label style={s.label}>Collection (EGP)</label>
                <input type="number" style={s.input} value={collForm.total_collection} onChange={e=>setCollForm(f=>({...f,total_collection:e.target.value}))} placeholder="0.00"/>
              </div>
              <div><label style={s.label}>Notes <span style={{color:QB.textMuted,fontWeight:400}}>(optional)</span></label>
                <input style={s.input} value={collForm.notes} onChange={e=>setCollForm(f=>({...f,notes:e.target.value}))} placeholder="Any remarks..."/>
              </div>
            </div>
            {/* Live rate preview */}
            {collForm.total_invoices>0&&collForm.total_collection>=""&&(
              <div style={{marginBottom:16,padding:"10px 14px",background:QB.bgSidebar,borderRadius:QB.radiusMD,border:`1px solid ${QB.borderLight}`,fontSize:13,color:QB.textSecondary}}>
                Collection rate: <strong style={{color:QB.textPrimary}}>{Math.round((parseFloat(collForm.total_collection)||0)/(parseFloat(collForm.total_invoices)||1)*100)}%</strong>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button style={s.btnP} onClick={async()=>{
                if(!collForm.property_id||!collForm.month){flash("Property and month required","error");return;}
                try{
                  if(editingLog){
                    await apiFetch(`/collection-logs/${editingLog.id}`,{method:"PATCH",body:JSON.stringify({total_invoices:parseFloat(collForm.total_invoices)||0,total_revenue_share:parseFloat(collForm.total_revenue_share)||0,total_collection:parseFloat(collForm.total_collection)||0,notes:collForm.notes})});
                    flash("Record updated");
                  }else{
                    await apiFetch("/collection-logs",{method:"POST",body:JSON.stringify({...collForm,property_id:parseInt(collForm.property_id),total_invoices:parseFloat(collForm.total_invoices)||0,total_revenue_share:parseFloat(collForm.total_revenue_share)||0,total_collection:parseFloat(collForm.total_collection)||0})});
                    flash("Record added");
                  }
                  setEditingLog(null);setCollView("log");load();
                }catch(e){flash(e.message,"error");}
              }}>{editingLog?"Save changes":"Add record"}</button>
              <button style={s.btnS} onClick={()=>{setEditingLog(null);setCollView("log");}}>Cancel</button>
            </div>
          </div>}
        </>}

        {/* ══════════════════════════════════════════════════════════════════
            EMAIL TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="email"&&isEditor&&<>
          <div style={{display:"flex",gap:0,borderBottom:`2px solid ${QB.borderLight}`,marginBottom:24}}>
            {[{id:"send",label:"Send Update"},{id:"log",label:"Email Log"}].map(v=>(
              <button key={v.id} onClick={()=>setCollView(v.id)} style={{padding:"8px 18px",fontSize:13,fontWeight:collView===v.id?600:400,border:"none",borderBottom:collView===v.id?`2px solid ${QB.blue}`:"2px solid transparent",marginBottom:-2,background:"transparent",color:collView===v.id?QB.blue:QB.textSecondary,cursor:"pointer",fontFamily:QB.fontFamily}}>{v.label}</button>
            ))}
          </div>

          {collView!=="log"&&<div style={s.card}>
            <div style={s.cardTitle}>Collection Update Email</div>
            <div style={{marginBottom:16}}>
              <label style={s.label}>Month</label>
              <input type="month" style={{...s.input,width:"auto"}} value={collMonth} onChange={e=>setCollMonth(e.target.value)}/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={s.label}>Properties</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
                {properties.map(p=>(
                  <div key={p.id} onClick={()=>setCollProps(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])}
                    style={{display:"flex",alignItems:"center",gap:6,padding:"6px 12px",borderRadius:QB.radiusLG,fontSize:12,cursor:"pointer",userSelect:"none",border:`1.5px solid ${collProps.includes(p.id)?QB.blue:QB.borderInput}`,background:collProps.includes(p.id)?QB.blueLight:QB.bgCard,color:collProps.includes(p.id)?QB.blue:QB.textSecondary,fontWeight:collProps.includes(p.id)?600:400,fontFamily:QB.fontFamily}}>
                    <PropLogo url={p.logo_url} name={p.name} size={18}/>
                    {p.name} {collProps.includes(p.id)?"✓":""}
                  </div>
                ))}
              </div>
            </div>
            {collProps.length>0&&<div style={{marginBottom:16}}>
              <label style={s.label}>Collection figures</label>
              <div style={{border:`1px solid ${QB.borderCard}`,borderRadius:QB.radiusLG,overflow:"hidden",marginTop:6}}>
                <div style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr",background:QB.bgSidebar,padding:"10px 14px",fontSize:11,color:QB.textSecondary,fontWeight:600,textTransform:"uppercase",letterSpacing:".07em",borderBottom:`1px solid ${QB.borderLight}`}}>
                  <span>Property</span><span>Total Invoices</span><span>Revenue Share</span><span>Collection</span>
                </div>
                {collProps.map(pid=>{
                  const prop=properties.find(p=>p.id===pid);
                  const d=collData[pid]||{};
                  return<div key={pid} style={{display:"grid",gridTemplateColumns:"1.4fr 1fr 1fr 1fr",gap:8,padding:"10px 14px",borderTop:`1px solid ${QB.borderLight}`,alignItems:"center"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <PropLogo url={prop?.logo_url} name={prop?.name||"?"} size={22}/>
                      <span style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}>{prop?.name}</span>
                    </div>
                    {["invoices","revenue_share","collection"].map(field=>(
                      <input key={field} type="number" style={{...s.input,fontSize:12}} placeholder="0.00"
                        value={d[field]||""} onChange={e=>setCollData(prev=>({...prev,[pid]:{...prev[pid],[field]:e.target.value}}))}/>
                    ))}
                  </div>;
                })}
              </div>
            </div>}
            <div style={{marginBottom:16}}>
              <label style={s.label}>Notes <span style={{color:QB.textMuted,fontWeight:400}}>(optional)</span></label>
              <textarea style={{...s.input,minHeight:72,resize:"vertical"}} value={collNotes} onChange={e=>setCollNotes(e.target.value)} placeholder="Any additional comments..."/>
            </div>
            <div style={{marginBottom:24}}>
              <label style={s.label}>Send to</label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
                {(isAdmin?users:users.filter(u=>u.id!==user?.id)).map(u=>(
                  <div key={u.id} onClick={()=>setCollRecipients(prev=>prev.includes(u.id)?prev.filter(x=>x!==u.id):[...prev,u.id])}
                    style={{display:"flex",alignItems:"center",gap:7,padding:"6px 12px",borderRadius:QB.radiusLG,fontSize:12,cursor:"pointer",userSelect:"none",border:`1.5px solid ${collRecipients.includes(u.id)?QB.blue:QB.borderInput}`,background:collRecipients.includes(u.id)?QB.blueLight:QB.bgCard,color:collRecipients.includes(u.id)?QB.blue:QB.textSecondary,fontWeight:collRecipients.includes(u.id)?600:400,fontFamily:QB.fontFamily}}>
                    <Avatar name={u.full_name} size={20}/>
                    {u.full_name.split(" ").slice(0,2).join(" ")} {collRecipients.includes(u.id)&&"✓"}
                  </div>
                ))}
              </div>
            </div>
            <button style={{...s.btnR,opacity:sending?0.6:1}} disabled={sending} onClick={async()=>{
              if(collProps.length===0){alert("Select at least one property");return;}
              if(collRecipients.length===0){alert("Select at least one recipient");return;}
              setSending(true);
              try{
                const res=await apiFetch("/collection/send-email",{method:"POST",body:JSON.stringify({property_ids:collProps,month:collMonth,collections:collData,recipient_user_ids:collRecipients,notes:collNotes})});
                if(res){flash(`Email sent to ${res.sent_to.length} recipients`);setCollProps([]);setCollData({});setCollNotes("");setCollRecipients([]);setCollView("log");}
              }catch(e){flash(e.message,"error");}
              finally{setSending(false);}
            }}>{sending?"Sending...":"Send collection update"}</button>
          </div>}

          {collView==="log"&&<div style={s.card}>
            <div style={s.cardTitle}>Email Log</div>
            {emailLogs.length===0?<Empty text="No emails sent yet"/>:emailLogs.map(log=>(
              <div key={log.id} style={{padding:"14px 0",borderBottom:`1px solid ${QB.borderLight}`}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                  <div>
                    <div style={{fontSize:13,fontWeight:600,color:QB.textPrimary,marginBottom:3}}>{log.subject}</div>
                    <div style={{fontSize:12,color:QB.textSecondary,marginBottom:2}}>Properties: {log.property_names}</div>
                    <div style={{fontSize:12,color:QB.textMuted}}>To: {log.recipients}</div>
                  </div>
                  <div style={{textAlign:"right",flexShrink:0}}>
                    <Badge label={log.status} color="green"/>
                    <div style={{fontSize:11,color:QB.textMuted,marginTop:5}}>{new Date((log.sent_at.endsWith("Z")?log.sent_at:log.sent_at+"Z")).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Cairo"})}</div>
                    <div style={{fontSize:11,color:QB.textMuted}}>by {log.sent_by_name}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>}
        </>}

        {/* ══════════════════════════════════════════════════════════════════
            MANAGE REPORTS TAB (admin only)
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="manage-reports"&&isAdmin&&<>
          <div style={s.card}>
            <div style={s.cardTitle}>All reports</div>
            {reports.length===0?<Empty text="No reports yet"/>:(
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead><tr>{["Name","Property","Type","Category","",""].map((h,i)=><th key={i} style={s.th}>{h}</th>)}</tr></thead>
                <tbody>{reports.map(r=>(
                  <tr key={r.id}>
                    <td style={{...s.td,fontWeight:600}}>{r.report_name}</td>
                    <td style={{...s.td,color:QB.textSecondary}}>{r.property_name}</td>
                    <td style={s.td}><Badge label={r.report_type} color="blue"/></td>
                    <td style={s.td}>{r.category?<Badge label={r.category} color="gray"/>:<span style={{color:QB.textMuted,fontSize:12}}>—</span>}</td>
                    <td style={s.td}><button style={{...s.btnS,padding:"3px 10px",fontSize:12}} onClick={()=>{setEditReport(r);setEditReportForm({report_name:r.report_name,report_type:r.report_type,category:r.category||"",embed_url:r.embed_url||""});}}>Edit</button></td>
                    <td style={s.td}><button style={{background:"none",border:"none",cursor:"pointer",color:QB.red,fontSize:12,fontWeight:600}} onClick={async()=>{if(!confirm("Delete?"))return;await apiFetch(`/reports/${r.id}`,{method:"DELETE"});load();flash("Deleted");}}>✕</button></td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
          <div style={s.card}>
            <div style={s.cardTitle}>Add report</div>
            <div style={s.formGrid}>
              <div><label style={s.label}>Property</label>
                <select style={s.input} value={newReport.property_id} onChange={e=>setNewReport(p=>({...p,property_id:e.target.value}))}>
                  <option value="">Select</option>{properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={s.label}>Report name</label><input style={s.input} value={newReport.report_name} onChange={e=>setNewReport(p=>({...p,report_name:e.target.value}))} placeholder="e.g. Collection Update"/></div>
              <div><label style={s.label}>Type</label>
                <select style={s.input} value={newReport.report_type} onChange={e=>setNewReport(p=>({...p,report_type:e.target.value}))}>
                  {reportTypes.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div><label style={s.label}>Category <span style={{color:QB.textMuted,fontWeight:400}}>(optional — groups reports in sidebar)</span></label>
                <input style={s.input} value={newReport.category} onChange={e=>setNewReport(p=>({...p,category:e.target.value}))} placeholder="e.g. Financial, Operations, Compliance"/>
              </div>
              <div style={{gridColumn:"1/-1"}}><label style={s.label}>Embed URL</label><input style={s.input} value={newReport.embed_url} onChange={e=>setNewReport(p=>({...p,embed_url:e.target.value}))} placeholder="https://app.powerbi.com/..."/></div>
            </div>
            <button style={s.btnP} onClick={async()=>{
              if(!newReport.property_id||!newReport.report_name){flash("Fill required fields","error");return;}
              try{await apiFetch("/reports",{method:"POST",body:JSON.stringify({...newReport,property_id:parseInt(newReport.property_id)})});setNewReport({property_id:"",report_name:"",report_type:"Collection",category:"",embed_url:""});load();flash("Report added");}
              catch(e){flash(e.message,"error");}
            }}>Add report</button>
          </div>
        </>}

        {/* ══════════════════════════════════════════════════════════════════
            USERS TAB (admin only)
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="users"&&isAdmin&&<>
          <div style={s.card}>
            <div style={s.cardTitle}>Team members</div>
            {users.map(u=>(
              <div key={u.id} style={{padding:"14px 0",borderBottom:`1px solid ${QB.borderLight}`,opacity:u.is_active?1:0.5}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,flex:1}}>
                    <Avatar name={u.full_name} size={32}/>
                    <div style={{flex:1}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <span style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}>{u.full_name}</span>
                        <Badge label={u.role} color={u.role==="admin"?"purple":u.role==="editor"?"blue":"gray"}/>
                        {!u.is_active&&<Badge label="Inactive" color="red"/>}
                      </div>
                      <div style={{fontSize:12,color:QB.textMuted}}>{u.username} · {u.email||"No email"}</div>
                      {u.title&&<div style={{fontSize:12,color:QB.textSecondary}}>{u.title}</div>}
                    </div>
                  </div>
                  <div style={{display:"flex",gap:8}}>
                    <button style={{...s.btnS,padding:"4px 12px",fontSize:12}} onClick={()=>{
                      setEditUser(u);
                      setEditUserForm({full_name:u.full_name,email:u.email||"",title:u.title||"",role:u.role});
                      const acc=userAccess[u.id]||[];
                      setEditUserAccess(acc);
                    }}>Edit</button>
                    {u.id!==user?.id&&<button style={{...s.btnS,padding:"4px 12px",fontSize:12,color:u.is_active?QB.amber:QB.green,borderColor:u.is_active?QB.amberBorder:QB.greenBorder}} onClick={async()=>{
                      const action=u.is_active?"Deactivate":"Activate";
                      if(!confirm(`${action} "${u.full_name}"?`))return;
                      await apiFetch(`/users/${u.id}`,{method:"PATCH",body:JSON.stringify({is_active:!u.is_active})});
                      load();flash(`${action}d`);
                    }}>{u.is_active?"Deactivate":"Activate"}</button>}
                  </div>
                </div>
                {u.role!=="admin"&&u.is_active&&(
                  <div style={{marginTop:8,display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",paddingLeft:42}}>
                    <span style={{fontSize:11,color:QB.textMuted,marginRight:4}}>Access:</span>
                    {properties.map(p=>{
                      const hasAccess=!userAccess[u.id]?.length||userAccess[u.id]?.includes(p.id);
                      return<span key={p.id} style={{padding:"2px 9px",borderRadius:20,fontSize:11,background:hasAccess?QB.greenBg:"#F1F3F5",color:hasAccess?QB.green:QB.textMuted,border:`1px solid ${hasAccess?QB.greenBorder:QB.borderLight}`,fontFamily:QB.fontFamily}}>{p.name}</span>;
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div style={s.card}>
            <div style={s.cardTitle}>Add user</div>
            <div style={s.formGrid}>
              <div><label style={s.label}>Username</label><input style={s.input} value={newUser.username} onChange={e=>setNewUser(p=>({...p,username:e.target.value}))} placeholder="first.last"/></div>
              <div><label style={s.label}>Full name</label><input style={s.input} value={newUser.full_name} onChange={e=>setNewUser(p=>({...p,full_name:e.target.value}))}/></div>
              <div><label style={s.label}>Email</label><input style={s.input} value={newUser.email} onChange={e=>setNewUser(p=>({...p,email:e.target.value}))}/></div>
              <div><label style={s.label}>Title</label><input style={s.input} value={newUser.title} onChange={e=>setNewUser(p=>({...p,title:e.target.value}))}/></div>
              <div><label style={s.label}>Password</label><input type="password" style={s.input} value={newUser.password} onChange={e=>setNewUser(p=>({...p,password:e.target.value}))}/></div>
              <div><label style={s.label}>Role</label>
                <select style={s.input} value={newUser.role} onChange={e=>setNewUser(p=>({...p,role:e.target.value}))}>
                  <option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option>
                </select>
              </div>
            </div>
            {newUser.role!=="admin"&&<div style={{marginBottom:16}}>
              <label style={s.label}>Property access <span style={{color:QB.textMuted,fontWeight:400}}>(empty = all)</span></label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
                {properties.map(p=>(
                  <div key={p.id} onClick={()=>setNewUserAccess(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])}
                    style={{padding:"5px 12px",borderRadius:20,fontSize:12,cursor:"pointer",border:`1.5px solid ${newUserAccess.includes(p.id)?QB.blue:QB.borderInput}`,background:newUserAccess.includes(p.id)?QB.blueLight:QB.bgCard,color:newUserAccess.includes(p.id)?QB.blue:QB.textSecondary,fontWeight:newUserAccess.includes(p.id)?600:400,userSelect:"none",fontFamily:QB.fontFamily}}>
                    {p.name} {newUserAccess.includes(p.id)?"✓":""}
                  </div>
                ))}
              </div>
            </div>}
            <button style={s.btnP} onClick={async()=>{
              if(!newUser.username||!newUser.full_name||!newUser.password){flash("Fill required fields","error");return;}
              try{
                const res=await apiFetch("/users",{method:"POST",body:JSON.stringify(newUser)});
                if(res&&newUserAccess.length>0)await apiFetch(`/user-access/${res.id}`,{method:"POST",body:JSON.stringify({property_ids:newUserAccess})});
                setNewUser({username:"",full_name:"",email:"",title:"",password:"",role:"viewer"});setNewUserAccess([]);load();flash("User added");
              }catch(e){flash(e.message,"error");}
            }}>Add user</button>
          </div>
        </>}

        {/* ══════════════════════════════════════════════════════════════════
            ACTIVITY TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="activity"&&<div style={s.card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,flexWrap:"wrap",gap:12}}>
            <div style={s.cardTitle}>Activity Timeline</div>
            {isAdmin&&<div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
              <div>
                <label style={{...s.label,marginBottom:2}}>Filter by user</label>
                <select style={{...s.input,width:180}} value={actFilterUser} onChange={e=>setActFilterUser(e.target.value)}>
                  <option value="">All users</option>
                  {users.map(u=><option key={u.id} value={u.id}>{u.full_name}</option>)}
                </select>
              </div>
              <div>
                <label style={{...s.label,marginBottom:2}}>Period</label>
                <select style={{...s.input,width:120}} value={actFilterDays} onChange={e=>setActFilterDays(parseInt(e.target.value))}>
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
              <div style={{alignSelf:"flex-end"}}>
                <button style={{...s.btnS,padding:"8px 14px",fontSize:12,color:QB.red,borderColor:QB.redBorder}}
                  onClick={async()=>{
                    if(!confirm("Clear ALL activity logs? This cannot be undone."))return;
                    await apiFetch("/activity-logs",{method:"DELETE"});
                    loadActivities();flash("Activity log cleared");
                  }}>🗑 Clear all</button>
              </div>
            </div>}
          </div>
          {activities.length===0?<Empty text="No activity yet"/>:(
            <div style={{display:"flex",flexDirection:"column",gap:0}}>
              {activities.map((a,i)=>(
                <div key={a.id} style={{display:"flex",gap:14,paddingBottom:16,paddingTop:i===0?0:16,borderBottom:i<activities.length-1?`1px solid ${QB.borderLight}`:"none"}}>
                  {/* Icon */}
                  <div style={{width:36,height:36,borderRadius:"50%",background:QB.bgSidebar,border:`1px solid ${QB.borderLight}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:16,flexShrink:0}}>
                    {actIcon(a.action)}
                  </div>
                  {/* Content */}
                  <div style={{flex:1}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8}}>
                      <div>
                        <span style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}>{a.user_name}</span>
                        <span style={{fontSize:13,color:QB.textSecondary}}> {a.action}</span>
                        {a.entity_name&&<span style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}> {a.entity_name}</span>}
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                        <span style={{fontSize:11,color:QB.textMuted}}>
                          {new Date((a.created_at.endsWith("Z")?a.created_at:a.created_at+"Z")).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Cairo"})}
                        </span>
                        {isAdmin&&<button style={{background:"none",border:"none",cursor:"pointer",color:QB.textMuted,fontSize:14,padding:"0 2px",lineHeight:1}} title="Delete this entry"
                          onClick={async()=>{
                            await apiFetch(`/activity-logs/${a.id}`,{method:"DELETE"});
                            loadActivities();
                          }}>✕</button>}
                      </div>
                    </div>
                    {a.details&&<div style={{fontSize:12,color:QB.textMuted,marginTop:2}}>{a.details}</div>}
                    {isAdmin&&<Badge label={a.user_role} color={a.user_role==="admin"?"purple":a.user_role==="editor"?"blue":"gray"}/>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>}

        {/* ══════════════════════════════════════════════════════════════════
            SETTINGS TAB (admin only)
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="settings"&&isAdmin&&<div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:20,alignItems:"start"}}>

          {/* ── Branding ── */}
          <div style={s.card}>
            <div style={s.cardTitle}>🎨 Branding</div>

            <div style={{marginBottom:14}}>
              <label style={s.label}>App name</label>
              <input style={s.input} value={settingsForm.app_name||""} onChange={e=>setSettingsForm(f=>({...f,app_name:e.target.value}))} placeholder="Savills Egypt CA"/>
            </div>

            <div style={{marginBottom:14}}>
              <label style={s.label}>Portal tagline</label>
              <input style={s.input} value={settingsForm.portal_tagline||""} onChange={e=>setSettingsForm(f=>({...f,portal_tagline:e.target.value}))} placeholder="Client Accounting · Property Management"/>
            </div>

            <div style={{marginBottom:8}}>
              <label style={s.label}>Logo URL</label>
              <input style={s.input} value={settingsForm.logo_url||""} onChange={e=>setSettingsForm(f=>({...f,logo_url:e.target.value}))} placeholder="https://..."/>
              <div style={{fontSize:11,color:QB.textMuted,marginTop:4,lineHeight:1.5}}>
                💡 Use a direct image URL (PNG/SVG). Best option: upload to GitHub at
                <code style={{background:QB.bgSidebar,padding:"0 4px",borderRadius:3,fontSize:10}}> frontend/public/savills-logo.svg</code>
                then use <code style={{background:QB.bgSidebar,padding:"0 4px",borderRadius:3,fontSize:10}}>https://savills-ca-portal.vercel.app/savills-logo.svg</code>
              </div>
            </div>
            {settingsForm.logo_url&&(
              <div style={{marginBottom:14}}>
                <div style={{fontSize:11,color:QB.textMuted,marginBottom:6}}>Preview:</div>
                <div style={{padding:"12px 16px",background:QB.bgSidebar,borderRadius:QB.radiusMD,border:`1px solid ${QB.borderLight}`,display:"flex",alignItems:"center",gap:12,minHeight:60}}>
                  <img
                    src={settingsForm.logo_url}
                    alt="logo preview"
                    style={{height:40,maxWidth:120,objectFit:"contain",borderRadius:4}}
                    onLoad={e=>{e.target.style.opacity=1;e.target.nextSibling.style.display="none";}}
                    onError={e=>{e.target.style.display="none";e.target.nextSibling.textContent="⚠ Could not load image — check the URL";e.target.nextSibling.style.color=QB.red;}}
                  />
                  <span style={{fontSize:12,color:QB.textSecondary}}>Loading preview...</span>
                </div>
              </div>
            )}
          </div>

          {/* ── Colors ── */}
          <div style={s.card}>
            <div style={s.cardTitle}>🎨 Colors & Font</div>

            <div style={{marginBottom:16}}>
              <label style={s.label}>Primary color (buttons, tabs, links)</label>
              <div style={{display:"flex",gap:10,alignItems:"center",marginTop:4}}>
                <input type="color" value={settingsForm.primary_color||"#0077C5"}
                  onChange={e=>setSettingsForm(f=>({...f,primary_color:e.target.value}))}
                  style={{width:44,height:36,border:`1px solid ${QB.borderInput}`,borderRadius:QB.radiusMD,cursor:"pointer",padding:2}}/>
                <input style={{...s.input,fontFamily:"monospace",width:100}} value={settingsForm.primary_color||""} onChange={e=>setSettingsForm(f=>({...f,primary_color:e.target.value}))} placeholder="#0077C5"/>
                <div style={{width:36,height:36,borderRadius:QB.radiusMD,background:settingsForm.primary_color||"#0077C5",border:`1px solid ${QB.borderLight}`}}/>
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <label style={s.label}>Accent color (top bar, highlights)</label>
              <div style={{display:"flex",gap:10,alignItems:"center",marginTop:4}}>
                <input type="color" value={settingsForm.accent_color||"#FEDE07"}
                  onChange={e=>setSettingsForm(f=>({...f,accent_color:e.target.value}))}
                  style={{width:44,height:36,border:`1px solid ${QB.borderInput}`,borderRadius:QB.radiusMD,cursor:"pointer",padding:2}}/>
                <input style={{...s.input,fontFamily:"monospace",width:100}} value={settingsForm.accent_color||""} onChange={e=>setSettingsForm(f=>({...f,accent_color:e.target.value}))} placeholder="#FEDE07"/>
                <div style={{width:36,height:36,borderRadius:QB.radiusMD,background:settingsForm.accent_color||"#FEDE07",border:`1px solid ${QB.borderLight}`}}/>
              </div>
            </div>

            <div style={{marginBottom:4}}>
              <label style={s.label}>Font family</label>
              <select style={s.input} value={settingsForm.font_family||"Inter"} onChange={e=>setSettingsForm(f=>({...f,font_family:e.target.value}))}>
                <option value="Inter">Inter (default)</option>
                <option value="Roboto">Roboto</option>
                <option value="Open Sans">Open Sans</option>
                <option value="Lato">Lato</option>
                <option value="Poppins">Poppins</option>
                <option value="Montserrat">Montserrat</option>
                <option value="DM Sans">DM Sans</option>
                <option value="Plus Jakarta Sans">Plus Jakarta Sans</option>
              </select>
            </div>
          </div>

          {/* ── Email Settings ── */}
          <div style={s.card}>
            <div style={s.cardTitle}>📧 Email sender</div>

            <div style={{marginBottom:14}}>
              <label style={s.label}>Sender name</label>
              <input style={s.input} value={settingsForm.email_sender_name||""} onChange={e=>setSettingsForm(f=>({...f,email_sender_name:e.target.value}))} placeholder="Savills Egypt — Client Accounting"/>
            </div>

            <div style={{marginBottom:4}}>
              <label style={s.label}>Sender email</label>
              <input style={s.input} value={settingsForm.email_sender_email||""} onChange={e=>setSettingsForm(f=>({...f,email_sender_email:e.target.value}))} placeholder="ahmed.hamed@savills.me"/>
            </div>
          </div>

          {/* ── Preview & Save ── */}
          <div style={s.card}>
            <div style={s.cardTitle}>👁 Preview & Save</div>

            {/* Live preview topbar */}
            <div style={{marginBottom:16,border:`1px solid ${QB.borderCard}`,borderRadius:QB.radiusLG,overflow:"hidden"}}>
              <div style={{background:settingsForm.accent_color||"#FEDE07",height:4}}/>
              <div style={{background:"#fff",padding:"12px 16px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${QB.borderLight}`}}>
                {settingsForm.logo_url
                  ?<img src={settingsForm.logo_url} alt="logo" style={{width:30,height:30,borderRadius:4,objectFit:"contain"}} onError={e=>e.target.style.display="none"}/>
                  :<div style={{width:30,height:30,borderRadius:4,background:settingsForm.accent_color||"#FEDE07",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:900}}>S</div>
                }
                <div>
                  <div style={{fontSize:13,fontWeight:700,color:"#1C1C1C",fontFamily:`'${settingsForm.font_family||"Inter"}',sans-serif`}}>{settingsForm.app_name||"CA Portal"}</div>
                  <div style={{fontSize:10,color:"#8C96A3"}}>{settingsForm.portal_tagline||"Client Accounting"}</div>
                </div>
              </div>
              <div style={{background:"#F4F5F7",padding:"10px 16px",display:"flex",gap:16}}>
                {["Properties","Collection","Reports"].map(t=>(
                  <div key={t} style={{fontSize:12,fontWeight:t==="Properties"?600:400,color:t==="Properties"?settingsForm.primary_color||"#0077C5":"#57647A",borderBottom:t==="Properties"?`2px solid ${settingsForm.primary_color||"#0077C5"}`:"none",paddingBottom:4,fontFamily:`'${settingsForm.font_family||"Inter"}',sans-serif`}}>{t}</div>
                ))}
              </div>
              <div style={{background:"#F4F5F7",padding:"10px 16px"}}>
                <div style={{display:"inline-block",background:settingsForm.primary_color||"#0077C5",color:"#fff",padding:"6px 14px",borderRadius:6,fontSize:12,fontWeight:600,fontFamily:`'${settingsForm.font_family||"Inter"}',sans-serif`}}>Save changes</div>
              </div>
            </div>

            <button style={{...s.btnP,background:settingsForm.primary_color||QB.blue,width:"100%",opacity:settingsSaving?0.7:1}}
              disabled={settingsSaving}
              onClick={async()=>{
                setSettingsSaving(true);
                try{
                  await updateSettings(settingsForm);
                  flash("Settings saved — changes applied immediately!");
                }catch(e){flash(e.message,"error");}
                finally{setSettingsSaving(false);}
              }}>
              {settingsSaving?"Saving...":"💾 Save & Apply"}
            </button>

            <button style={{...s.btnS,width:"100%",marginTop:8,fontSize:12}}
              onClick={()=>setSettingsForm({
                app_name:"Savills Egypt CA",
                logo_url:"https://savills-ca-portal.vercel.app/savills-logo.svg",
                primary_color:"#0077C5",
                accent_color:"#FEDE07",
                font_family:"Inter",
                email_sender_name:"Savills Egypt — Client Accounting",
                email_sender_email:"ahmed.hamed@savills.me",
                portal_tagline:"Client Accounting · Property Management",
              })}>
              Reset to defaults
            </button>
          </div>

        </div>}

        {/* ══════════════════════════════════════════════════════════════════
            MODALS
        ══════════════════════════════════════════════════════════════════ */}

        {/* Profile Modal */}
        {showProfile&&<div style={s.overlay}>
          <div style={{...s.modal,width:420}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <Avatar name={user?.full_name||"U"} size={40}/>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:QB.textPrimary}}>{user?.full_name}</div>
                  <div style={{fontSize:12,color:QB.textMuted}}>{user?.role}</div>
                </div>
              </div>
              <button onClick={()=>setShowProfile(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
            </div>
            {/* Profile sub tabs */}
            <div style={{display:"flex",gap:0,borderBottom:`2px solid ${QB.borderLight}`,marginBottom:20}}>
              {[{id:"info",label:"My Info"},{id:"password",label:"Change Password"}].map(v=>(
                <button key={v.id} onClick={()=>setProfileTab(v.id)} style={{padding:"7px 16px",fontSize:12,fontWeight:profileTab===v.id?600:400,border:"none",borderBottom:profileTab===v.id?`2px solid ${QB.blue}`:"2px solid transparent",marginBottom:-2,background:"transparent",color:profileTab===v.id?QB.blue:QB.textSecondary,cursor:"pointer",fontFamily:QB.fontFamily}}>{v.label}</button>
              ))}
            </div>
            {profileTab==="info"&&<>
              <div style={{marginBottom:14}}><label style={s.label}>Full name</label><input style={s.input} value={profileForm.full_name} onChange={e=>setProfileForm(p=>({...p,full_name:e.target.value}))}/></div>
              <div style={{marginBottom:14}}><label style={s.label}>Email</label><input style={s.input} value={profileForm.email} onChange={e=>setProfileForm(p=>({...p,email:e.target.value}))}/></div>
              <div style={{marginBottom:20}}><label style={s.label}>Title</label><input style={s.input} value={profileForm.title} onChange={e=>setProfileForm(p=>({...p,title:e.target.value}))}/></div>
              <button style={s.btnP} onClick={async()=>{
                try{await apiFetch("/auth/profile",{method:"PATCH",body:JSON.stringify(profileForm)});setShowProfile(false);flash("Profile updated");load();}
                catch(e){flash(e.message,"error");}
              }}>Save changes</button>
            </>}
            {profileTab==="password"&&<>
              <div style={{marginBottom:14}}><label style={s.label}>Current password</label><input type="password" style={s.input} value={pwForm.current_password} onChange={e=>setPwForm(p=>({...p,current_password:e.target.value}))}/></div>
              <div style={{marginBottom:14}}><label style={s.label}>New password</label><input type="password" style={s.input} value={pwForm.new_password} onChange={e=>setPwForm(p=>({...p,new_password:e.target.value}))}/></div>
              <div style={{marginBottom:20}}><label style={s.label}>Confirm new password</label><input type="password" style={s.input} value={pwForm.confirm} onChange={e=>setPwForm(p=>({...p,confirm:e.target.value}))}/></div>
              <button style={s.btnP} onClick={async()=>{
                if(pwForm.new_password!==pwForm.confirm){flash("Passwords don't match","error");return;}
                try{await apiFetch("/auth/change-password",{method:"POST",body:JSON.stringify(pwForm)});setShowProfile(false);setPwForm({current_password:"",new_password:"",confirm:""});flash("Password changed");}
                catch(e){flash(e.message,"error");}
              }}>Update password</button>
            </>}
          </div>
        </div>}

        {/* Edit User Modal */}
        {editUser&&<div style={s.overlay}>
          <div style={s.modal}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={s.modalTitle}>Edit — {editUser.full_name}</div>
              <button onClick={()=>setEditUser(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
            </div>
            <div style={{marginBottom:14}}><label style={s.label}>Full name</label><input style={s.input} value={editUserForm.full_name} onChange={e=>setEditUserForm(p=>({...p,full_name:e.target.value}))}/></div>
            <div style={{marginBottom:14}}><label style={s.label}>Email</label><input style={s.input} value={editUserForm.email} onChange={e=>setEditUserForm(p=>({...p,email:e.target.value}))}/></div>
            <div style={{marginBottom:14}}><label style={s.label}>Title</label><input style={s.input} value={editUserForm.title} onChange={e=>setEditUserForm(p=>({...p,title:e.target.value}))}/></div>
            <div style={{marginBottom:16}}><label style={s.label}>Role</label>
              <select style={s.input} value={editUserForm.role} onChange={e=>setEditUserForm(p=>({...p,role:e.target.value}))}>
                <option value="viewer">Viewer</option><option value="editor">Editor</option><option value="admin">Admin</option>
              </select>
            </div>
            {editUserForm.role!=="admin"&&<div style={{marginBottom:16}}>
              <label style={s.label}>Property access <span style={{color:QB.textMuted,fontWeight:400}}>(empty = all)</span></label>
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:6}}>
                {properties.map(p=>(
                  <div key={p.id} onClick={()=>setEditUserAccess(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id])}
                    style={{padding:"5px 12px",borderRadius:20,fontSize:12,cursor:"pointer",border:`1.5px solid ${editUserAccess.includes(p.id)?QB.blue:QB.borderInput}`,background:editUserAccess.includes(p.id)?QB.blueLight:QB.bgCard,color:editUserAccess.includes(p.id)?QB.blue:QB.textSecondary,fontWeight:editUserAccess.includes(p.id)?600:400,userSelect:"none",fontFamily:QB.fontFamily}}>
                    {p.name} {editUserAccess.includes(p.id)?"✓":""}
                  </div>
                ))}
              </div>
            </div>}
            <div style={{display:"flex",gap:8}}>
              <button style={s.btnP} onClick={async()=>{
                try{
                  await apiFetch(`/users/${editUser.id}`,{method:"PATCH",body:JSON.stringify(editUserForm)});
                  await apiFetch(`/user-access/${editUser.id}`,{method:"POST",body:JSON.stringify({property_ids:editUserAccess})});
                  setEditUser(null);load();flash("User updated");
                }catch(e){flash(e.message,"error");}
              }}>Save changes</button>
              <button style={s.btnS} onClick={()=>setEditUser(null)}>Cancel</button>
            </div>
          </div>
        </div>}

        {/* Edit Property Modal */}
        {editProp&&<div style={s.overlay}>
          <div style={{...s.modal,width:420}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={s.modalTitle}>Edit — {editProp.name}</div>
              <button onClick={()=>setEditProp(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
            </div>
            <div style={{marginBottom:14}}><label style={s.label}>Name</label><input style={s.input} value={editPropForm.name} onChange={e=>setEditPropForm(p=>({...p,name:e.target.value}))}/></div>
            <div style={{marginBottom:14}}><label style={s.label}>Location</label><input style={s.input} value={editPropForm.location} onChange={e=>setEditPropForm(p=>({...p,location:e.target.value}))}/></div>
            <div style={{marginBottom:14}}><label style={s.label}>System</label>
              <select style={s.input} value={editPropForm.system} onChange={e=>setEditPropForm(p=>({...p,system:e.target.value}))}>
                <option value="">—</option><option>Oracle</option><option>Yardi</option>
              </select>
            </div>
            <div style={{marginBottom:8}}><label style={s.label}>Logo URL</label>
              <input style={s.input} value={editPropForm.logo_url} onChange={e=>setEditPropForm(p=>({...p,logo_url:e.target.value}))} placeholder="https://..."/>
            </div>
            {editPropForm.logo_url&&<div style={{marginBottom:16}}><img src={editPropForm.logo_url} alt="preview" style={{height:40,borderRadius:4,border:`1px solid ${QB.borderLight}`}} onError={e=>e.target.style.display="none"}/></div>}
            <div style={{marginBottom:16}}>
              <label style={s.label}>Landlord name <span style={{color:QB.textMuted,fontWeight:400}}>(optional)</span></label>
              <input style={s.input} value={editPropForm.landlord_name} onChange={e=>setEditPropForm(p=>({...p,landlord_name:e.target.value}))} placeholder="e.g. Arkan Development"/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={s.btnP} onClick={async()=>{
                try{await apiFetch(`/properties/${editProp.id}`,{method:"PATCH",body:JSON.stringify(editPropForm)});setEditProp(null);load();flash("Updated");}
                catch(e){flash(e.message,"error");}
              }}>Save</button>
              <button style={s.btnS} onClick={()=>setEditProp(null)}>Cancel</button>
            </div>
          </div>
        </div>}

        {/* Edit Report Modal */}
        {editReport&&<div style={s.overlay}>
          <div style={s.modal}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={s.modalTitle}>Edit report</div>
              <button onClick={()=>setEditReport(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
            </div>
            <div style={{marginBottom:14}}><label style={s.label}>Report name</label><input style={s.input} value={editReportForm.report_name} onChange={e=>setEditReportForm(p=>({...p,report_name:e.target.value}))}/></div>
            <div style={{marginBottom:14}}><label style={s.label}>Type</label>
              <select style={s.input} value={editReportForm.report_type} onChange={e=>setEditReportForm(p=>({...p,report_type:e.target.value}))}>
                {reportTypes.map(t=><option key={t}>{t}</option>)}
              </select>
            </div>
            <div style={{marginBottom:14}}><label style={s.label}>Category <span style={{color:QB.textMuted,fontWeight:400}}>(optional)</span></label>
              <input style={s.input} value={editReportForm.category} onChange={e=>setEditReportForm(p=>({...p,category:e.target.value}))} placeholder="e.g. Financial, Operations"/>
            </div>
            <div style={{marginBottom:20}}><label style={s.label}>Embed URL</label><textarea style={{...s.input,minHeight:80,resize:"vertical"}} value={editReportForm.embed_url} onChange={e=>setEditReportForm(p=>({...p,embed_url:e.target.value}))}/></div>
            <div style={{display:"flex",gap:8}}>
              <button style={s.btnP} onClick={async()=>{
                try{
                  await apiFetch(`/reports/${editReport.id}`,{method:"PATCH",body:JSON.stringify(editReportForm)});
                  setEditReport(null);load();flash("Updated");
                  if(selectedReport?.id===editReport.id)setSelectedReport({...selectedReport,...editReportForm});
                }catch(e){flash(e.message,"error");}
              }}>Save</button>
              <button style={s.btnS} onClick={()=>setEditReport(null)}>Cancel</button>
            </div>
          </div>
        </div>}

      </div>
    </div>
  );
}
