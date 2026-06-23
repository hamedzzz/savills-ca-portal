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

  const[tab,setTab]=useState("welcome");
  const[sidebarOpen,setSidebarOpen]=useState(false);
  const[welcomeGreeting,setWelcomeGreeting]=useState("");
  const[navHover,setNavHover]=useState("");
  const[homeExpanded,setHomeExpanded]=useState(true);
  const[adminExpanded,setAdminExpanded]=useState(false);
  const[selectedNavProp,setSelectedNavProp]=useState("");
  const[showAddPropForm,setShowAddPropForm]=useState(false);
  const[docSubTab,setDocSubTab]=useState("sop");
  const[sopDocs,setSopDocs]=useState([]);
  const[guideItems,setGuideItems]=useState([]);
  const[uploadingSOP,setUploadingSOP]=useState(false);
  const[editingGuide,setEditingGuide]=useState(null);
  const[newGuideForm,setNewGuideForm]=useState({section:"",title:"",content:""});
  const[showGuideForm,setShowGuideForm]=useState(false);
  const[docsExpanded,setDocsExpanded]=useState(false);
  const[annexText,setAnnexText]=useState("");
  const[annexExtracted,setAnnexExtracted]=useState(null);
  const[annexLoading,setAnnexLoading]=useState(false);
  const[annexGenerating,setAnnexGenerating]=useState(false);
  const[annexError,setAnnexError]=useState("");
  const[sopVersion,setSopVersion]=useState("");
  const[sopDesc,setSopDesc]=useState("");
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

  const[rentRolls,setRentRolls]=useState({});
  const[rentRollLeases,setRentRollLeases]=useState({});
  const[showRentRoll,setShowRentRoll]=useState(null);
  const[rrDrilldown,setRrDrilldown]=useState(null);
  const[uploadingRR,setUploadingRR]=useState(null);

  const[editRequests,setEditRequests]=useState([]);
  const[pendingCount,setPendingCount]=useState(0);
  const[showRequests,setShowRequests]=useState(false);
  const[requestForm,setRequestForm]=useState({reason:""});
  const[showRequestModal,setShowRequestModal]=useState(false);
  const[requestTarget,setRequestTarget]=useState(null); // the log being requested to edit
  const[reviewModal,setReviewModal]=useState(null);
  const[reviewNote,setReviewNote]=useState("");

  // Rent Roll tab filters
  const[rrTabProp,setRrTabProp]=useState("");
  const[rrTabSub,setRrTabSub]=useState("");
  const[rrTabType,setRrTabType]=useState("");
  const[rrTabExpiry,setRrTabExpiry]=useState("");
  const[rrTabSearch,setRrTabSearch]=useState("");
  const[rrTabDateFrom,setRrTabDateFrom]=useState("");
  const[rrTabDateTo,setRrTabDateTo]=useState("");
  const[rrTabLeases,setRrTabLeases]=useState([]);
  const[rrTabLoading,setRrTabLoading]=useState(false);
  const[rrTabMonth,setRrTabMonth]=useState("");
  const[rrHistory,setRrHistory]=useState([]);
  const[rrHistoryProp,setRrHistoryProp]=useState("");
  const[showRrHistory,setShowRrHistory]=useState(false);
  const[reconProp,setReconProp]=useState("");
  const[reconMonth,setReconMonth]=useState("");
  const[reconSub,setReconSub]=useState("");
  const[reconElement,setReconElement]=useState("");
  const[reconStatus,setReconStatus]=useState("");
  const[reconSearch,setReconSearch]=useState("");
  const[reconReason,setReconReason]=useState("");
  const[reconLines,setReconLines]=useState([]);
  const[reconSummary,setReconSummary]=useState([]);
  const[reconMonths,setReconMonths]=useState([]);
  const[reconLoading,setReconLoading]=useState(false);
  const[reconDetail,setReconDetail]=useState(null);
  const[reconComment,setReconComment]=useState({reason:"",notes:"",status:"open"});
  const[uploadingRecon,setUploadingRecon]=useState(false);
  const[reconUploadMonth,setReconUploadMonth]=useState("");
  const[reconUploadLog,setReconUploadLog]=useState([]);
  const[rrSubTab,setRrSubTab]=useState("leases");
  const[rrTabMonthly,setRrTabMonthly]=useState([]);
  const[rrTabMonths,setRrTabMonths]=useState([]);
  const[rrMonthlyLoading,setRrMonthlyLoading]=useState(false);
  const[rrTabTypes,setRrTabTypes]=useState([]); // multi-select unit types
  const[rrTypeMenuOpen,setRrTypeMenuOpen]=useState(false);
  const[rrSort,setRrSort]=useState({col:"",dir:"asc"});

  const[adminMenuOpen,setAdminMenuOpen]=useState(false);
  const[unitDetail,setUnitDetail]=useState(null);
  const[scheduleTab,setScheduleTab]=useState("yearly");
  const[customers,setCustomers]=useState([]);
  const[customerSearch,setCustomerSearch]=useState("");
  const[customerDetail,setCustomerDetail]=useState(null);
  const[customerForm,setCustomerForm]=useState({brand_name:"",legal_name:"",unit_code:"",unit_type:"",location:"",lease_type:"",property_id:"",sub_location:"",bank_account:"",phone:"",email:"",notes:"",tenant_number:"",document_type:"",document_no:""});
  const[showCustomerForm,setShowCustomerForm]=useState(false);
  const[editCustomer,setEditCustomer]=useState(null);
  const[importingCustomers,setImportingCustomers]=useState(false);
  const[customerFilterProp,setCustomerFilterProp]=useState("");
  const[customerFilterSub,setCustomerFilterSub]=useState("");
  const[customerFilterType,setCustomerFilterType]=useState("");
  const[selectedLease,setSelectedLease]=useState(null);
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
    // All users can view collection logs
    const cl=await apiFetch("/collection-logs");
    if(cl)setCollLogs(cl);
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
  const collTotalRate = (collTotals.invoices+collTotals.revShare)>0
    ? Math.round(collTotals.collection/(collTotals.invoices+collTotals.revShare)*100) : 0;

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
  const ytdRate = (ytdTotals.invoices+ytdTotals.revShare)>0
    ? Math.round(ytdTotals.collection/(ytdTotals.invoices+ytdTotals.revShare)*100) : 0;

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
      const pInv  = propLogs.reduce((a,l)=>a+(parseFloat(l.total_invoices)||0),0);
      const pColl = propLogs.reduce((a,l)=>a+(parseFloat(l.total_collection)||0),0);
      const pRS   = propLogs.reduce((a,l)=>a+(parseFloat(l.total_revenue_share)||0),0);
      const pRate = (pInv+pRS)>0?Math.round(pColl/(pInv+pRS)*100):0;
      const pRateColor = pRate>=90?"#2CA01C":pRate>=70?"#B45309":"#C80C0F";
      const pRateBg    = pRate>=90?"#F2FBF0":pRate>=70?"#FFFBEB":"#FEF2F2";

      const dataRows = propLogs.map((log,idx)=>{
        const base = (parseFloat(log.total_invoices)||0)+(parseFloat(log.total_revenue_share)||0);
        const rate = base>0?Math.round(log.total_collection/base*100):0;
        const rateColor = rate>=90?"#2CA01C":rate>=70?"#B45309":"#C80C0F";
        const rateBg = rate>=90?"#F2FBF0":rate>=70?"#FFFBEB":"#FEF2F2";
        return `<tr style="background:#fff">
          ${!filterProp?`<td style="padding:10px 14px;font-weight:${idx===0?700:400};color:${idx===0?"#1C1C1C":"#57647A"};border-bottom:1px solid #EEF0F3">${idx===0?propName:""}</td>`:""}
          <td style="padding:10px 14px;color:#57647A;border-bottom:1px solid #EEF0F3">${fmtMonth(log.month)}</td>
          <td style="padding:10px 14px;color:#57647A;border-bottom:1px solid #EEF0F3">EGP ${fmtShort(log.total_invoices)}</td>
          <td style="padding:10px 14px;color:#57647A;border-bottom:1px solid #EEF0F3">EGP ${fmtShort(log.total_revenue_share)}</td>
          <td style="padding:10px 14px;font-weight:600;color:#2CA01C;border-bottom:1px solid #EEF0F3">EGP ${fmtShort(log.total_collection)}</td>
          <td style="padding:10px 14px;border-bottom:1px solid #EEF0F3"><span style="background:${rateBg};color:${rateColor};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:600">${rate}%</span></td>
          <td style="padding:10px 14px;color:#57647A;font-size:12px;border-bottom:1px solid #EEF0F3">${log.notes||"—"}</td>
        </tr>`;
      }).join("");

      // Subtotal row — only when multiple records and no property filter
      const subtotalRow = (!filterProp && propLogs.length>1) ? `
        <tr style="background:#EEF5FB;border-top:1px dashed #C4CBD6">
          <td style="padding:8px 14px 8px 32px;font-weight:600;color:#0077C5;font-size:12px;border-bottom:1px solid #E3E8EF">${propName} subtotal</td>
          <td style="padding:8px 14px;border-bottom:1px solid #E3E8EF"></td>
          <td style="padding:8px 14px;font-weight:600;color:#1C1C1C;font-size:12px;border-bottom:1px solid #E3E8EF">EGP ${fmtShort(pInv)}</td>
          <td style="padding:8px 14px;font-weight:600;color:#1C1C1C;font-size:12px;border-bottom:1px solid #E3E8EF">EGP ${fmtShort(pRS)}</td>
          <td style="padding:8px 14px;font-weight:600;color:#2CA01C;font-size:12px;border-bottom:1px solid #E3E8EF">EGP ${fmtShort(pColl)}</td>
          <td style="padding:8px 14px;border-bottom:1px solid #E3E8EF"><span style="background:${pRateBg};color:${pRateColor};padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600">${pRate}%</span></td>
          <td style="padding:8px 14px;border-bottom:1px solid #E3E8EF"></td>
        </tr>` : "";

      return dataRows + subtotalRow;
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
              ${Math.round(logs.reduce((a,l)=>a+(parseFloat(l.total_collection)||0),0)/Math.max(logs.reduce((a,l)=>a+(parseFloat(l.total_invoices)||0)+(parseFloat(l.total_revenue_share)||0),0),1)*100)}%
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

  const loadRentRollLeases=async(propertyId)=>{
    const d=await apiFetch(`/rent-roll/${propertyId}/leases`);
    if(d)setRentRollLeases(prev=>({...prev,[propertyId]:d}));
    return d||[];
  };

  const loadRentRolls=async()=>{
    const all=await apiFetch("/rent-roll");
    if(all){
      // Group by property_id — each property can have multiple sub_locations
      const map={};
      all.forEach(r=>{
        if(!map[r.property_id]) map[r.property_id]=[];
        map[r.property_id].push(r);
      });
      setRentRolls(map);
    }
  };

  const loadEditRequests=async()=>{
    const d=await apiFetch("/edit-requests");
    if(d)setEditRequests(d);
    if(isAdmin){
      const cnt=await apiFetch("/edit-requests/pending-count");
      if(cnt)setPendingCount(cnt.count);
    }
  };

  const loadCustomers=async(search="",propId="")=>{
    let url="/customers";
    const params=[];
    if(search) params.push(`search=${encodeURIComponent(search)}`);
    if(propId) params.push(`property_id=${propId}`);
    if(params.length) url+="?"+params.join("&");
    const d=await apiFetch(url);
    if(d) setCustomers(d);
  };

  useEffect(()=>{
    if(reconProp&&reconMonth) loadReconLines(reconProp,reconMonth,reconSub,reconElement,reconStatus);
  },[reconStatus]);

  useEffect(()=>{
    if(tab==="doc-sop") loadSopDocs();
    if(tab==="doc-guide") loadGuide();
  },[tab]);

  const loadSopDocs=async()=>{
    try{
      const d=await apiFetch("/sop/documents");
      if(d) setSopDocs(d);
    }catch(e){console.error("loadSopDocs error:",e);flash("Could not load SOP documents: "+e.message,"error");}
  };

  const loadGuide=async()=>{
    const d=await apiFetch("/guide");
    if(d) setGuideItems(d);
  };

  const loadReconUploadLog=async(propId)=>{
    if(!propId) return;
    const d=await apiFetch(`/invoice-recon/uploads?property_id=${propId}`);
    if(d) setReconUploadLog(d);
  };

  const loadReconLines=async(propId, month, sub, elem, status)=>{
    if(!propId) return;
    setReconLoading(true);
    try{
      let url=`/invoice-recon/lines?property_id=${propId}`;
      if(month) url+=`&report_month=${month}`;
      if(sub) url+=`&sub_location=${encodeURIComponent(sub)}`;
      if(elem) url+=`&element_group=${encodeURIComponent(elem)}`;
      if(status) url+=`&status=${status}`;
      const d=await apiFetch(url);
      if(d) setReconLines(d);
      else setReconLines([]);
    }catch(e){setReconLines([]);}
    finally{setReconLoading(false);}
  };

  const loadReconSummary=async(propId, month, sub)=>{
    if(!propId) return;
    let url=`/invoice-recon/summary?property_id=${propId}`;
    if(month) url+=`&report_month=${month}`;
    if(sub) url+=`&sub_location=${encodeURIComponent(sub)}`;
    const d=await apiFetch(url);
    if(d) setReconSummary(d);
  };

  const loadReconMonths=async(propId)=>{
    if(!propId) return;
    const d=await apiFetch(`/invoice-recon/available-months?property_id=${propId}`);
    if(d&&d.length>0){
      // d is array of "YYYY-MM" strings
      setReconMonths(d.map(m=>({report_month:m,sub_location:""})));
    }
  };

  const loadRrHistory=async(propId)=>{
    if(!propId) return;
    const d=await apiFetch(`/rent-roll/${propId}/history`);
    if(d) setRrHistory(d);
  };

  const loadRentRollMonthly=async(propId, month)=>{
    if(!propId||!month) return;
    setRrMonthlyLoading(true);
    const d=await apiFetch(`/rent-roll/${propId}/monthly?month=${month}`);
    if(d) setRrTabMonthly(d);
    setRrMonthlyLoading(false);
  };

  const loadRentRollTab=async(propId)=>{
    if(!propId){setRrTabLeases([]);setRrTabMonths([]);setRrTabMonth("");setRrTabMonthly([]);return;}
    setRrTabLoading(true);
    const [d, months] = await Promise.all([
      apiFetch(`/rent-roll/${propId}/leases`),
      apiFetch(`/rent-roll/${propId}/months`)
    ]);
    if(d){
      setRentRollLeases(prev=>({...prev,[propId]:d}));
      setRrTabLeases(d);
    }
    if(months&&months.length>0){
      setRrTabMonths(months);
      // Default to current month if available, else latest
      const currentMonth=new Date().toISOString().slice(0,7);
      const defaultMonth=months.includes(currentMonth)?currentMonth:months[months.length-1];
      setRrTabMonth(defaultMonth);
      loadRentRollMonthly(propId, defaultMonth);
    }
    setRrTabLoading(false);
  };

  const loadActivities=async()=>{
    let url=`/activity-logs?days=${actFilterDays}`;
    if(actFilterUser)url+=`&user_id=${actFilterUser}`;
    const d=await apiFetch(url);
    if(d)setActivities(d);
  };

  useEffect(()=>{
    load();loadEditRequests();loadRentRolls();loadCustomers();loadActivities();loadSopDocs();loadGuide();
    const h=new Date().getHours();
    setWelcomeGreeting(h<12?"Good morning":h<17?"Good afternoon":"Good evening");
  },[]);
  useEffect(()=>{if(tab==="activity")loadActivities();},[tab,actFilterUser,actFilterDays]);
  useEffect(()=>{if(showProfile)setProfileForm({full_name:user?.full_name||"",email:user?.email||"",title:user?.title||""});},[showProfile]);

  const visibleProps=isAdmin?properties:properties.filter(p=>!myAccess||myAccess.includes(p.id));
  const propReports=reports.filter(r=>r.property_id===selectedProp?.id);
  const reportTypes=["Collection","Aging","Budget vs Actual","Invoice Reconciliation","Income Statement","Other"];

  const adminDropdownTabs=["email","manage-reports","users","customers","requests","activity","settings"];
  const tabs=isAdmin
    ?["properties","collection","rent-roll","reports"]
    :isEditor
    ?["properties","collection","rent-roll","reports","email"]
    :["properties","collection","rent-roll","reports"];

  const tabLabels={
    properties:"Properties",
    reports:"Reports",
    collection:"Collection",
    "rent-roll":"Rent Roll",
    email:"Email",
    "manage-reports":"Manage Reports",
    users:"Users",
    requests:"Requests",
    customers:"Customers DB",
    activity:"Activity",
    settings:"⚙ Settings"
  };

  // ── Styles ──────────────────────────────────────────────────────────────────
  const SIDEBAR_W=220;const SIDEBAR_C=60;
  const s={
    sidebar:{position:"fixed",top:0,left:0,height:"100vh",width:220,background:"#1A2332",display:"flex",flexDirection:"column",zIndex:100,overflow:"hidden",boxShadow:"2px 0 8px rgba(0,0,0,0.15)"},
    topbar:{position:"fixed",top:0,left:220,right:0,height:56,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",background:QB.bgCard,borderBottom:`1px solid ${QB.borderCard}`,boxShadow:"0 1px 3px rgba(0,0,0,0.06)",zIndex:50,transition:"left 0.2s ease"},
    wrap:{marginLeft:220,marginTop:56,padding:"24px 28px 40px",fontFamily:QB.fontFamily,minHeight:"calc(100vh - 56px)",transition:"margin-left 0.2s ease"},
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

  // Close admin menu on outside click
  useEffect(()=>{
    if(!adminMenuOpen&&!rrTypeMenuOpen) return;
    const handler=()=>{setAdminMenuOpen(false);setRrTypeMenuOpen(false);};
    document.addEventListener("click",handler);
    return()=>document.removeEventListener("click",handler);
  },[adminMenuOpen,rrTypeMenuOpen]);

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
    const propYtdRate=(propYtd.invoices+propYtd.revShare)>0?Math.round(propYtd.collection/(propYtd.invoices+propYtd.revShare)*100):0;

    return(
      <div style={{marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>Last {data.length} {data.length===1?"month":"months"}</div>
        <div style={{display:"flex",flexDirection:"column",gap:5}}>
          {data.map((d,i)=>{
            const dBase=(parseFloat(d.total_invoices)||0)+(parseFloat(d.total_revenue_share)||0);
            const rate=dBase>0?Math.round(parseFloat(d.total_collection)/dBase*100):0;
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

  const navSection = tab==="welcome"||tab==="collection"||tab==="rent-roll"||tab==="reports"||tab==="annex"?"home":
                     tab==="kpis"?"kpis":
                     tab==="doc-sop"||tab==="doc-guide"?"docs":
                     ["email","manage-reports","users","customers","requests","activity","settings"].includes(tab)?"admin":
                     tab==="profile"?"you":"home";

  return(
    <div style={{minHeight:"100vh",background:QB.bgPage,fontFamily:QB.fontFamily}}>
      <Flash/>

      {/* SIDEBAR */}
      <div style={{...s.sidebar,width:220}}>

        {/* Logo */}
        <div style={{padding:"0 14px",display:"flex",alignItems:"center",gap:10,borderBottom:"1px solid rgba(255,255,255,0.1)",height:64,flexShrink:0}}>
          <div style={{width:36,height:36,borderRadius:6,overflow:"hidden",flexShrink:0,background:QB.yellow}}>
            <img src={settings.logo_url||"https://savills-ca-portal.vercel.app/savills-logo.svg"} alt="Savills"
              style={{width:36,height:36,display:"block",objectFit:"contain"}}/>
          </div>
          <div style={{minWidth:0}}>
            <div style={{fontSize:12,fontWeight:700,color:"#fff",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Savills Egypt CA</div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.45)",whiteSpace:"nowrap"}}>Property Management</div>
          </div>
        </div>

        {/* Nav */}
        <div style={{flex:1,overflowY:"auto",overflowX:"hidden",paddingTop:4}}>

          {/* Home */}
          {[{section:"home",icon:"🏠",label:"Home",items:[
              {t:"welcome",icon:"🏠",label:"Welcome"},
              {t:"collection",icon:"💰",label:"Collection"},
              {t:"rent-roll",icon:"📋",label:"Rent Roll"},
              {t:"reports",icon:"📊",label:"Reports"},
              {t:"annex",icon:"📝",label:"Financial Annex"},
            ]},
          ].map(({section,icon,label,items})=>{
            const active=["collection","rent-roll","reports"].includes(tab);
            const hov=navHover===section;
            return(
              <div key={section}>
                <div style={{display:"flex",alignItems:"center",gap:14,padding:"11px 18px",cursor:"pointer",
                  color:active?"#fff":hov?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.55)",
                  background:active?"rgba(0,119,197,0.2)":hov?"rgba(255,255,255,0.06)":"transparent",
                  borderLeft:active?`3px solid ${QB.blue}`:"3px solid transparent",transition:"all 0.15s",minHeight:44}}
                  onMouseEnter={()=>setNavHover(section)}
                  onMouseLeave={()=>setNavHover("")}
                  onClick={()=>{setHomeExpanded(v=>!v);if(!active)setTab("collection");}}>
                  <span style={{fontSize:18,width:24,textAlign:"center",flexShrink:0}}>{icon}</span>
                  <><span style={{fontSize:13,fontWeight:active?600:400,whiteSpace:"nowrap",flex:1}}>{label}</span>
                  <span style={{fontSize:10,opacity:0.5}}>{homeExpanded?"▲":"▼"}</span></>
                </div>
                {homeExpanded&&items.map(({t,icon:ic,label:lb})=>(
                  <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 18px 8px 54px",cursor:"pointer",
                    color:tab===t?"#fff":"rgba(255,255,255,0.5)",
                    background:tab===t?`rgba(0,119,197,0.25)`:"transparent",
                    borderLeft:tab===t?`3px solid ${QB.yellow}`:"3px solid transparent",
                    fontSize:12,fontWeight:tab===t?600:400,whiteSpace:"nowrap",transition:"all 0.12s"}}
                    onClick={()=>{setTab(t);setSelectedProp(null);setSelectedReport(null);}}
                    onMouseEnter={e=>{if(tab!==t)e.currentTarget.style.background="rgba(255,255,255,0.06)";}}
                    onMouseLeave={e=>{if(tab!==t)e.currentTarget.style.background="transparent";}}>
                    <span style={{fontSize:13}}>{ic}</span><span>{lb}</span>
                  </div>
                ))}
              </div>
            );
          })}

          {/* KPIs */}
          {[{t:"kpis",icon:"📈",label:"KPIs"}].map(({t,icon,label})=>(
            <div key={t} style={{display:"flex",alignItems:"center",gap:14,padding:"11px 18px",cursor:"pointer",
              color:tab===t?"#fff":navHover===t?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.55)",
              background:tab===t?"rgba(0,119,197,0.2)":navHover===t?"rgba(255,255,255,0.06)":"transparent",
              borderLeft:tab===t?`3px solid ${QB.blue}`:"3px solid transparent",transition:"all 0.15s",minHeight:44}}
              onMouseEnter={()=>setNavHover(t)}
              onMouseLeave={()=>setNavHover("")}
              onClick={()=>setTab(t)}>
              <span style={{fontSize:18,width:24,textAlign:"center",flexShrink:0}}>{icon}</span>
              <span style={{fontSize:13,fontWeight:tab===t?600:400,whiteSpace:"nowrap",color:"inherit"}}>{label}</span>
            </div>
          ))}

          {/* Documentation */}
          {(()=>{
            const docTabs=["doc-sop","doc-guide"];
            const docActive=docTabs.includes(tab);
            return(
              <div>
                <div style={{display:"flex",alignItems:"center",gap:14,padding:"11px 18px",cursor:"pointer",
                  color:docActive?"#fff":navHover==="docs"?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.55)",
                  background:docActive?"rgba(0,119,197,0.2)":navHover==="docs"?"rgba(255,255,255,0.06)":"transparent",
                  borderLeft:docActive?`3px solid ${QB.blue}`:"3px solid transparent",transition:"all 0.15s",minHeight:44}}
                  onMouseEnter={()=>setNavHover("docs")}
                  onMouseLeave={()=>setNavHover("")}
                  onClick={()=>{setDocsExpanded(v=>!v);if(!docActive)setTab("doc-sop");}}>
                  <span style={{fontSize:18,width:24,textAlign:"center",flexShrink:0}}>📚</span>
                  <span style={{fontSize:13,fontWeight:docActive?600:400,whiteSpace:"nowrap",flex:1}}>Documentation</span>
                  <span style={{fontSize:10,opacity:0.5}}>{docsExpanded?"▲":"▼"}</span>
                </div>
                {docsExpanded&&[
                  {t:"doc-sop",icon:"📄",label:"CA SOPs"},
                  {t:"doc-guide",icon:"📖",label:"How to use Portal"},
                ].map(({t,icon,label})=>(
                  <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 18px 8px 54px",cursor:"pointer",
                    color:tab===t?"#fff":"rgba(255,255,255,0.5)",
                    background:tab===t?"rgba(0,119,197,0.25)":"transparent",
                    borderLeft:tab===t?`3px solid ${QB.yellow}`:"3px solid transparent",
                    fontSize:12,fontWeight:tab===t?600:400,whiteSpace:"nowrap",transition:"all 0.12s"}}
                    onClick={()=>setTab(t)}
                    onMouseEnter={e=>{if(tab!==t)e.currentTarget.style.background="rgba(255,255,255,0.06)";}}
                    onMouseLeave={e=>{if(tab!==t)e.currentTarget.style.background="transparent";}}>
                    <span style={{fontSize:13}}>{icon}</span><span>{label}</span>
                  </div>
                ))}
              </div>
            );
          })()}

          {/* Admin */}
          {isAdmin&&(()=>{
            const adminTabs=["email","manage-reports","users","customers","requests","activity","settings"];
            const adminActive=adminTabs.includes(tab);
            return(
              <div>
                <div style={{display:"flex",alignItems:"center",gap:14,padding:"11px 18px",cursor:"pointer",
                  color:adminActive?"#fff":navHover==="admin"?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.55)",
                  background:adminActive?"rgba(0,119,197,0.2)":navHover==="admin"?"rgba(255,255,255,0.06)":"transparent",
                  borderLeft:adminActive?`3px solid ${QB.blue}`:"3px solid transparent",transition:"all 0.15s",minHeight:44}}
                  onMouseEnter={()=>setNavHover("admin")}
                  onMouseLeave={()=>setNavHover("")}
                  onClick={()=>{setAdminExpanded(v=>!v);if(!adminActive)setTab("users");}}>
                  <span style={{fontSize:18,width:24,textAlign:"center",flexShrink:0}}>⚙️</span>
                  <><span style={{fontSize:13,fontWeight:adminActive?600:400,whiteSpace:"nowrap",flex:1}}>Admin</span>
                  <span style={{fontSize:10,opacity:0.5}}>{adminExpanded?"▲":"▼"}</span></>
                </div>
                {adminExpanded&&[
                  {t:"users",icon:"👥",label:"Users"},
                  {t:"customers",icon:"🗃️",label:"Customers DB"},
                  {t:"manage-reports",icon:"📑",label:"Reports"},
                  {t:"email",icon:"✉️",label:"Email"},
                  {t:"requests",icon:"🔔",label:"Requests",badge:pendingCount},
                  {t:"activity",icon:"📝",label:"Activity"},
                  {t:"settings",icon:"🛠️",label:"Settings"},
                ].map(({t,icon,label,badge})=>(
                  <div key={t} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 18px 8px 54px",cursor:"pointer",
                    color:tab===t?"#fff":"rgba(255,255,255,0.5)",
                    background:tab===t?"rgba(0,119,197,0.25)":"transparent",
                    borderLeft:tab===t?`3px solid ${QB.yellow}`:"3px solid transparent",
                    fontSize:12,fontWeight:tab===t?600:400,whiteSpace:"nowrap",transition:"all 0.12s"}}
                    onClick={()=>{setTab(t);setSelectedProp(null);}}
                    onMouseEnter={e=>{if(tab!==t)e.currentTarget.style.background="rgba(255,255,255,0.06)";}}
                    onMouseLeave={e=>{if(tab!==t)e.currentTarget.style.background="transparent";}}>
                    <span style={{fontSize:13}}>{icon}</span>
                    <span style={{flex:1}}>{label}</span>
                    {badge>0&&<span style={{background:QB.red,color:"#fff",borderRadius:10,fontSize:9,fontWeight:700,padding:"1px 5px"}}>{badge}</span>}
                  </div>
                ))}
              </div>
            );
          })()}
        </div>

        {/* You / Sign out */}
        <div style={{borderTop:"1px solid rgba(255,255,255,0.1)",paddingTop:4}}>
          <div style={{display:"flex",alignItems:"center",gap:14,padding:"11px 18px",cursor:"pointer",
            color:navHover==="you"?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.55)",
            background:navHover==="you"?"rgba(255,255,255,0.06)":"transparent",
            transition:"all 0.15s",minHeight:44}}
            onMouseEnter={()=>setNavHover("you")}
            onMouseLeave={()=>setNavHover("")}
            onClick={()=>setShowProfile(true)}>
            <Avatar name={user?.full_name||"U"} size={22}/>
            <span style={{fontSize:13,whiteSpace:"nowrap",color:"rgba(255,255,255,0.7)"}}>{user?.full_name?.split(" ")[0]||"You"}</span>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:14,padding:"11px 18px",cursor:"pointer",
            color:navHover==="out"?"rgba(255,255,255,0.85)":"rgba(255,255,255,0.4)",
            background:navHover==="out"?"rgba(255,255,255,0.06)":"transparent",
            transition:"all 0.15s",minHeight:44}}
            onMouseEnter={()=>setNavHover("out")}
            onMouseLeave={()=>setNavHover("")}
            onClick={logout}>
            <span style={{fontSize:18,width:24,textAlign:"center",flexShrink:0}}>🚪</span>
            <span style={{fontSize:13,whiteSpace:"nowrap"}}>Sign out</span>
          </div>
        </div>
      </div>

      {/* TOP BAR */}
      <div style={{...s.topbar,left:220}}>
        <div style={{fontSize:14,fontWeight:600,color:QB.textPrimary}}>
          {tab==="welcome"&&"Home"}
          {tab==="collection"&&"Collection"}
          {tab==="rent-roll"&&"Rent Roll"}
          {tab==="reports"&&"Reports"}
          {tab==="annex"&&"Financial Annex"}
          {tab==="kpis"&&"KPIs"}
          {tab==="doc-sop"&&"Documentation — CA SOPs"}
          {tab==="doc-guide"&&"Documentation — How to use Portal"}
          {tab==="users"&&"Admin — Users"}
          {tab==="customers"&&"Admin — Customers"}
          {tab==="manage-reports"&&"Admin — Reports"}
          {tab==="email"&&"Admin — Email"}
          {tab==="requests"&&"Admin — Requests"}
          {tab==="activity"&&"Admin — Activity"}
          {tab==="settings"&&"Admin — Settings"}
        </div>
        <div style={{display:"flex",gap:10,alignItems:"center"}}>
          {(tab==="collection"||tab==="kpis")&&<>
            <select style={{...s.input,width:160,fontSize:12,padding:"6px 10px"}} value={selectedNavProp} onChange={e=>{
              const v=e.target.value; setSelectedNavProp(v);
              if(v){
                const pid=parseInt(v);
                if(tab==="collection"){setCollFilterProp(pid);}
              }
            }}>
              <option value="">All properties</option>
              {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {isAdmin&&<button style={{...s.btnP,padding:"6px 14px",fontSize:12}} onClick={()=>setShowAddPropForm(true)}>+ Property</button>}
          </>}
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div style={{...s.wrap,marginLeft:220}}>

        {/* KPIs TAB — reuses property card structure */}
        {tab==="kpis"&&(()=>{
          const filtProps=selectedNavProp?properties.filter(p=>String(p.id)===String(selectedNavProp)):properties;
          return(
            <div>
              <div style={{display:"grid",gridTemplateColumns:filtProps.length===1?"1fr":"repeat(auto-fill,minmax(340px,1fr))",gap:16}}>
                {filtProps.map(p=>(
                  <div key={p.id} style={{...s.card,marginBottom:0}}>
                    {/* Header */}
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <PropLogo url={p.logo_url} name={p.name} size={36}/>
                        <div>
                          <div style={{fontSize:15,fontWeight:700,color:QB.textPrimary}}>{p.name}</div>
                          <div style={{fontSize:12,color:QB.textMuted}}>{p.location}</div>
                          {p.landlord_name&&<div style={{fontSize:11,color:QB.textMuted,marginTop:1}}>👤 {p.landlord_name}</div>}
                        </div>
                      </div>
                      <Badge label={p.system||"—"} color={p.system==="Oracle"?"purple":"green"}/>
                    </div>
                    {/* Reports badges */}
                    <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:8}}>
                      {reports.filter(r=>r.property_id===p.id).map(r=><Badge key={r.id} label={r.report_name} color="gray"/>)}
                      {reports.filter(r=>r.property_id===p.id).length===0&&<span style={{fontSize:11,color:QB.textMuted}}>No reports yet</span>}
                    </div>
                    {/* Collection Summary */}
                    <PropertySummary propId={p.id}/>
                    {/* Rent Roll */}
                    {rentRolls[p.id]&&rentRolls[p.id].length>0&&(
                      <div style={{marginBottom:8}}>
                        <div style={{fontSize:11,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>📋 Rent Roll</div>
                        {rentRolls[p.id].map((rr,ri)=>{
                          const now=new Date();
                          const cached=rentRollLeases[p.id];
                          const subL=cached?(rr.sub_location?cached.filter(l=>(l.sub_location||"")===(rr.sub_location||"")):cached):null;
                          const calcExp=(mn,mx)=>subL?subL.filter(l=>{if(!l.lease_end)return false;const d=(new Date(l.lease_end)-now)/(1000*60*60*24*365.25);return d>mn&&d<=mx;}).length:null;
                          const exp1=calcExp(0,1)??rr.expiry_0_1yr;
                          const exp2=calcExp(1,2)??rr.expiry_1_2yr;
                          const exp3=calcExp(2,3)??rr.expiry_2_3yr;
                          return(
                            <div key={ri} style={{background:QB.bgSidebar,border:`1px solid ${QB.borderLight}`,borderRadius:QB.radiusMD,padding:"10px 12px",marginBottom:6}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                                <span style={{fontSize:12,fontWeight:600,color:QB.textPrimary}}>{rr.sub_location||p.name}</span>
                                <span style={{fontSize:10,color:QB.textMuted}}>{rr.report_date}</span>
                              </div>
                              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,marginBottom:8}}>
                                <div><div style={{fontSize:9,color:QB.textMuted}}>Leases</div><div style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}>{rr.active_leases}</div></div>
                                <div><div style={{fontSize:9,color:QB.textMuted}}>GLA</div><div style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}>{fmtShort(rr.total_gla)} m²</div></div>
                                <div><div style={{fontSize:9,color:QB.textMuted}}>Ann. Rent</div><div style={{fontSize:13,fontWeight:600,color:QB.green}}>EGP {fmtShort(rr.annualized_rent)}</div></div>
                                <div><div style={{fontSize:9,color:QB.textMuted}}>Monthly</div><div style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}>EGP {fmtShort(rr.monthly_rent+rr.monthly_sc)}</div></div>
                              </div>
                              <div style={{display:"flex",gap:6}}>
                                {[{v:exp1,l:"<1yr",c:"#C80C0F",bg:"#FEF2F2"},{v:exp2,l:"1-2yr",c:"#B45309",bg:"#FFFBEB"},{v:exp3,l:"2-3yr",c:QB.blue,bg:QB.blueLight}].map(({v,l,c,bg})=>(
                                  <span key={l} style={{fontSize:10,padding:"2px 7px",borderRadius:10,background:bg,color:c,fontWeight:600}}>{v} {l}</span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {!rentRolls[p.id]?.length&&!propertySummaries[p.id]?.length&&<div style={{fontSize:12,color:QB.textMuted,textAlign:"center",padding:"8px"}}>No data yet</div>}
                    {/* Quick actions */}
                    <div style={{display:"flex",gap:6,marginTop:8,paddingTop:8,borderTop:`1px solid ${QB.borderLight}`}}>
                      <button style={{...s.btnS,padding:"4px 12px",fontSize:11}} onClick={()=>{setTab("collection");}}>📊 Collection</button>
                      <button style={{...s.btnS,padding:"4px 12px",fontSize:11}} onClick={()=>{setTab("rent-roll");setRrTabProp(String(p.id));loadRentRollTab(p.id);}}>📋 Rent Roll</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            WELCOME TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="welcome"&&(()=>{
          // Calculate KPIs based on role
          const myProps = isAdmin ? properties : properties.filter(p=>
            !myAccess || myAccess.includes(p.id)
          );
          const totalLeases = myProps.reduce((a,p)=>{
            const rrs=rentRolls[p.id]||[];
            return a+rrs.reduce((b,r)=>b+r.active_leases,0);
          },0);
          const now=new Date();
          const exp1yr = myProps.reduce((a,p)=>{
            const cached=rentRollLeases[p.id];
            if(!cached) return a+(rentRolls[p.id]||[]).reduce((b,r)=>b+r.expiry_0_1yr,0);
            return a+cached.filter(l=>{
              if(!l.lease_end) return false;
              return (new Date(l.lease_end)-now)/(1000*60*60*24*365.25)<=1;
            }).length;
          },0);
          const pendingReqs = isAdmin?pendingCount:0;
          const dateStr = now.toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long",year:"numeric"});

          return(
            <div style={{maxWidth:900}}>
              {/* Greeting */}
              <div style={{marginBottom:28}}>
                <div style={{fontSize:11,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".08em",marginBottom:6}}>{welcomeGreeting}</div>
                <div style={{fontSize:26,fontWeight:600,color:QB.textPrimary,marginBottom:4}}>{user?.full_name}</div>
                <div style={{fontSize:13,color:QB.textMuted}}>{user?.title||user?.role} · {dateStr}</div>
              </div>

              {/* KPI cards */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
                {[
                  {label:"Properties",value:myProps.length,icon:"🏢",color:QB.textPrimary},
                  {label:"Active Leases",value:totalLeases||"—",icon:"📋",color:QB.textPrimary},
                  {label:"Expiring <1yr",value:exp1yr||"—",icon:"⚠️",color:exp1yr>0?"#C80C0F":QB.textPrimary},
                  ...(isAdmin||isEditor?[{label:"Pending Requests",value:isAdmin?pendingCount:collLogs.filter(l=>l.property_id&&myProps.find(p=>p.id===l.property_id)).length,icon:"🔔",color:pendingCount>0?"#B45309":QB.textPrimary}]:[]),
                ].map(({label,value,icon,color})=>(
                  <div key={label} style={{background:QB.bgSidebar,borderRadius:QB.radiusMD,padding:"16px",border:`1px solid ${QB.borderLight}`}}>
                    <div style={{fontSize:10,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:8}}>{icon} {label}</div>
                    <div style={{fontSize:24,fontWeight:600,color}}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div style={{...s.card,marginBottom:16}}>
                <div style={{fontSize:11,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:12}}>Quick actions</div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {(isAdmin||isEditor)&&[
                    {icon:"📥",label:"Upload Rent Roll",action:()=>setTab("rent-roll")},
                    {icon:"📑",label:"Invoice Recon",action:()=>{setTab("rent-roll");setRrSubTab("recon");}},
                    {icon:"💰",label:"Log Collection",action:()=>setTab("collection")},
                    {icon:"📊",label:"View Reports",action:()=>setTab("reports")},
                    {icon:"📈",label:"KPI Dashboard",action:()=>setTab("kpis")},
                  ].map(({icon,label,action})=>(
                    <button key={label} style={{...s.btnS,padding:"8px 14px",fontSize:12,display:"flex",alignItems:"center",gap:6}} onClick={action}>
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                  {!isAdmin&&!isEditor&&[
                    {icon:"📊",label:"View Reports",action:()=>setTab("reports")},
                    {icon:"📈",label:"KPI Dashboard",action:()=>setTab("kpis")},
                  ].map(({icon,label,action})=>(
                    <button key={label} style={{...s.btnS,padding:"8px 14px",fontSize:12,display:"flex",alignItems:"center",gap:6}} onClick={action}>
                      <span>{icon}</span>{label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recent activity */}
              <div style={s.card}>
                <div style={{fontSize:11,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:12}}>Recent activity</div>
                {activities.length===0?<div style={{fontSize:13,color:QB.textMuted,textAlign:"center",padding:"16px"}}>No recent activity</div>:
                activities.slice(0,6).map((a,i)=>{
                  const icon=a.action.includes("login")?"🔑":a.action.includes("upload")?"📥":a.action.includes("collection")?"💰":a.action.includes("report")?"📊":a.action.includes("customer")?"👤":a.action.includes("email")?"✉️":"📝";
                  const timeAgo=()=>{
                    const diff=(now-new Date(a.created_at))/1000;
                    if(diff<3600) return `${Math.round(diff/60)}m ago`;
                    if(diff<86400) return `${Math.round(diff/3600)}h ago`;
                    return `${Math.round(diff/86400)}d ago`;
                  };
                  return(
                    <div key={a.id||i} style={{display:"flex",alignItems:"center",gap:10,padding:"8px 0",borderBottom:i<Math.min(activities.length,6)-1?`1px solid ${QB.borderLight}`:"none",fontSize:12}}>
                      <span style={{fontSize:14}}>{icon}</span>
                      <div style={{flex:1}}>
                        <span style={{color:QB.textPrimary}}>{a.action}</span>
                        {a.entity_name&&<span style={{color:QB.textMuted}}> · {a.entity_name}</span>}
                      </div>
                      <span style={{color:QB.textMuted,whiteSpace:"nowrap",fontSize:11}}>{timeAgo()}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

{/* ══════════════════════════════════════════════════════════════════
            FINANCIAL ANNEX TAB
        ══════════════════════════════════════════════════════════════════ */}
           {tab === "annex" && (
          <div style={{ maxWidth: 900 }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: QB.textPrimary, marginBottom: 4 }}>Financial Annex Generator</div>
              <div style={{ fontSize: 13, color: QB.textMuted }}>The AI Will extract the info from any input</div>
            </div>

            {/* Step 1: Input */}
            <div style={{ ...s.card, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: QB.textPrimary, marginBottom: 10 }}>
                <span style={{ background: QB.blue, color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, marginRight: 8 }}>1</span>
                Enter Contract details
              </div>
              <textarea style={{ ...s.input, width: "100%", minHeight: 160, resize: "vertical", fontSize: 13, lineHeight: 1.7, fontFamily: QB.fontFamily }}
                placeholder={"Example:\nTenant: Cilantro\nUnit: F-01\nProject: Giza Zoo Commercial Destination\nLease Start: Nov 2025\nContract Period: 5 Years\nMonthly Rent Year 1: 150,000 EGP\nAnnual Escalation: 10%\nMonthly Service Charge: 30,000 EGP\nRevenue Share Years: 0\nMarketing Rate: 2%"}
                value={annexText} onChange={e => setAnnexText(e.target.value)} />
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button style={{ ...s.btnP, padding: "8px 20px" }} disabled={!annexText.trim() || annexLoading}
                  onClick={async () => {
                    setAnnexLoading(true); setAnnexError(""); setAnnexExtracted(null);
                    try {
                      const d = await apiFetch("/annex/extract", { method: "POST", body: JSON.stringify({ text: annexText }) });
                      if (d?.data) setAnnexExtracted(d.data);
                      else setAnnexError("Failed to extract data");
                    } catch (e) { setAnnexError(e.message || "An error occurred"); }
                    finally { setAnnexLoading(false); }
                  }}>
                  {annexLoading ? "⏳ Analyzing..." : "🤖 Extract Data with AI"}
                </button>
                {annexExtracted && <button style={{ ...s.btnS, padding: "8px 16px" }} onClick={() => setAnnexExtracted(null)}>Clear</button>}
              </div>
              {annexError && <div style={{ marginTop: 8, padding: "8px 12px", background: "#FEF2F2", color: "#C80C0F", borderRadius: QB.radiusMD, fontSize: 12 }}>{annexError}</div>}
            </div>

            {/* Step 2: Review & Edit */}
            {annexExtracted && (() => {
              const d = annexExtracted;
              const fields = [
                { key: "tenant_name", label: "Tenant Name", type: "text" },
                { key: "unit", label: "Unit No.", type: "text" },
                { key: "project", label: "Project", type: "text" },
                { key: "lease_start", label: "Lease Start Date", type: "date" },
                { key: "num_years", label: "Lease Term (Years)", type: "number" },
                { key: "base_monthly", label: "Monthly Rent - Year 1 (EGP)", type: "number" },
                { key: "escalation", label: "Annual Escalation Rate", type: "percent" },
                { key: "sc_monthly_y1", label: "Monthly Service Charge - Year 1 (EGP)", type: "number" },
                { key: "revenue_share_years", label: "Revenue Share Years", type: "number" },
                { key: "vat_rent", label: "VAT on Rent", type: "percent" },
                { key: "vat_sc", label: "VAT on Service Charge", type: "percent" },
                { key: "marketing_rate", label: "Marketing Rate (% of annual rent — leave 0 if none)", type: "percent" },
              ];
              return (
                <div style={{ ...s.card, marginBottom: 16 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: QB.textPrimary, marginBottom: 14 }}>
                    <span style={{ background: QB.blue, color: "#fff", borderRadius: "50%", width: 22, height: 22, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, marginRight: 8 }}>2</span>
                    Review & Edit Extracted Data
                  </div>
                  {d.notes && <div style={{ marginBottom: 12, padding: "8px 12px", background: QB.blueLight, borderRadius: QB.radiusMD, fontSize: 12, color: QB.blue }}>
                    💡 AI Note: {d.notes}
                  </div>}
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    {fields.map(({ key, label, type }) => {
                      const val = d[key];
                      const display = type === "percent" && val != null
                        ? String(parseFloat((val * 100).toFixed(2)))
                        : val ?? "";
                      return (
                        <div key={key}>
                          <label style={s.label}>{label}</label>
                          {type === "percent"
                            ? <input
                                key={key + "_" + String(val)}
                                type="text"
                                style={{ ...s.input, borderColor: val == null ? QB.red : QB.borderInput, background: val == null ? "#FEF2F2" : "#fff" }}
                                defaultValue={display}
                                placeholder="e.g. 10"
                                onBlur={e => {
                                  const v = parseFloat(e.target.value);
                                  if (!isNaN(v)) setAnnexExtracted(prev => ({ ...prev, [key]: v / 100 }));
                                }} />
                            : <input
                                type={type === "date" ? "date" : "text"}
                                style={{ ...s.input, borderColor: val == null ? QB.red : QB.borderInput, background: val == null ? "#FEF2F2" : "#fff" }}
                                value={display}
                                onChange={e => {
                                  let v = e.target.value;
                                  if (type === "number") v = parseFloat(v) || 0;
                                  else if (type === "percent") v = e.target.value;
                                  setAnnexExtracted(prev => ({ ...prev, [key]: v }));
                                }}
                                onBlur={e => {
                                  if (type === "percent") {
                                    const parsed = parseFloat(e.target.value);
                                    if (!isNaN(parsed)) setAnnexExtracted(prev => ({ ...prev, [key]: parsed / 100 }));
                                  }
                                }} />
                          }
                          {val == null && <div style={{ fontSize: 10, color: QB.red }}>⚠ Not mentioned — please fill in</div>}
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ marginTop: 14, paddingTop: 12, borderTop: `1px solid ${QB.borderLight}`, display: "flex", gap: 8 }}>
                    <button style={{ ...s.btnP, padding: "9px 24px", fontSize: 13 }}
                      disabled={annexGenerating || !d.tenant_name || !d.lease_start || !d.num_years || !d.base_monthly}
                      onClick={async () => {
                        setAnnexGenerating(true); setAnnexError("");
                        try {
                          const payload = { ...d };
                          const res = await apiFetch("/annex/generate", { method: "POST", body: JSON.stringify(payload) });
                          if (res?.ok) {
                            const bytes = Uint8Array.from(atob(res.file_b64), c => c.charCodeAt(0));
                            const blob = new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a"); a.href = url; a.download = res.filename;
                            document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                            flash("✅ Financial Annex generated successfully");
                          } else setAnnexError(res?.detail || "Failed to generate file");
                        } catch (e) { setAnnexError(e.message || "An error occurred"); }
                        finally { setAnnexGenerating(false); }
                      }}>
                      {annexGenerating ? "⏳ Generating..." : "📥 Generate Excel"}
                    </button>
                  </div>
                  {annexError && <div style={{ marginTop: 8, padding: "8px 12px", background: "#FEF2F2", color: "#C80C0F", borderRadius: QB.radiusMD, fontSize: 12 }}>{annexError}</div>}
                </div>
              );
            })()}

            {/* Instructions */}
            {!annexExtracted && (
              <div style={{ ...s.card, background: QB.bgSidebar }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: QB.textSecondary, marginBottom: 10 }}>💡 How to use</div>
                <div style={{ fontSize: 12, color: QB.textMuted, lineHeight: 1.8 }}>
                  <div>• Enter deal details in any language or format — Arabic, English, or mixed</div>
                  <div>• Include: tenant name, unit no., project, start date, term, rent, escalation, service charges</div>
                  <div>• Mention Revenue Share years if applicable</div>
                  <div>• Default VAT: 1% on rent (Law 157/2025) and 14% on service charges</div>
                  <div>• After extraction, review and correct any figures before generating</div>
                </div>
              </div>
            )}
          </div>
        )}

        {(tab==="doc-sop"||tab==="doc-guide")&&<div>
          {/* SOP sub-tab */}
          {tab==="doc-sop"&&<div>
            {/* Upload - admin only */}
            {isAdmin&&<div style={{...s.card,marginBottom:16}}>
              <div style={{...s.cardTitle,marginBottom:12}}>Upload SOP Document</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
                <div>
                  <label style={s.label}>Version</label>
                  <input style={{...s.input,width:100}} placeholder="e.g. 1.2" value={sopVersion} onChange={e=>setSopVersion(e.target.value)}/>
                </div>
                <div style={{flex:1,minWidth:200}}>
                  <label style={s.label}>Description</label>
                  <input style={s.input} placeholder="e.g. Collection SOP - Updated debt escalation" value={sopDesc} onChange={e=>setSopDesc(e.target.value)}/>
                </div>
                <label style={{...s.btnP,padding:"8px 16px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                  {uploadingSOP?"⏳ Uploading...":"📥 Upload PDF"}
                  <input type="file" accept=".pdf" style={{display:"none"}} disabled={uploadingSOP} onChange={async e=>{
                    const file=e.target.files[0]; if(!file) return;
                    setUploadingSOP(true);
                    const fd=new FormData(); fd.append("file",file);
                    fd.append("version",sopVersion); fd.append("description",sopDesc);
                    try{
                      const token=localStorage.getItem("ca_token");
                      const API=import.meta.env.VITE_API_URL||"http://localhost:8001";
                      const res=await fetch(`${API}/sop/upload`,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:fd});
                      const r=await res.json();
                      if(r.ok){flash("SOP uploaded successfully");setSopVersion("");setSopDesc("");loadSopDocs();}
                      else flash(r.detail||"Upload failed","error");
                    }catch(ex){flash("Upload failed","error");}
                    finally{setUploadingSOP(false);e.target.value="";}
                  }}/>
                </label>
              </div>
            </div>}

            {/* SOP log */}
            <div style={s.card}>
              <div style={{...s.cardTitle,marginBottom:12}}>SOP Documents</div>
              {sopDocs.length===0
                ?<div style={{textAlign:"center",padding:"30px",color:QB.textMuted,fontSize:13}}>No documents uploaded yet</div>
                :<div style={{overflowX:"auto"}}>
                  <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
                    <thead>
                      <tr style={{background:QB.bgSidebar}}>
                        {["Document","Version","Description","Uploaded by","Date","Size",""].map(h=>(
                          <th key={h} style={{...s.th,textAlign:"left"}}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {sopDocs.map((doc,i)=>(
                        <tr key={doc.id} style={{background:i%2===0?QB.bgCard:QB.bgSidebar,borderBottom:`1px solid ${QB.borderLight}`}}>
                          <td style={{...s.td,fontWeight:600,color:QB.textPrimary}}>
                            <span style={{marginRight:6}}>📄</span>{doc.filename}
                          </td>
                          <td style={s.td}>
                            {doc.version&&<span style={{padding:"2px 8px",background:QB.blueLight,color:QB.blue,borderRadius:10,fontSize:11,fontWeight:600}}>v{doc.version}</span>}
                          </td>
                          <td style={{...s.td,color:QB.textSecondary,maxWidth:260,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{doc.description||"—"}</td>
                          <td style={{...s.td,color:QB.textSecondary}}>{doc.uploaded_by_name}</td>
                          <td style={{...s.td,color:QB.textMuted,whiteSpace:"nowrap"}}>{new Date(doc.upload_date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</td>
                          <td style={{...s.td,color:QB.textMuted}}>{doc.file_size?(doc.file_size/1024).toFixed(0)+"KB":"—"}</td>
                          <td style={{...s.td}}>
                            <div style={{display:"flex",gap:6}}>
                              <button style={{...s.btnP,padding:"4px 12px",fontSize:11}} onClick={async()=>{
                                const token=localStorage.getItem("ca_token");
                                const API=import.meta.env.VITE_API_URL||"http://localhost:8001";
                                const res=await fetch(`${API}/sop/download/${doc.id}`,{headers:{Authorization:`Bearer ${token}`}});
                                const blob=await res.blob();
                                const url=URL.createObjectURL(blob);
                                const a=document.createElement("a"); a.href=url; a.download=doc.filename;
                                document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                              }}>⬇ Download</button>
                              {isAdmin&&<button style={{...s.btnDanger,padding:"4px 10px",fontSize:11}} onClick={async()=>{
                                if(!confirm("Delete this document?")) return;
                                await apiFetch(`/sop/${doc.id}`,{method:"DELETE"});
                                flash("Document deleted"); loadSopDocs();
                              }}>✕</button>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              }
            </div>
          </div>}

          {/* How to use sub-tab */}
          {tab==="doc-guide"&&<div>
            {isAdmin&&<div style={{marginBottom:12,display:"flex",justifyContent:"flex-end"}}>
              <button style={{...s.btnP,padding:"6px 14px",fontSize:12}} onClick={()=>{setShowGuideForm(true);setNewGuideForm({section:"",title:"",content:""});}}>+ Add section</button>
            </div>}

            {guideItems.length===0
              ?<div style={{...s.card,textAlign:"center",padding:"40px",color:QB.textMuted}}>No guide content yet</div>
              :<div style={{display:"flex",flexDirection:"column",gap:12}}>
                {guideItems.map((g,i)=>(
                  <div key={g.id} style={s.card}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:8}}>
                      <div style={{fontSize:15,fontWeight:600,color:QB.textPrimary}}>{g.title}</div>
                      {isAdmin&&<div style={{display:"flex",gap:6,flexShrink:0,marginLeft:12}}>
                        <button style={{...s.btnS,padding:"3px 10px",fontSize:11}} onClick={()=>setEditingGuide({...g})}>Edit</button>
                        <button style={{...s.btnDanger,padding:"3px 8px",fontSize:11}} onClick={async()=>{
                          if(!confirm("Delete this section?")) return;
                          await apiFetch(`/guide/${g.id}`,{method:"DELETE"});
                          flash("Section deleted"); loadGuide();
                        }}>✕</button>
                      </div>}
                    </div>
                    <div style={{fontSize:13,color:QB.textSecondary,lineHeight:1.7,whiteSpace:"pre-wrap"}}>{g.content}</div>
                    {g.updated_at&&<div style={{marginTop:8,fontSize:11,color:QB.textMuted}}>Last updated: {new Date(g.updated_at).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"})}</div>}
                  </div>
                ))}
              </div>
            }
          </div>}
        </div>}

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
                    {rentRolls[p.id]&&rentRolls[p.id].length>0&&(
                      <div style={{marginBottom:8}}>
                        <div style={{fontSize:11,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:6}}>📋 Rent Roll</div>
                        {rentRolls[p.id].map((rr,ri)=>(
                          <div key={ri} style={{marginBottom:6,padding:"10px 12px",background:"#F0FDF4",borderRadius:QB.radiusMD,border:"1px solid #B7E5B0"}}>
                            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
                              <span style={{fontSize:11,fontWeight:700,color:QB.green}}>{rr.sub_location||"Rent Roll"} · {fmtMonth(rr.report_date)}</span>
                              <button style={{background:"none",border:"none",fontSize:11,color:QB.blue,cursor:"pointer",padding:0}} onClick={e=>{e.stopPropagation();setShowRentRoll(rr);}}>View →</button>
                            </div>
                            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:4}}>
                              <div><div style={{fontSize:10,color:QB.textMuted}}>Leases</div><div style={{fontSize:12,fontWeight:600,color:QB.textPrimary}}>{rr.active_leases}</div></div>
                              <div><div style={{fontSize:10,color:QB.textMuted}}>GLA</div><div style={{fontSize:12,fontWeight:600,color:QB.textPrimary}}>{fmtShort(rr.total_gla)} m²</div></div>
                              <div><div style={{fontSize:10,color:QB.textMuted}}>Ann. Rent</div><div style={{fontSize:12,fontWeight:600,color:QB.green}}>EGP {fmtShort(rr.annualized_rent)}</div></div>
                            </div>
                            <div style={{marginTop:5,display:"flex",gap:4,flexWrap:"wrap"}}>
                              <span style={{padding:"1px 6px",borderRadius:10,fontSize:10,background:"#FEF2F2",color:"#C80C0F",fontWeight:600}}>🔴 {rr.expiry_0_1yr} &lt;1yr</span>
                              <span style={{padding:"1px 6px",borderRadius:10,fontSize:10,background:"#FFFBEB",color:"#B45309",fontWeight:600}}>🟡 {rr.expiry_1_2yr} 1-2yr</span>
                              <span style={{padding:"1px 6px",borderRadius:10,fontSize:10,background:"#F2FBF0",color:"#2CA01C",fontWeight:600}}>🟢 {rr.expiry_3plus} &gt;3yr</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <div style={{fontSize:12,color:QB.blue,fontWeight:500}}>View reports →</div>
                    </div>
                  </div>
                  {isAdmin&&<>
                    <div style={s.divider}/>
                    <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                      {isEditor&&<label style={{...s.btnS,padding:"4px 12px",fontSize:12,cursor:"pointer",display:"inline-flex",alignItems:"center",gap:4}}>
                        📥 Rent Roll
                        <input type="file" accept=".xlsx" style={{display:"none"}} onChange={async e=>{
                          const file=e.target.files[0]; if(!file)return;
                          setUploadingRR(p.id);
                          const fd=new FormData(); fd.append("file",file); fd.append("property_id",p.id);
                          try{
                            const token=localStorage.getItem("ca_token");
                            const API=import.meta.env.VITE_API_URL||"http://localhost:8001";
                            const res=await fetch(`${API}/rent-roll/upload`,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:fd});
                            if(!res.ok)throw new Error(await res.text());
                            await loadRentRolls(); flash(`Rent Roll uploaded — ${file.name}`);
                          }catch(err){flash(err.message||"Upload failed","error");}
                          finally{setUploadingRR(null); e.target.value="";}
                        }}/>
                        {uploadingRR===p.id&&" ⏳"}
                      </label>}
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
            {[{id:"log",label:"Collection Log"},...(isEditor?[{id:"add",label:editingLog?"Edit Record":"Add Record"}]:[])].map(v=>(
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
                      const subRate=(subInv+subRS)>0?Math.round(subColl/(subInv+subRS)*100):0;
                      const rows=[];
                      if(propIdx>0) rows.push(
                        <tr key={`sep-${propName}`}><td colSpan={9} style={{padding:"4px 0",background:QB.bgPage,borderBottom:`2px solid ${QB.borderLight}`}}></td></tr>
                      );
                      propLogs.forEach((log,idx)=>{
                        const logBase=(parseFloat(log.total_invoices)||0)+(parseFloat(log.total_revenue_share)||0);
                        const rate=logBase>0?Math.round(log.total_collection/logBase*100):0;
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
                                {isAdmin
                                  ?<button style={{...s.btnS,padding:"3px 10px",fontSize:12}} onClick={()=>{
                                    setEditingLog(log);
                                    setCollForm({property_id:log.property_id,month:log.month,total_invoices:log.total_invoices,total_revenue_share:log.total_revenue_share,total_collection:log.total_collection,notes:log.notes||""});
                                    setCollView("add");
                                  }}>Edit</button>
                                  :<button style={{...s.btnS,padding:"3px 10px",fontSize:12,color:QB.amber,borderColor:QB.amberBorder}} onClick={()=>{
                                    setRequestTarget(log);
                                    setCollForm({property_id:log.property_id,month:log.month,total_invoices:log.total_invoices,total_revenue_share:log.total_revenue_share,total_collection:log.total_collection,notes:log.notes||""});
                                    setRequestForm({reason:""});
                                    setShowRequestModal(true);
                                  }}>✏ Request Edit</button>
                                }
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
            {!isAdmin&&!editingLog&&<div style={{marginBottom:16,padding:"10px 14px",background:QB.amberBg,borderRadius:QB.radiusMD,border:`1px solid ${QB.amberBorder}`,fontSize:12,color:QB.amber}}>
              ⚠ New records require admin approval before appearing in the log.
            </div>}
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
                Collection rate: <strong style={{color:QB.textPrimary}}>{Math.round((parseFloat(collForm.total_collection)||0)/Math.max((parseFloat(collForm.total_invoices)||0)+(parseFloat(collForm.total_revenue_share)||0),1)*100)}%</strong>
              </div>
            )}
            <div style={{display:"flex",gap:8}}>
              <button style={s.btnP} onClick={async()=>{
                if(!collForm.property_id||!collForm.month){flash("Property and month required","error");return;}
                try{
                  if(editingLog){
                    // Editors use Request Edit flow — handled via modal, not here
                    // This path only reached by admin
                    await apiFetch(`/collection-logs/${editingLog.id}`,{method:"PATCH",body:JSON.stringify({total_invoices:parseFloat(collForm.total_invoices)||0,total_revenue_share:parseFloat(collForm.total_revenue_share)||0,total_collection:parseFloat(collForm.total_collection)||0,notes:collForm.notes})});
                    flash("Record updated");
                    setEditingLog(null);setCollView("log");load();
                  }else{
                    const res=await apiFetch("/collection-logs",{method:"POST",body:JSON.stringify({...collForm,property_id:parseInt(collForm.property_id),total_invoices:parseFloat(collForm.total_invoices)||0,total_revenue_share:parseFloat(collForm.total_revenue_share)||0,total_collection:parseFloat(collForm.total_collection)||0})});
                    if(res?.pending_approval){
                      flash("Request submitted — pending admin approval ✓","success");
                      loadEditRequests();
                    }else{
                      flash("Record added");
                    }
                    setEditingLog(null);setCollView("log");load();
                  }
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
            REQUESTS TAB (admin — approve/reject edit requests)
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="requests"&&isAdmin&&<div style={s.card}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
            <div style={s.cardTitle}>Edit Requests</div>
            <div style={{display:"flex",gap:8}}>
              {["all","pending","approved","rejected"].map(f=>(
                <button key={f} style={{...s.btnS,padding:"5px 12px",fontSize:12,
                  background:showRequests===f?QB.blue:"transparent",
                  color:showRequests===f?"#fff":QB.textSecondary,
                  border:`1px solid ${showRequests===f?QB.blue:QB.borderInput}`}}
                  onClick={()=>setShowRequests(showRequests===f?false:f)}>
                  {f.charAt(0).toUpperCase()+f.slice(1)}
                  {f==="pending"&&pendingCount>0&&<span style={{marginLeft:5,background:QB.red,color:"#fff",borderRadius:8,fontSize:10,fontWeight:700,padding:"0 5px"}}>{pendingCount}</span>}
                </button>
              ))}
            </div>
          </div>
          {editRequests.filter(r=>!showRequests||showRequests==="all"||r.status===showRequests).length===0
            ?<Empty text="No edit requests"/>
            :editRequests
              .filter(r=>!showRequests||showRequests==="all"||r.status===showRequests)
              .map(r=>{
                const changes = typeof r.field_changes==="string"?JSON.parse(r.field_changes):r.field_changes;
                const statusColor = r.status==="pending"?QB.amber:r.status==="approved"?QB.green:QB.red;
                const statusBg = r.status==="pending"?QB.amberBg:r.status==="approved"?QB.greenBg:QB.redBg;
                return(
                  <div key={r.id} style={{padding:"16px 0",borderBottom:`1px solid ${QB.borderLight}`}}>
                    <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
                      <div style={{flex:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                          <span style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}>{r.requester_name}</span>
                          <span style={{fontSize:12,color:QB.textMuted}}>→</span>
                          <span style={{fontSize:13,color:QB.textSecondary}}>{r.property_name} · {fmtMonth(r.month)}</span>
                          <span style={{padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600,background:statusBg,color:statusColor}}>{r.status}</span>
                        </div>
                        {r.reason&&<div style={{fontSize:12,color:QB.textSecondary,marginBottom:8,fontStyle:"italic"}}>"{r.reason}"</div>}
                        {/* Show proposed changes — before vs after */}
                        {(()=>{
                          const isNew=changes._new_record;
                          const fields=["total_invoices","total_revenue_share","total_collection","notes"].filter(f=>f in changes);
                          const fieldLabels={total_invoices:"Invoices",total_revenue_share:"Rev. Share",total_collection:"Collection",notes:"Notes"};
                          return(
                            <div style={{marginTop:8}}>
                              {isNew&&<div style={{fontSize:11,fontWeight:600,color:QB.amber,textTransform:"uppercase",letterSpacing:".06em",marginBottom:6}}>New record request</div>}
                              <table style={{borderCollapse:"collapse",fontSize:12,width:"100%",maxWidth:560}}>
                                <thead>
                                  <tr>
                                    <th style={{padding:"4px 12px 4px 0",color:QB.textMuted,fontWeight:600,textAlign:"left",fontSize:11,textTransform:"uppercase",letterSpacing:".06em"}}>Field</th>
                                    {!isNew&&<th style={{padding:"4px 12px",color:QB.textMuted,fontWeight:600,textAlign:"right",fontSize:11,textTransform:"uppercase",letterSpacing:".06em"}}>Current</th>}
                                    <th style={{padding:"4px 0 4px 12px",color:QB.blue,fontWeight:600,textAlign:"right",fontSize:11,textTransform:"uppercase",letterSpacing:".06em"}}>{isNew?"Value":"Requested"}</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {fields.map(f=>{
                                    const logData=collLogs.find(l=>l.id===r.log_id);
                                    const oldVal=logData?logData[f]:null;
                                    const newVal=changes[f];
                                    const isNum=f!=="notes";
                                    const changed=oldVal!==null&&String(oldVal)!==String(newVal);
                                    return(
                                      <tr key={f} style={{borderTop:`1px solid ${QB.borderLight}`}}>
                                        <td style={{padding:"6px 12px 6px 0",color:QB.textSecondary}}>{fieldLabels[f]||f}</td>
                                        {!isNew&&<td style={{padding:"6px 12px",textAlign:"right",color:QB.textMuted,fontFamily:"monospace",fontSize:12}}>
                                          {oldVal!==null?(isNum?`EGP ${fmtShort(oldVal)}`:oldVal||"—"):"—"}
                                        </td>}
                                        <td style={{padding:"6px 0 6px 12px",textAlign:"right",fontWeight:600,fontFamily:isNum?"monospace":"inherit",fontSize:12,
                                          color:changed?QB.blue:QB.textPrimary,
                                          background:changed?"#EEF5FB":"transparent",borderRadius:4,paddingLeft:8,paddingRight:8}}>
                                          {isNum?`EGP ${fmtShort(newVal)}`:newVal||"—"}
                                          {changed&&<span style={{marginLeft:4,fontSize:10,color:QB.blue}}>↑</span>}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          );
                        })()}
                        {r.review_note&&<div style={{marginTop:8,fontSize:12,color:QB.textSecondary}}>Admin note: <em>{r.review_note}</em></div>}
                      </div>
                      <div style={{display:"flex",gap:8,flexShrink:0,flexDirection:"column",alignItems:"flex-end"}}>
                        <div style={{fontSize:11,color:QB.textMuted}}>{new Date((r.created_at.endsWith("Z")?r.created_at:r.created_at+"Z")).toLocaleString("en-GB",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",timeZone:"Africa/Cairo"})}</div>
                        {r.status==="pending"&&<div style={{display:"flex",gap:6}}>
                          <button style={{...s.btnS,padding:"4px 12px",fontSize:12,color:QB.green,borderColor:QB.greenBorder}}
                            onClick={()=>{setReviewModal({...r,action:"approve"});setReviewNote("");}}>✓ Approve</button>
                          <button style={{...s.btnS,padding:"4px 12px",fontSize:12,color:QB.red,borderColor:QB.redBorder}}
                            onClick={()=>{setReviewModal({...r,action:"reject"});setReviewNote("");}}>✕ Reject</button>
                        </div>}
                      </div>
                    </div>
                  </div>
                );
              })
          }
        </div>}

        {/* ══════════════════════════════════════════════════════════════════
            RENT ROLL TAB
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="rent-roll"&&(()=>{
          // Sub-tab bar
          const rrSubTabs=[{id:"leases",label:"Lease Register"},{id:"recon",label:"📑 Invoice Recon"},{id:"log",label:"📋 Upload Log"}];
          // Collect all sub_locations for selected property
          const propRRs = rrTabProp ? (rentRolls[parseInt(rrTabProp)]||[]) : [];
          const subLocations = [...new Set(propRRs.map(r=>r.sub_location).filter(Boolean))];

          // Filter leases
          const unitTypes = [...new Set(rrTabLeases.map(l=>l.unit_type).filter(Boolean))].sort();
          const filtered = rrTabLeases.filter(l=>{
            if(rrTabSub && (l.sub_location||"")!==rrTabSub) return false;
            if(rrTabTypes.length>0 && !rrTabTypes.includes(l.unit_type||"")) return false;
            if(rrTabSearch){
              const q=rrTabSearch.toLowerCase();
              if(!l.tenant_brand?.toLowerCase().includes(q)&&!l.unit_code?.toLowerCase().includes(q)) return false;
            }
            if(rrTabExpiry&&l.lease_end){
              const end=new Date(l.lease_end);
              const now=new Date();
              const diffMs=end-now;
              const diffYrs=diffMs/(1000*60*60*24*365.25);
              if(rrTabExpiry==="0-1"&&!(diffYrs<=1)) return false;
              if(rrTabExpiry==="1-2"&&!(diffYrs>1&&diffYrs<=2)) return false;
              if(rrTabExpiry==="2-3"&&!(diffYrs>2&&diffYrs<=3)) return false;
              if(rrTabExpiry==="3+"&&!(diffYrs>3)) return false;
            }
            if(rrTabDateFrom&&l.lease_end&&new Date(l.lease_end)<new Date(rrTabDateFrom)) return false;
            if(rrTabDateTo&&l.lease_end&&new Date(l.lease_end)>new Date(rrTabDateTo)) return false;
            return true;
          });

          // Summary KPIs from filtered
          const totalGLA = filtered.reduce((a,l)=>a+(parseFloat(l.gla)||0),0);
          const totalRent = filtered.reduce((a,l)=>a+(parseFloat(l.annualized_rent)||0),0);
          const now=new Date();
          const exp1yr = filtered.filter(l=>{
            if(!l.lease_end) return false;
            const diffYrs=(new Date(l.lease_end)-now)/(1000*60*60*24*365.25);
            return diffYrs<=1;
          }).length;

          // Sort filtered results
          const sortedFiltered = [...filtered].sort((a,b)=>{
            if(!rrSort.col) return 0;
            let va,vb;
            if(rrSort.col==="tenant") { va=a.tenant_brand||""; vb=b.tenant_brand||""; }
            else if(rrSort.col==="unit") { va=a.unit_code||""; vb=b.unit_code||""; }
            else if(rrSort.col==="gla") { va=parseFloat(a.gla)||0; vb=parseFloat(b.gla)||0; }
            else if(rrSort.col==="rent") { va=parseFloat(a.annualized_rent)||0; vb=parseFloat(b.annualized_rent)||0; }
            else if(rrSort.col==="monthly_rent") {
              const ma=rrTabMonthly.find(m=>m.lease_id===a.id);
              const mb=rrTabMonthly.find(m=>m.lease_id===b.id);
              va=ma?parseFloat(ma.rent)||0:0; vb=mb?parseFloat(mb.rent)||0:0;
            }
            else if(rrSort.col==="lease_end") { va=a.lease_end||""; vb=b.lease_end||""; }
            else if(rrSort.col==="rem_yrs") { va=parseFloat(a.remaining_years)||0; vb=parseFloat(b.remaining_years)||0; }
            else if(rrSort.col==="escalation") { va=parseFloat(a.escalation_rate)||0; vb=parseFloat(b.escalation_rate)||0; }
            else return 0;
            if(va<vb) return rrSort.dir==="asc"?-1:1;
            if(va>vb) return rrSort.dir==="asc"?1:-1;
            return 0;
          });

          // Monthly totals if month selected
          const filteredIds = new Set(filtered.map(l=>l.id));
          const monthlyFiltered = rrTabMonthly.filter(m=>filteredIds.has(m.lease_id));
          const totalMonthlyRent = monthlyFiltered.reduce((a,m)=>a+(parseFloat(m.rent)||0),0);
          const totalMonthlySC = monthlyFiltered.reduce((a,m)=>a+(parseFloat(m.sc)||0),0);

          return(
            <div>
              {/* Sub-tab bar */}
              <div style={{display:"flex",borderBottom:`2px solid ${QB.borderLight}`,marginBottom:20}}>
                {rrSubTabs.map(t=>(
                  <button key={t.id} onClick={()=>setRrSubTab(t.id)} style={{padding:"8px 20px",fontSize:13,fontWeight:rrSubTab===t.id?600:400,color:rrSubTab===t.id?QB.blue:QB.textMuted,background:"none",border:"none",borderBottom:rrSubTab===t.id?`2px solid ${QB.blue}`:"2px solid transparent",cursor:"pointer",marginBottom:-2,fontFamily:QB.fontFamily}}>
                    {t.label}
                  </button>
                ))}
              </div>

                            {/* Upload Log sub-tab */}
              {rrSubTab==="log"&&<div style={{...s.card,marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                  <select style={{...s.input,width:180}} value={rrHistoryProp}
                    onChange={e=>{setRrHistoryProp(e.target.value);if(e.target.value) loadRrHistory(parseInt(e.target.value));}}>
                    <option value="">Select property...</option>
                    {Object.keys(rentRolls).map(pid=>{
                      const prop=properties.find(p=>p.id===parseInt(pid));
                      return prop?<option key={pid} value={pid}>{prop.name}</option>:null;
                    })}
                  </select>
                  {rrHistoryProp&&<span style={{fontSize:12,color:QB.textMuted}}>{rrHistory.length} uploads</span>}
                </div>
                {rrHistory.length>0?(
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr style={{background:QB.bgSidebar}}>
                        {["Sub-location","Report Date","Upload Date","By","Leases","GLA m²","Ann. Rent","Monthly Rent","Monthly SC","<1yr","Changes"].map(h=>(
                          <th key={h} style={{...s.th,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {rrHistory.map((h,i)=>{
                          const isLatest=h.is_latest;
                          return(
                            <tr key={h.id} style={{background:isLatest?QB.blueLight:i%2===0?QB.bgCard:QB.bgSidebar,borderBottom:`1px solid ${QB.borderLight}`}}>
                              <td style={{...s.td,fontWeight:isLatest?700:400,color:isLatest?QB.blue:QB.textPrimary}}>
                                {h.sub_location||"—"}
                                {isLatest&&<span style={{fontSize:10,background:QB.blue,color:"#fff",borderRadius:8,padding:"1px 6px",marginLeft:6}}>Latest</span>}
                              </td>
                              <td style={{...s.td,color:QB.textSecondary,whiteSpace:"nowrap"}}>{h.report_date||"—"}</td>
                              <td style={{...s.td,color:QB.textMuted,fontSize:11,whiteSpace:"nowrap"}}>
                                {h.upload_date?new Date(h.upload_date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—"}
                              </td>
                              <td style={{...s.td,color:QB.textSecondary}}>{h.uploaded_by_name||"—"}</td>
                              <td style={{...s.td,textAlign:"right",fontWeight:600}}>{h.active_leases}</td>
                              <td style={{...s.td,textAlign:"right",color:QB.textSecondary}}>{fmtShort(h.total_gla)}</td>
                              <td style={{...s.td,textAlign:"right",color:QB.green,fontWeight:600,whiteSpace:"nowrap"}}>EGP {fmtShort(h.annualized_rent)}</td>
                              <td style={{...s.td,textAlign:"right",color:QB.green,whiteSpace:"nowrap"}}>EGP {fmtShort(h.monthly_rent)}</td>
                              <td style={{...s.td,textAlign:"right",color:QB.blue,whiteSpace:"nowrap"}}>EGP {fmtShort(h.monthly_sc)}</td>
                              <td style={{...s.td,textAlign:"center",color:h.expiry_0_1yr>0?"#C80C0F":QB.textMuted,fontWeight:h.expiry_0_1yr>0?700:400}}>{h.expiry_0_1yr}</td>
                              <td style={s.td}>
                                {h.delta_leases===null
                                  ?<span style={{fontSize:10,color:QB.textMuted}}>First upload</span>
                                  :<div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                                    {h.delta_leases!==0&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:8,background:h.delta_leases>0?"#F0FDF4":"#FEF2F2",color:h.delta_leases>0?"#2CA01C":"#C80C0F",fontWeight:600}}>
                                      {h.delta_leases>0?"+":""}{h.delta_leases} leases
                                    </span>}
                                    {Math.abs(h.delta_rent||0)>1000&&<span style={{fontSize:10,padding:"1px 6px",borderRadius:8,background:h.delta_rent>0?"#F0FDF4":"#FEF2F2",color:h.delta_rent>0?"#2CA01C":"#C80C0F",fontWeight:600}}>
                                      {h.delta_rent>0?"+":""}EGP {fmtShort(h.delta_rent)}
                                    </span>}
                                    {h.delta_leases===0&&Math.abs(h.delta_rent||0)<=1000&&<span style={{fontSize:10,color:QB.textMuted}}>No change</span>}
                                  </div>
                                }
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ):<div style={{textAlign:"center",padding:"30px",color:QB.textMuted,fontSize:13}}>
                  {rrHistoryProp?"No upload history found":"Select a property to view upload history"}
                </div>}
              </div>}

              {/* Invoice Recon sub-tab */}
              {rrSubTab==="recon"&&<div>
                {/* Header + Upload */}
                <div style={{...s.card,marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10,marginBottom:14}}>
                    <div style={s.cardTitle}>Invoice Reconciliation</div>
                    <div style={{display:"flex",gap:8,alignItems:"flex-end"}}>
                      <div>
                        <label style={{...s.label,marginBottom:2}}>Upload month</label>
                        <input type="month" style={{...s.input,width:150}} value={reconUploadMonth} onChange={e=>setReconUploadMonth(e.target.value)}/>
                      </div>
                      <label style={{...s.btnS,padding:"7px 14px",fontSize:12,cursor:reconProp&&reconUploadMonth?"pointer":"not-allowed",opacity:reconProp&&reconUploadMonth?1:0.5,display:"flex",alignItems:"center",gap:5}}>
                      {uploadingRecon?"⏳":"📥"} Upload Lease Summary
                      <input type="file" accept=".xlsx" style={{display:"none"}} disabled={!reconProp||!reconUploadMonth} onChange={async e=>{
                        const file=e.target.files[0]; if(!file||!reconProp||!reconUploadMonth) return;
                        setUploadingRecon(true);
                        const fd=new FormData(); fd.append("file",file);
                        fd.append("property_id",reconProp); fd.append("report_month",reconUploadMonth);
                        try{
                          const token=localStorage.getItem("ca_token");
                          const API=import.meta.env.VITE_API_URL||"http://localhost:8001";
                          const res=await fetch(`${API}/invoice-recon/upload`,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:fd});
                          const r=await res.json();
                          if(r.ok){
                            flash(`Uploaded: ${r.invoiced_count} invoiced, ${r.not_invoiced_count} not invoiced`);
                            await loadReconMonths(parseInt(reconProp));
                            setReconMonth(reconUploadMonth);
                            loadReconLines(reconProp,reconUploadMonth,reconSub,reconElement,reconStatus);
                            loadReconSummary(reconProp,reconUploadMonth,reconSub||"");
                          }else flash(r.detail||"Upload failed","error");
                        }catch(ex){flash("Upload failed","error");}
                        finally{setUploadingRecon(false);e.target.value="";}
                      }}/>
                    </label>
                    </div>
                  </div>
                  {/* Filters */}
                  <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
                    <div>
                      <label style={s.label}>Property</label>
                      <select style={{...s.input,width:150}} value={reconProp} onChange={e=>{
                        const pid=e.target.value;
                        setReconProp(pid);setReconMonth("");setReconSub("");setReconLines([]);setReconSummary([]);
                        if(pid){
                          loadReconMonths(parseInt(pid));
                          loadReconUploadLog(parseInt(pid));
                          loadReconLines(pid,"",reconSub,reconElement,reconStatus);
                          loadReconSummary(pid,"",reconSub);
                        }
                      }}>
                        <option value="">Select...</option>
                        {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Month</label>
                      <input type="month" style={{...s.input,width:160,color:reconMonth?QB.blue:QB.textMuted,fontWeight:reconMonth?600:400,borderColor:reconMonth?QB.blue:QB.borderInput}}
                        value={reconMonth}
                        min={reconMonths.length>0?reconMonths[0].report_month:""}
                        max={reconMonths.length>0?reconMonths[reconMonths.length-1].report_month:""}
                        onChange={e=>{
                          const month=e.target.value;
                          setReconMonth(month);
                          if(reconProp){
                            loadReconLines(reconProp,month,reconSub,reconElement,reconStatus);
                            loadReconSummary(reconProp,month,reconSub);
                          }
                        }}/>
                      {reconMonth&&<button style={{fontSize:11,color:QB.textMuted,background:"none",border:"none",cursor:"pointer",marginTop:2,display:"block"}} onClick={()=>{
                        setReconMonth("");
                        if(reconProp){loadReconLines(reconProp,"",reconSub,reconElement,reconStatus);loadReconSummary(reconProp,"",reconSub);}
                      }}>✕ Clear (YTD)</button>}
                    </div>
                    <div>
                      <label style={s.label}>Sub-location</label>
                      <select style={{...s.input,width:140}} value={reconSub} onChange={e=>{
                        const sub=e.target.value; setReconSub(sub);
                        if(reconProp){
                          loadReconLines(reconProp,reconMonth,sub,reconElement,reconStatus);
                          loadReconSummary(reconProp,reconMonth,sub);
                        }
                      }}>
                        <option value="">All</option>
                        {[...new Set(reconLines.map(l=>l.sub_location).filter(Boolean))].sort().map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Element Group</label>
                      <select style={{...s.input,width:150}} value={reconElement} onChange={e=>{
                        setReconElement(e.target.value);
                        if(reconProp&&reconMonth) loadReconLines(reconProp,reconMonth,reconSub,e.target.value,reconStatus);
                      }}>
                        <option value="">All</option>
                        <option value="Rent">Rent</option>
                        <option value="Service Charge">Service Charge</option>
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Status</label>
                      <select style={{...s.input,width:140}} value={reconStatus} onChange={e=>{
                        const v=e.target.value; setReconStatus(v);
                        if(reconProp&&reconMonth) loadReconLines(reconProp,reconMonth,reconSub,reconElement,v);
                      }}>
                        <option value="">All</option>
                        <option value="invoiced">✅ Invoiced</option>
                        <option value="not_invoiced">❌ Not invoiced</option>
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Reason</label>
                      <select style={{...s.input,width:160}} value={reconReason} onChange={e=>setReconReason(e.target.value)}>
                        <option value="">All reasons</option>
                        <option value="__none__">No comment yet</option>
                        {["Cancellation","Amendment Request","Missing Tax Data","Grace Period","Under Review","Dispute","Other"].map(r=>(
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{flex:1,minWidth:160}}>
                      <label style={s.label}>Search tenant</label>
                      <input style={s.input} placeholder="Search..." value={reconSearch} onChange={e=>setReconSearch(e.target.value)}/>
                    </div>
                    {(reconSearch||reconReason)&&<button style={{...s.btnS,padding:"8px 10px",fontSize:12}} onClick={()=>{setReconSearch("");setReconReason("");}}>✕ Clear</button>}
                  </div>
                </div>

                {/* KPI Summary */}
                {reconSummary.length>0&&(()=>{
                  const tot=reconSummary.reduce((a,r)=>({
                    total_lines:a.total_lines+r.total_lines,
                    invoiced_count:a.invoiced_count+r.invoiced_count,
                    not_invoiced_count:a.not_invoiced_count+r.not_invoiced_count,
                    invoiced_amount:a.invoiced_amount+parseFloat(r.invoiced_amount||0),
                    not_invoiced_amount:a.not_invoiced_amount+parseFloat(r.not_invoiced_amount||0),
                    delta_invoiced:(a.delta_invoiced??0)+(r.delta_invoiced??0),
                    delta_not_invoiced:(a.delta_not_invoiced??0)+(r.delta_not_invoiced??0),
                  }),{total_lines:0,invoiced_count:0,not_invoiced_count:0,invoiced_amount:0,not_invoiced_amount:0,delta_invoiced:0,delta_not_invoiced:0});
                  const pct=tot.total_lines>0?Math.round(tot.invoiced_count/tot.total_lines*100):0;
                  return(
                    <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
                      <div style={{...s.card,marginBottom:0,textAlign:"center",padding:"14px"}}>
                        <div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>Total lines</div>
                        <div style={{fontSize:20,fontWeight:700,color:QB.textPrimary}}>{tot.total_lines}</div>
                      </div>
                      <div onClick={()=>setReconStatus("invoiced")} style={{...s.card,marginBottom:0,textAlign:"center",padding:"14px",border:`1px solid #B7E5B0`,background:"#F2FBF0",cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 0 2px #2CA01C`}
                        onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                        <div style={{fontSize:10,color:"#2CA01C",textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>✅ Invoiced</div>
                        <div style={{fontSize:20,fontWeight:700,color:"#2CA01C"}}>{tot.invoiced_count} <span style={{fontSize:13}}>({pct}%)</span></div>
                        <div style={{fontSize:11,color:"#2CA01C",marginTop:2}}>EGP {fmtShort(tot.invoiced_amount)}</div>
                        {tot.delta_invoiced!==null&&tot.delta_invoiced!==0&&<div style={{fontSize:10,color:"#2CA01C",marginTop:2}}>{tot.delta_invoiced>0?"+":""}{tot.delta_invoiced} vs last month</div>}
                        <div style={{fontSize:10,color:"#2CA01C",marginTop:3}}>Click to filter →</div>
                      </div>
                      <div onClick={()=>setReconStatus("not_invoiced")} style={{...s.card,marginBottom:0,textAlign:"center",padding:"14px",border:`1px solid #FECACA`,background:"#FEF2F2",cursor:"pointer"}}
                        onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 0 2px #C80C0F`}
                        onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                        <div style={{fontSize:10,color:"#C80C0F",textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>❌ Not invoiced</div>
                        <div style={{fontSize:20,fontWeight:700,color:"#C80C0F"}}>{tot.not_invoiced_count}</div>
                        <div style={{fontSize:11,color:"#C80C0F",marginTop:2}}>EGP {fmtShort(tot.not_invoiced_amount)}</div>
                        {tot.delta_not_invoiced!==null&&tot.delta_not_invoiced!==0&&<div style={{fontSize:10,color:"#C80C0F",marginTop:2}}>{tot.delta_not_invoiced>0?"+":""}{tot.delta_not_invoiced} vs last month</div>}
                        <div style={{fontSize:10,color:"#C80C0F",marginTop:3}}>Click to filter →</div>
                      </div>
                      <div style={{...s.card,marginBottom:0,textAlign:"center",padding:"14px"}}>
                        <div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>Coverage</div>
                        <div style={{fontSize:20,fontWeight:700,color:pct>=90?QB.green:pct>=70?"#B45309":"#C80C0F"}}>{pct}%</div>
                        <div style={{marginTop:6,height:6,background:QB.borderLight,borderRadius:3,overflow:"hidden"}}>
                          <div style={{height:"100%",width:`${pct}%`,background:pct>=90?QB.green:pct>=70?"#B45309":"#C80C0F",borderRadius:3,transition:"width .3s"}}/>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Table */}
                {reconProp&&(()=>{
                  const filtered=reconLines.filter(l=>{
                    if(reconSearch){
                      const q=reconSearch.toLowerCase();
                      if(!(l.brand||"").toLowerCase().includes(q)&&!(l.customer_name||"").toLowerCase().includes(q)&&!(l.unit||"").toLowerCase().includes(q)) return false;
                    }
                    if(reconReason){
                      if(reconReason==="__none__") return l.ps_invoiced_flag==="N"&&!l.reason;
                      return (l.reason||"")===reconReason;
                    }
                    return true;
                  });
                  const exportExcel=()=>{
                    const headers=["Brand","Customer Name","Unit","Unit Type","Location","Element Group","Due Date","Expected (EGP)","Invoiced (EGP)","Invoice No.","Status","Reason","Notes"];
                    const fmtDt=d=>d?new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"";
                    const rows=filtered.map(l=>[
                      l.brand||"",l.customer_name||"",l.unit||"",l.unit_type||"",l.sub_location||"",l.element_group||"",fmtDt(l.ps_due_date),
                      parseFloat(l.ps_amount||0).toFixed(2),
                      parseFloat(l.ps_revenue_amount||0).toFixed(2),
                      l.invoice_no||"",
                      l.ps_invoiced_flag==="Y"?"Invoiced":"Not Invoiced",
                      l.reason||"",l.notes||""
                    ]);
                    const csv=[headers,...rows].map(r=>r.map(v=>String(v).includes(",")?`"${v}"`:v).join(",")).join("\n");
                    const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
                    const url=URL.createObjectURL(blob);
                    const a=document.createElement("a");
                    a.href=url;a.download=`InvoiceRecon_${properties.find(p=>String(p.id)===String(reconProp))?.name||""}_${reconMonth}.csv`;
                    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
                  };
                  return(
                    <div style={s.card}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <div style={s.cardTitle}>Detail — {filtered.length} records</div>
                        <button style={{...s.btnS,padding:"6px 14px",fontSize:12}} onClick={exportExcel}>📊 Export Excel</button>
                      </div>
                      {reconLoading?<div style={{textAlign:"center",padding:"30px",color:QB.textMuted}}>Loading...</div>
                      :filtered.length===0?<div style={{textAlign:"center",padding:"30px",color:QB.textMuted,fontSize:13}}>No records found</div>
                      :(
                        <div style={{overflowX:"auto",maxHeight:520,overflowY:"auto"}}>
                          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                            <thead style={{position:"sticky",top:0,zIndex:5}}>
                              <tr style={{background:QB.bgSidebar}}>
                                {[
                              {h:"Brand",w:150},{h:"Unit",w:120},{h:"Location",w:90},
                              {h:"Element",w:110},{h:"Due Date",w:100},
                              {h:"Expected",w:100},{h:"Invoiced",w:100},
                              {h:"Invoice No.",w:100},{h:"Status",w:110},{h:"Comment",w:120}
                            ].map(({h,w})=>(
                                  <th key={h} style={{padding:"9px 10px",textAlign:"left",fontSize:10,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".06em",borderBottom:`2px solid ${QB.borderCard}`,whiteSpace:"nowrap",minWidth:w}}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {filtered.map((l,i)=>{
                                const invoiced=l.ps_invoiced_flag==="Y";
                                return(
                                  <tr key={l.id} onClick={()=>{setReconDetail(l);setReconComment({reason:l.reason||"",notes:l.notes||"",status:l.comment_status||"open"});}}
                                    style={{background:invoiced?(i%2===0?QB.bgCard:QB.bgSidebar):(i%2===0?"#FEF2F2":"#FFF5F5"),cursor:"pointer",borderBottom:`1px solid ${QB.borderLight}`}}
                                    onMouseEnter={e=>e.currentTarget.style.background=QB.blueLight}
                                    onMouseLeave={e=>e.currentTarget.style.background=invoiced?(i%2===0?QB.bgCard:QB.bgSidebar):(i%2===0?"#FEF2F2":"#FFF5F5")}>
                                    <td style={{padding:"8px 10px",fontWeight:600,color:QB.textPrimary,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.brand||l.customer_name||"—"}</td>
                                    <td style={{padding:"8px 10px",color:QB.textSecondary,whiteSpace:"nowrap"}}>{l.unit||"—"}</td>
                                    <td style={{padding:"8px 10px",color:QB.textMuted,fontSize:11,whiteSpace:"nowrap"}}>{l.sub_location||"—"}</td>
                                    <td style={{padding:"8px 10px"}}><span style={{padding:"2px 7px",borderRadius:10,fontSize:10,whiteSpace:"nowrap",background:l.element_group==="Rent"?QB.blueLight:QB.bgSidebar,color:l.element_group==="Rent"?QB.blue:QB.textSecondary,border:`1px solid ${l.element_group==="Rent"?QB.blue+"33":QB.borderLight}`}}>{l.element_group||"—"}</span></td>
                                    <td style={{padding:"8px 10px",color:QB.textMuted,fontSize:11,whiteSpace:"nowrap"}}>{l.ps_due_date?new Date(l.ps_due_date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—"}</td>
                                    <td style={{padding:"8px 10px",textAlign:"right",color:QB.textPrimary,fontWeight:500,whiteSpace:"nowrap"}}>EGP {fmtShort(l.ps_amount)}</td>
                                    <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:invoiced?QB.green:"#C80C0F",whiteSpace:"nowrap"}}>{invoiced?`EGP ${fmtShort(l.ps_revenue_amount)}`:"—"}</td>
                                    <td style={{padding:"8px 10px",color:QB.textMuted,fontSize:11,fontFamily:"monospace",whiteSpace:"nowrap"}}>{l.invoice_no||"—"}</td>
                                    <td style={{padding:"8px 10px"}}>
                                      {invoiced
                                        ?<span style={{padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:600,background:"#F2FBF0",color:"#2CA01C",border:"1px solid #B7E5B0"}}>✅ Invoiced</span>
                                        :<span style={{padding:"2px 8px",borderRadius:10,fontSize:10,fontWeight:600,background:"#FEF2F2",color:"#C80C0F",border:"1px solid #FECACA"}}>❌ Not invoiced</span>
                                      }
                                    </td>
                                    <td style={{padding:"8px 10px",maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
                                      {l.reason?<span style={{fontSize:11,color:"#B45309",background:"#FFFBEB",padding:"2px 6px",borderRadius:8}}>{l.reason}</span>
                                      :<span style={{fontSize:11,color:QB.textMuted}}>—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {!reconProp&&<div style={{...s.card,textAlign:"center",padding:"40px"}}>
                  <div style={{fontSize:32,marginBottom:10}}>📑</div>
                  <div style={{fontSize:14,fontWeight:600,color:QB.textPrimary,marginBottom:6}}>Select a property</div>
                  <div style={{fontSize:13,color:QB.textMuted}}>Choose a property and month to view invoice reconciliation</div>
                </div>}

                {/* Upload History Log */}
                {reconProp&&reconUploadLog.length>0&&<div style={{...s.card,marginTop:16}}>
                  <div style={{...s.cardTitle,marginBottom:12}}>📋 Upload History</div>
                  <div style={{overflowX:"auto"}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead><tr style={{background:QB.bgSidebar}}>
                        {["Sub-location","Month","Uploaded","By","Total","Invoiced","Not Invoiced","Coverage","Last Invoice No."].map(h=>(
                          <th key={h} style={{...s.th,whiteSpace:"nowrap"}}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {reconUploadLog.map((u,i)=>{
                          const pct=u.total_lines>0?Math.round(u.invoiced_count/u.total_lines*100):0;
                          return(
                            <tr key={u.id} onClick={()=>{setReconMonth(u.report_month);setReconSub(u.sub_location||"");loadReconLines(reconProp,u.report_month,u.sub_location||"",reconElement,reconStatus);loadReconSummary(reconProp,u.report_month,u.sub_location||"");}}
                              style={{background:reconMonth===u.report_month&&(reconSub||"")===(u.sub_location||"")?QB.blueLight:i%2===0?QB.bgCard:QB.bgSidebar,cursor:"pointer",borderBottom:`1px solid ${QB.borderLight}`}}>
                              <td style={s.td}>{u.sub_location||"—"}{reconMonth===u.report_month&&<span style={{fontSize:10,background:QB.blue,color:"#fff",borderRadius:8,padding:"1px 6px",marginLeft:6}}>Active</span>}</td>
                              <td style={{...s.td,fontWeight:600,color:QB.textPrimary}}>{fmtMonth(u.report_month)}</td>
                              <td style={{...s.td,color:QB.textMuted,fontSize:11}}>{u.upload_date?new Date(u.upload_date).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—"}</td>
                              <td style={{...s.td,color:QB.textSecondary}}>{u.uploaded_by_name||"—"}</td>
                              <td style={{...s.td,textAlign:"right",fontWeight:600}}>{u.total_lines}</td>
                              <td style={{...s.td,textAlign:"right",color:QB.green,fontWeight:600}}>{u.invoiced_count}</td>
                              <td style={{...s.td,textAlign:"right",color:"#C80C0F",fontWeight:600}}>{u.not_invoiced_count}</td>
                              <td style={{...s.td,textAlign:"center"}}>
                                <span style={{fontSize:11,fontWeight:700,color:pct>=90?QB.green:pct>=70?"#B45309":"#C80C0F"}}>{pct}%</span>
                              </td>
                              <td style={{...s.td,color:QB.textMuted,fontSize:11,fontFamily:"monospace"}}>—</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>}
              </div>}

              {/* Leases sub-tab */}
              {rrSubTab==="leases"&&<div>
              {/* Filters + Upload */}
              <div style={{...s.card,marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                  <div style={s.cardTitle}>Lease Register</div>
                  {(isAdmin||isEditor)&&<label style={{...s.btnP,padding:"6px 14px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                    📥 Upload Rent Roll
                    <input type="file" accept=".xlsx" style={{display:"none"}} onChange={async e=>{
                      const file=e.target.files[0]; if(!file) return;
                      if(!rrTabProp){flash("Select a property first","error");return;}
                      setUploadingRR(rrTabProp);
                      const fd=new FormData(); fd.append("file",file); fd.append("property_id",rrTabProp);
                      try{
                        const token=localStorage.getItem("ca_token");
                        const API=import.meta.env.VITE_API_URL||"http://localhost:8001";
                        const res=await fetch(`${API}/rent-roll/upload`,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:fd});
                        const r=await res.json();
                        if(r.ok){flash(`Uploaded: ${r.active_leases} leases · ${r.sub_location||""}`);loadRentRolls();loadRentRollTab(parseInt(rrTabProp));}
                        else flash(r.detail||"Upload failed","error");
                      }catch(ex){flash("Upload failed","error");}
                      finally{setUploadingRR(null);e.target.value="";}
                    }}/>
                  </label>}
                </div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"flex-end"}}>
                  <div>
                    <label style={s.label}>Property</label>
                    <select style={{...s.input,width:160}} value={rrTabProp} onChange={e=>{
                      setRrTabProp(e.target.value);setRrTabSub("");setRrTabType("");setRrTabExpiry("");setRrTabSearch("");
                      if(e.target.value)loadRentRollTab(parseInt(e.target.value));
                      else setRrTabLeases([]);
                    }}>
                      <option value="">Select property</option>
                      {Object.keys(rentRolls).map(pid=>{
                        const prop=properties.find(p=>p.id===parseInt(pid));
                        return prop?<option key={pid} value={pid}>{prop.name}</option>:null;
                      })}
                    </select>
                  </div>
                  {subLocations.length>1&&<div>
                    <label style={s.label}>Sub-location</label>
                    <select style={{...s.input,width:140}} value={rrTabSub} onChange={e=>setRrTabSub(e.target.value)}>
                      <option value="">All</option>
                      {subLocations.map(s=><option key={s}>{s}</option>)}
                    </select>
                  </div>}
                  {unitTypes.length>0&&<div style={{position:"relative"}}>
                    <label style={s.label}>Unit Type</label>
                    <button onClick={e=>{e.stopPropagation();setRrTypeMenuOpen(v=>!v);}}
                      style={{...s.input,width:160,textAlign:"left",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                      <span>{rrTabTypes.length===0?"All types":`${rrTabTypes.length} selected`}</span>
                      <span style={{fontSize:10,opacity:0.5}}>{rrTypeMenuOpen?"▲":"▼"}</span>
                    </button>
                    {rrTypeMenuOpen&&<div style={{position:"absolute",top:"100%",left:0,background:QB.bgCard,border:`1px solid ${QB.borderCard}`,borderRadius:QB.radiusLG,boxShadow:QB.shadowModal,zIndex:100,minWidth:180,maxHeight:240,overflowY:"auto",padding:"6px 0"}}>
                      <button onClick={()=>setRrTabTypes([])} style={{display:"block",width:"100%",padding:"7px 14px",textAlign:"left",border:"none",background:rrTabTypes.length===0?QB.blueLight:"transparent",color:rrTabTypes.length===0?QB.blue:QB.textPrimary,cursor:"pointer",fontSize:12,fontFamily:QB.fontFamily}}>
                        ✓ All types
                      </button>
                      {unitTypes.map(t=>(
                        <button key={t} onClick={()=>setRrTabTypes(prev=>prev.includes(t)?prev.filter(x=>x!==t):[...prev,t])}
                          style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"7px 14px",textAlign:"left",border:"none",background:rrTabTypes.includes(t)?QB.blueLight:"transparent",color:rrTabTypes.includes(t)?QB.blue:QB.textPrimary,cursor:"pointer",fontSize:12,fontFamily:QB.fontFamily}}>
                          <span style={{width:14,height:14,border:`2px solid ${rrTabTypes.includes(t)?QB.blue:QB.borderInput}`,borderRadius:3,background:rrTabTypes.includes(t)?QB.blue:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                            {rrTabTypes.includes(t)&&<span style={{color:"#fff",fontSize:9,fontWeight:700}}>✓</span>}
                          </span>
                          {t}
                        </button>
                      ))}
                    </div>}
                  </div>}
                  <div>
                    <label style={s.label}>Expiry</label>
                    <select style={{...s.input,width:130}} value={rrTabExpiry} onChange={e=>setRrTabExpiry(e.target.value)}>
                      <option value="">All</option>
                      <option value="0-1">{"< 1 year"}</option>
                      <option value="1-2">1–2 years</option>
                      <option value="2-3">2–3 years</option>
                      <option value="3+">{">"} 3 years</option>
                    </select>
                  </div>
                  {rrTabMonths.length>0&&<div>
                    <label style={s.label}>📅 View month</label>
                    <select style={{...s.input,width:150,fontWeight:600,color:QB.blue,borderColor:QB.blue}} value={rrTabMonth} onChange={e=>{
                      setRrTabMonth(e.target.value);
                      if(rrTabProp&&e.target.value) loadRentRollMonthly(parseInt(rrTabProp),e.target.value);
                    }}>
                      <option value="">— Lease data only —</option>
                      {rrTabMonths.map(m=><option key={m} value={m}>{fmtMonth(m)}</option>)}
                    </select>
                  </div>}
                  <div style={{flex:1,minWidth:160}}>
                    <label style={s.label}>Search tenant / unit</label>
                    <input style={s.input} placeholder="Search..." value={rrTabSearch} onChange={e=>setRrTabSearch(e.target.value)}/>
                  </div>
                  <div>
                    <label style={s.label}>Lease end from</label>
                    <input type="date" style={{...s.input,width:140}} value={rrTabDateFrom} onChange={e=>setRrTabDateFrom(e.target.value)}/>
                  </div>
                  <div>
                    <label style={s.label}>Lease end to</label>
                    <input type="date" style={{...s.input,width:140}} value={rrTabDateTo} onChange={e=>setRrTabDateTo(e.target.value)}/>
                  </div>
                  {(rrTabSub||rrTabTypes.length>0||rrTabExpiry||rrTabSearch||rrTabDateFrom||rrTabDateTo)&&
                    <button style={{...s.btnS,padding:"8px 12px",fontSize:12}} onClick={()=>{setRrTabSub("");setRrTabTypes([]);setRrTabExpiry("");setRrTabSearch("");setRrTabDateFrom("");setRrTabDateTo("");}}>✕ Clear</button>
                  }
                </div>
              </div>

              {!rrTabProp?(
                <div style={{...s.card,textAlign:"center",padding:"60px 20px"}}>
                  <div style={{fontSize:32,marginBottom:12}}>📋</div>
                  <div style={{fontSize:14,fontWeight:600,color:QB.textPrimary,marginBottom:6}}>Select a property</div>
                  <div style={{fontSize:13,color:QB.textMuted}}>Choose a property to view its rent roll</div>
                </div>
              ):rrTabLoading?(
                <div style={{...s.card,textAlign:"center",padding:"40px"}}><div style={{color:QB.textMuted}}>Loading leases...</div></div>
              ):(
                <>
                  {/* KPI summary */}
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:16}}>
                    {[
                      {label:"Filtered Leases",value:filtered.length,color:QB.textPrimary},
                      {label:"Total GLA",value:`${fmtShort(totalGLA)} m²`,color:QB.textPrimary},
                      rrTabMonth&&totalMonthlyRent>0
                        ?{label:`Monthly Rent · ${fmtMonth(rrTabMonth)}`,value:`EGP ${fmtShort(totalMonthlyRent)}`,color:QB.green}
                        :{label:"Ann. Rent",value:`EGP ${fmtShort(totalRent)}`,color:QB.green},
                      rrTabMonth&&totalMonthlySC>0
                        ?{label:`Monthly SC · ${fmtMonth(rrTabMonth)}`,value:`EGP ${fmtShort(totalMonthlySC)}`,color:QB.blue}
                        :{label:"Expiring < 1yr",value:exp1yr,color:exp1yr>0?"#C80C0F":QB.green},
                    ].map(({label,value,color})=>(
                      <div key={label} style={{...s.card,marginBottom:0,textAlign:"center",padding:"14px 16px"}}>
                        <div style={{fontSize:10,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>{label}</div>
                        <div style={{fontSize:18,fontWeight:700,color}}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Leases table */}
                  <div style={s.card}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <div style={s.cardTitle}>
                        Lease Register — {filtered.length} records
                        {rrTabMonth&&<span style={{fontSize:12,color:QB.blue,fontWeight:400,marginLeft:8}}>· {fmtMonth(rrTabMonth)}</span>}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                      <button style={{...s.btnS,padding:"6px 14px",fontSize:12,display:"flex",alignItems:"center",gap:5}}
                        onClick={()=>{
                          // Excel export
                          const prop=properties.find(p=>p.id===parseInt(rrTabProp));
                          const fmtDate=d=>d?new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—";
                          const headers=["Tenant","Unit","Floor","Type","GLA m²","Ann. Rent (EGP)","Rent/m² (EGP)","SC/m² (EGP)","Lease Start","Lease End","Rem. Years","Escalation %","Sub-location"];
                          const rows=filtered.map(l=>[
                            l.tenant_brand||"",l.unit_code||"",l.floor||"",l.unit_type||"",
                            parseFloat(l.gla)||0,parseFloat(l.annualized_rent)||0,
                            parseFloat(l.rent_per_sqm)||0,parseFloat(l.sc_per_sqm)||0,
                            fmtDate(l.lease_start),fmtDate(l.lease_end),
                            parseFloat(l.remaining_years)||0,
                            parseFloat(l.escalation_rate)||0,
                            l.sub_location||""
                          ]);
                          const csvContent=[headers,...rows].map(r=>r.map(v=>typeof v==="string"&&v.includes(",")?`"${v}"`:v).join(",")).join("\n");
                          const BOM="﻿";
                          const blob=new Blob([BOM+csvContent],{type:"text/csv;charset=utf-8;"});
                          const url=URL.createObjectURL(blob);
                          const a=document.createElement("a");
                          a.href=url;a.download=`RentRoll_${prop?.name||"Export"}_${rrTabSub||"All"}_${new Date().toISOString().slice(0,10)}.csv`;
                          document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
                        }}>📊 Export Excel</button>
                      <button style={{...s.btnS,padding:"6px 14px",fontSize:12,display:"flex",alignItems:"center",gap:5}}
                        onClick={()=>{
                          const prop=properties.find(p=>p.id===parseInt(rrTabProp));
                          const fmtDate=d=>d?new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—";
                          const rows=filtered.map(l=>{
                            const remYr=(parseFloat(l.remaining_years)||0).toFixed(1);
                            const remColor=parseFloat(l.remaining_years)<=1?"#C80C0F":parseFloat(l.remaining_years)<=2?"#B45309":"#2CA01C";
                            return `<tr style="border-bottom:1px solid #EEF0F3">
                              <td style="padding:8px 10px;font-weight:500;color:#1C1C1C;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.tenant_brand||"—"}</td>
                              <td style="padding:8px 10px;color:#57647A">${l.unit_code||"—"}</td>
                              <td style="padding:8px 10px;color:#57647A">${l.unit_type||"—"}</td>
                              <td style="padding:8px 10px;text-align:right;color:#57647A">${fmtShort(l.gla)}</td>
                              <td style="padding:8px 10px;text-align:right;font-weight:600;color:#2CA01C">EGP ${fmtShort(l.annualized_rent)}</td>
                              <td style="padding:8px 10px;text-align:right;color:#57647A">${l.rent_per_sqm?`EGP ${fmtShort(l.rent_per_sqm)}`:"—"}</td>
                              <td style="padding:8px 10px;color:#57647A">${fmtDate(l.lease_end)}</td>
                              <td style="padding:8px 10px;text-align:center;font-weight:700;color:${remColor}">${remYr}</td>
                            </tr>`;
                          }).join("");
                          const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Rent Roll — ${prop?.name||""}</title>
                          <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1C1C1C}
                          @media print{@page{margin:15mm;size:A4 landscape}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
                          <body>
                          <div style="height:4px;background:#FEDE07"></div>
                          <div style="padding:20px 24px;border-bottom:1px solid #E3E8EF;display:flex;justify-content:space-between;align-items:center">
                            <div><div style="font-size:16px;font-weight:700">Rent Roll — ${prop?.name||""}</div>
                            <div style="font-size:11px;color:#8C96A3">${rrTabSub||"All sub-locations"} · ${filtered.length} leases · Generated ${new Date().toLocaleDateString("en-GB")}</div></div>
                            <div style="font-size:11px;color:#C4CBD6">Confidential</div>
                          </div>
                          <div style="padding:16px 24px">
                          <div style="height:2px;background:linear-gradient(to right,#C80C0F,#FEDE07);margin-bottom:16px"></div>
                          <table style="width:100%;border-collapse:collapse;font-size:11px">
                          <thead><tr style="background:#F8F9FA">
                            ${["Tenant","Unit","Type","GLA m²","Ann. Rent","Rent/m²","Lease End","Rem. Yrs"].map(h=>`<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.07em;border-bottom:2px solid #E3E8EF">${h}</th>`).join("")}
                          </tr></thead>
                          <tbody>${rows}</tbody>
                          </table></div>
                          <div style="padding:12px 24px;border-top:1px solid #EEF0F3;display:flex;justify-content:space-between;font-size:10px;color:#8C96A3;margin-top:16px">
                            <span>Savills Egypt CA · Client Accounting · Property Management</span>
                            <span>Total GLA: ${fmtShort(totalGLA)} m² · Ann. Rent: EGP ${fmtShort(totalRent)}</span>
                          </div></body></html>`;
                          const w=window.open("","_blank");w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),500);
                        }}>📄 Export PDF</button>
                      </div>
                    </div>
                    {sortedFiltered.length===0?<div style={{textAlign:"center",padding:"30px",color:QB.textMuted,fontSize:13}}>No leases match your filters</div>:(
                      <div style={{overflowX:"auto",maxHeight:520,overflowY:"auto"}}>
                        <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                          <thead style={{position:"sticky",top:0,zIndex:5}}>
                            <tr style={{background:QB.bgSidebar}}>
                              {[
                                {label:"Tenant",col:"tenant"},{label:"Unit",col:"unit"},
                                {label:"Floor",col:""},{label:"Type",col:""},
                                {label:"GLA m²",col:"gla"},
                                ...(rrTabMonth?[{label:"Monthly Rent",col:"monthly_rent"},{label:"Monthly SC",col:""}]:[{label:"Ann. Rent",col:"rent"},{label:"Rent/m²",col:""}]),
                                {label:"Lease Start",col:""},{label:"Lease End",col:"lease_end"},
                                {label:"Rem. Yrs",col:"rem_yrs"},{label:"Escalation",col:"escalation"},
                              ].map(({label,col})=>(
                                <th key={label} onClick={col?()=>setRrSort(prev=>({col,dir:prev.col===col&&prev.dir==="asc"?"desc":"asc"})):undefined}
                                  style={{padding:"9px 10px",textAlign:"left",fontSize:10,color:col?QB.blue:QB.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",borderBottom:`2px solid ${QB.borderCard}`,whiteSpace:"nowrap",cursor:col?"pointer":"default",userSelect:"none"}}>
                                  {label}{col&&rrSort.col===col?(rrSort.dir==="asc"?" ↑":" ↓"):""}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {sortedFiltered.map((l,i)=>{
                              const remYr=parseFloat(l.remaining_years)||0;
                              const remColor=remYr<=1?"#C80C0F":remYr<=2?"#B45309":QB.green;
                              const remBg=remYr<=1?"#FEF2F2":remYr<=2?"#FFFBEB":"transparent";
                              const fmtDate=d=>d?new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—";
                              return(
                                <tr key={l.id||i} onClick={()=>{setUnitDetail(l);setScheduleTab("yearly");}} style={{background:i%2===0?QB.bgCard:QB.bgSidebar,borderBottom:`1px solid ${QB.borderLight}`,cursor:"pointer"}}
                                  onMouseEnter={e=>e.currentTarget.style.background=QB.blueLight}
                                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?QB.bgCard:QB.bgSidebar}>
                                  <td style={{padding:"8px 10px",fontWeight:600,color:QB.textPrimary,maxWidth:160,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={l.tenant_brand}>{l.tenant_brand||"—"}</td>
                                  <td style={{padding:"8px 10px",color:QB.textSecondary,whiteSpace:"nowrap"}}>{l.unit_code||"—"}</td>
                                  <td style={{padding:"8px 10px",color:QB.textMuted}}>{l.floor||"—"}</td>
                                  <td style={{padding:"8px 10px"}}><span style={{padding:"2px 7px",borderRadius:10,fontSize:10,background:QB.blueLight,color:QB.blue,border:`1px solid ${QB.blue}22`,whiteSpace:"nowrap"}}>{l.unit_type||"—"}</span></td>
                                  <td style={{padding:"8px 10px",textAlign:"right",color:QB.textSecondary}}>{fmtShort(l.gla)}</td>
                                  {rrTabMonth?(()=>{
                                    const mData=rrTabMonthly.find(m=>m.lease_id===l.id);
                                    return(<>
                                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:QB.green,whiteSpace:"nowrap"}}>{mData&&mData.rent>0?`EGP ${fmtShort(mData.rent)}`:"—"}</td>
                                      <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:QB.blue,whiteSpace:"nowrap"}}>{mData&&mData.sc>0?`EGP ${fmtShort(mData.sc)}`:"—"}</td>
                                    </>);
                                  })():(()=>(<>
                                    <td style={{padding:"8px 10px",textAlign:"right",fontWeight:600,color:QB.green,whiteSpace:"nowrap"}}>EGP {fmtShort(l.annualized_rent)}</td>
                                    <td style={{padding:"8px 10px",textAlign:"right",color:QB.textSecondary,whiteSpace:"nowrap"}}>{l.rent_per_sqm?`EGP ${fmtShort(l.rent_per_sqm)}`:"—"}</td>
                                  </>))()}
                                  <td style={{padding:"8px 10px",color:QB.textMuted,whiteSpace:"nowrap"}}>{fmtDate(l.lease_start)}</td>
                                  <td style={{padding:"8px 10px",color:QB.textSecondary,whiteSpace:"nowrap"}}>{fmtDate(l.lease_end)}</td>
                                  <td style={{padding:"8px 10px",textAlign:"center"}}>
                                    <span style={{padding:"3px 8px",borderRadius:10,fontSize:11,fontWeight:700,color:remColor,background:remBg,border:remBg!=="transparent"?`1px solid ${remColor}33`:"none"}}>{remYr.toFixed(1)}</span>
                                  </td>
                                  <td style={{padding:"8px 10px",textAlign:"right",color:QB.textSecondary}}>{l.escalation_rate?`${l.escalation_rate}%`:"—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>}
          </div>
          );
        })()}

        {/* ══════════════════════════════════════════════════════════════════
            CUSTOMERS DB TAB (admin only)
        ══════════════════════════════════════════════════════════════════ */}
        {tab==="customers"&&isAdmin&&<div>
          {/* Header + actions */}
          <div style={{...s.card,marginBottom:16}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
              <div style={s.cardTitle}>Customer Database — {customers.length} records</div>
              <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                {/* Import from Rent Roll */}
                <div>
                  <select style={{...s.input,width:160,fontSize:12}} defaultValue="" onChange={async e=>{
                    const pid=parseInt(e.target.value); if(!pid) return;
                    try{
                      const r=await apiFetch(`/customers/import-from-rent-roll?property_id=${pid}`,{method:"POST"});
                      if(r){
                        const parts=[];
                        if(r.added>0) parts.push(`${r.added} added`);
                        if(r.updated>0) parts.push(`${r.updated} updated`);
                        if(r.skipped>0) parts.push(`${r.skipped} skipped`);
                        flash(parts.join(" · ") || "No changes");
                        loadCustomers(customerSearch,customerFilterProp);
                      }
                    }catch(ex){flash(ex.message,"error");}
                    e.target.value="";
                  }}>
                    <option value="">📋 Import from Rent Roll...</option>
                    {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                {/* Upload Excel */}
                <label style={{...s.btnS,padding:"7px 14px",fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:5}}>
                  📥 Upload Excel
                  <input type="file" accept=".xlsx,.csv" style={{display:"none"}} onChange={async e=>{
                    const file=e.target.files[0]; if(!file) return;
                    setImportingCustomers(true);
                    const fd=new FormData(); fd.append("file",file);
                    try{
                      const token=localStorage.getItem("ca_token");
                      const API=import.meta.env.VITE_API_URL||"http://localhost:8001";
                      const res=await fetch(`${API}/customers/import`,{method:"POST",headers:{Authorization:`Bearer ${token}`},body:fd});
                      const r=await res.json();
                      flash(`Imported ${r.added} customers (${r.skipped} skipped)`);
                      loadCustomers();
                    }catch(ex){flash(ex.message||"Import failed","error");}
                    finally{setImportingCustomers(false);e.target.value="";}
                  }}/>
                  {importingCustomers&&" ⏳"}
                </label>
                {/* Add manual */}
                <button style={s.btnP} onClick={()=>{setEditCustomer(null);setCustomerForm({brand_name:"",legal_name:"",unit_code:"",unit_type:"",location:"",lease_type:"",property_id:"",sub_location:"",bank_account:"",phone:"",email:"",notes:""});setShowCustomerForm(true);}}>+ Add Customer</button>
              </div>
            </div>
            {/* Filters + Search + Export */}
            <div style={{marginTop:12,display:"flex",gap:8,flexWrap:"wrap",alignItems:"flex-end"}}>
              <div>
                <label style={{...s.label,marginBottom:3}}>Property</label>
                <select style={{...s.input,width:150}} value={customerFilterProp} onChange={e=>{
                  setCustomerFilterProp(e.target.value);
                  setCustomerFilterSub("");
                  loadCustomers(customerSearch,e.target.value);
                }}>
                  <option value="">All properties</option>
                  {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              {customerFilterProp&&(()=>{
                const subs=[...new Set(customers.map(c=>c.sub_location).filter(Boolean))];
                return subs.length>1?<div>
                  <label style={{...s.label,marginBottom:3}}>Sub-location</label>
                  <select style={{...s.input,width:140}} value={customerFilterSub} onChange={e=>setCustomerFilterSub(e.target.value)}>
                    <option value="">All</option>
                    {subs.map(s=><option key={s}>{s}</option>)}
                  </select>
                </div>:null;
              })()}
              {(()=>{
                const types=[...new Set(customers.map(c=>c.unit_type).filter(Boolean))].sort();
                return types.length>0?<div>
                  <label style={{...s.label,marginBottom:3}}>Unit Type</label>
                  <select style={{...s.input,width:140}} value={customerFilterType} onChange={e=>setCustomerFilterType(e.target.value)}>
                    <option value="">All types</option>
                    {types.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>:null;
              })()}
              <div style={{flex:1,minWidth:200}}>
                <label style={{...s.label,marginBottom:3}}>Search</label>
                <input style={s.input} placeholder="🔍 Brand, legal name, or unit..."
                  value={customerSearch} onChange={e=>{setCustomerSearch(e.target.value);loadCustomers(e.target.value,customerFilterProp);}}/>
              </div>
              {(customerSearch||customerFilterProp||customerFilterSub||customerFilterType)&&
                <button style={{...s.btnS,padding:"8px 12px",fontSize:12}} onClick={()=>{
                  setCustomerSearch("");setCustomerFilterProp("");setCustomerFilterSub("");setCustomerFilterType("");loadCustomers("");
                }}>✕ Clear</button>}
              <button style={{...s.btnS,padding:"8px 14px",fontSize:12,display:"flex",alignItems:"center",gap:4}} onClick={()=>{
                const toExport=filteredCustomers;
                const headers=["Brand Name","Legal Name","Tenant Number","Document Type","Document No.","Unit Code","Unit Type","Location","Sub-location","Property","Lease Type","Bank Account","Phone","Email","Notes","Source"];
                const rows=toExport.map(c=>[
                  c.brand_name||"",c.legal_name||"",c.tenant_number||"",
                  c.document_type||"",c.document_no||"",c.unit_code||"",c.unit_type||"",
                  c.location||"",c.sub_location||"",c.property_name||"",
                  c.lease_type||"",c.bank_account||"",c.phone||"",c.email||"",
                  c.notes||"",c.source||""
                ]);
                const csv=[headers,...rows].map(r=>r.map(v=>String(v).includes(",")?`"${v}"`:v).join(",")).join("\n");
                const blob=new Blob(["﻿"+csv],{type:"text/csv;charset=utf-8;"});
                const url=URL.createObjectURL(blob);
                const a=document.createElement("a");
                a.href=url;a.download=`CustomerDB_${customerFilterProp?properties.find(p=>String(p.id)===customerFilterProp)?.name||"":"All"}_${new Date().toISOString().slice(0,10)}.csv`;
                document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
              }}>📊 Export Excel</button>
            </div>
          </div>

          {/* Customer table */}
          {(()=>{
            const filteredCustomers=customers.filter(c=>{
              if(customerFilterSub&&(c.sub_location||"")!==customerFilterSub) return false;
              if(customerFilterType&&(c.unit_type||"")!==customerFilterType) return false;
              return true;
            });
            return(
          <div style={s.card}>
            {filteredCustomers.length===0?<div style={{textAlign:"center",padding:"40px",color:QB.textMuted,fontSize:13}}>
              {customerSearch||customerFilterProp?"No customers match your filters":"No customers yet — import from Rent Roll or upload Excel"}
            </div>:(
              <div style={{overflowX:"auto"}}>
                <div style={{fontSize:12,color:QB.textMuted,marginBottom:8}}>Showing {filteredCustomers.length} customers</div>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                  <thead>
                    <tr style={{background:QB.bgSidebar}}>
                      {["Brand","Legal Name","Tenant No.","Doc Type","Doc No.","Unit","Type","Location","Sub-location","Property","Source",""].map(h=>(
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((c,i)=>(
                      <tr key={c.id} onClick={()=>setCustomerDetail(c)}
                        style={{background:i%2===0?QB.bgCard:QB.bgSidebar,cursor:"pointer",borderBottom:`1px solid ${QB.borderLight}`}}
                        onMouseEnter={e=>e.currentTarget.style.background=QB.blueLight}
                        onMouseLeave={e=>e.currentTarget.style.background=i%2===0?QB.bgCard:QB.bgSidebar}>
                        <td style={{...s.td,fontWeight:600,color:QB.textPrimary}}>{c.brand_name}</td>
                        <td style={{...s.td,color:QB.textSecondary,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.legal_name||"—"}</td>
                        <td style={{...s.td,color:QB.textMuted,fontSize:11}}>{c.tenant_number||"—"}</td>
                        <td style={{...s.td,color:QB.textMuted,fontSize:11}}>{c.document_type||"—"}</td>
                        <td style={{...s.td,color:QB.textMuted,fontSize:11,fontFamily:"monospace"}}>{c.document_no||"—"}</td>
                        <td style={{...s.td,color:QB.textSecondary}}>{c.unit_code||"—"}</td>
                        <td style={s.td}>{c.unit_type?<Badge label={c.unit_type} color="gray"/>:"—"}</td>
                        <td style={{...s.td,color:QB.textSecondary}}>{c.location||"—"}</td>
                        <td style={{...s.td,color:QB.textSecondary}}>{c.sub_location||"—"}</td>
                        <td style={s.td}>{c.property_name?<Badge label={c.property_name} color="blue"/>:"—"}</td>
                        <td style={s.td}><Badge label={c.source||"manual"} color={c.source==="rent_roll"?"green":c.source==="import"?"purple":"gray"}/></td>
                        <td style={s.td}>
                          <button style={{...s.btnS,padding:"3px 10px",fontSize:11}} onClick={e=>{e.stopPropagation();setEditCustomer(c);setCustomerForm({...c,property_id:c.property_id||""});setShowCustomerForm(true);}}>Edit</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          );})()}
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

        {/* Request Edit Modal (for editors) */}
        {showRequestModal&&requestTarget&&<div style={s.overlay}>
          <div style={{...s.modal,width:480}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={s.modalTitle}>Request Edit — {requestTarget.property_name} · {fmtMonth(requestTarget.month)}</div>
              <button onClick={()=>setShowRequestModal(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
            </div>
            <div style={{marginBottom:16,padding:"10px 14px",background:QB.amberBg,borderRadius:QB.radiusMD,border:`1px solid ${QB.amberBorder}`,fontSize:12,color:QB.amber}}>
              ⚠ Your changes will be sent to the admin for approval before being applied.
            </div>
            <div style={s.formGrid}>
              <div><label style={s.label}>Total Invoices (EGP)</label>
                <input type="number" style={s.input} value={collForm.total_invoices} onChange={e=>setCollForm(f=>({...f,total_invoices:e.target.value}))} placeholder="0.00"/>
              </div>
              <div><label style={s.label}>Revenue Share (EGP)</label>
                <input type="number" style={s.input} value={collForm.total_revenue_share} onChange={e=>setCollForm(f=>({...f,total_revenue_share:e.target.value}))} placeholder="0.00"/>
              </div>
              <div><label style={s.label}>Collection (EGP)</label>
                <input type="number" style={s.input} value={collForm.total_collection} onChange={e=>setCollForm(f=>({...f,total_collection:e.target.value}))} placeholder="0.00"/>
              </div>
              <div><label style={s.label}>Notes</label>
                <input style={s.input} value={collForm.notes} onChange={e=>setCollForm(f=>({...f,notes:e.target.value}))}/>
              </div>
            </div>
            <div style={{marginBottom:20}}>
              <label style={s.label}>Reason for change <span style={{color:QB.textMuted,fontWeight:400}}>(optional)</span></label>
              <textarea style={{...s.input,minHeight:64,resize:"vertical"}} value={requestForm.reason} onChange={e=>setRequestForm(f=>({...f,reason:e.target.value}))} placeholder="Explain why this change is needed..."/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...s.btnP,background:QB.amber}} onClick={async()=>{
                const changes={};
                if(parseFloat(collForm.total_invoices)!==parseFloat(requestTarget.total_invoices))changes.total_invoices=parseFloat(collForm.total_invoices)||0;
                if(parseFloat(collForm.total_revenue_share)!==parseFloat(requestTarget.total_revenue_share))changes.total_revenue_share=parseFloat(collForm.total_revenue_share)||0;
                if(parseFloat(collForm.total_collection)!==parseFloat(requestTarget.total_collection))changes.total_collection=parseFloat(collForm.total_collection)||0;
                if(collForm.notes!==requestTarget.notes)changes.notes=collForm.notes;
                if(Object.keys(changes).length===0){flash("No changes detected","error");return;}
                try{
                  await apiFetch("/edit-requests",{method:"POST",body:JSON.stringify({
                    property_id:requestTarget.property_id,
                    log_id:requestTarget.id,
                    month:requestTarget.month,
                    field_changes:changes,
                    reason:requestForm.reason,
                  })});
                  setShowRequestModal(false);
                  loadEditRequests();
                  flash("Edit request submitted — pending admin approval");
                }catch(e){flash(e.message,"error");}
              }}>Submit request</button>
              <button style={s.btnS} onClick={()=>setShowRequestModal(false)}>Cancel</button>
            </div>
          </div>
        </div>}

        {/* Review Modal (admin approve/reject) */}
        {reviewModal&&<div style={s.overlay}>
          <div style={{...s.modal,width:440}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={s.modalTitle}>{reviewModal.action==="approve"?"✓ Approve":"✕ Reject"} Request</div>
              <button onClick={()=>setReviewModal(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
            </div>
            <div style={{marginBottom:16,fontSize:13,color:QB.textSecondary}}>
              <strong>{reviewModal.requester_name}</strong> requested to edit <strong>{reviewModal.property_name} · {fmtMonth(reviewModal.month)}</strong>
            </div>
            <div style={{marginBottom:20}}>
              <label style={s.label}>Note to user <span style={{color:QB.textMuted,fontWeight:400}}>(optional)</span></label>
              <textarea style={{...s.input,minHeight:64,resize:"vertical"}} value={reviewNote} onChange={e=>setReviewNote(e.target.value)} placeholder={reviewModal.action==="approve"?"Approved — changes applied":"Reason for rejection..."}/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={{...s.btnP,background:reviewModal.action==="approve"?QB.green:QB.red}} onClick={async()=>{
                try{
                  await apiFetch(`/edit-requests/${reviewModal.id}`,{method:"PATCH",body:JSON.stringify({action:reviewModal.action,note:reviewNote})});
                  setReviewModal(null);
                  loadEditRequests();
                  load();
                  flash(reviewModal.action==="approve"?"Request approved & changes applied":"Request rejected");
                }catch(e){flash(e.message,"error");}
              }}>{reviewModal.action==="approve"?"Approve & Apply":"Reject"}</button>
              <button style={s.btnS} onClick={()=>setReviewModal(null)}>Cancel</button>
            </div>
          </div>
        </div>}

        {/* Rent Roll Detail Modal */}
        {showRentRoll&&(()=>{
          const rr=showRentRoll;
          const prop=properties.find(p=>p.id===rr.property_id);
          // Auto-load leases for accurate expiry counts
          if(!rentRollLeases[rr.property_id]) loadRentRollLeases(rr.property_id);
          return(
            <div style={s.overlay} onClick={()=>{setShowRentRoll(null);setRrDrilldown(null);}}>
              <div style={{...s.modal,width:700,maxWidth:"95vw"}} onClick={e=>e.stopPropagation()}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
                  <div>
                    <div style={s.modalTitle}>📋 Rent Roll — {prop?.name}</div>
                    <div style={{fontSize:12,color:QB.textMuted,marginTop:-14}}>{fmtMonth(rr.report_date)}</div>
                  </div>
                  <button onClick={()=>{setShowRentRoll(null);setRrDrilldown(null);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
                </div>

                {/* KPI row — clickable */}
                <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                  {[
                    {label:"Active Leases",value:rr.active_leases,color:QB.textPrimary},
                    {label:"Unique Tenants",value:rr.unique_tenants,color:QB.textPrimary},
                    {label:"Total GLA",value:`${fmtShort(rr.total_gla)} m²`,color:QB.textPrimary},
                    {label:"Ann. Rent",value:`EGP ${fmtShort(rr.annualized_rent)}`,color:QB.green},
                  ].map(({label,value,color})=>(
                    <div key={label} onClick={async()=>{
                      const all=rentRollLeases[rr.property_id]||await loadRentRollLeases(rr.property_id);
                      const leases=rr.sub_location?all.filter(l=>(l.sub_location||"")===(rr.sub_location||"")):all;
                      setRrDrilldown({label:"All Active Leases",color:QB.blue,leases,subLabel:rr.sub_location});
                    }} style={{textAlign:"center",padding:"12px 8px",background:QB.bgSidebar,borderRadius:QB.radiusMD,border:`1px solid ${QB.borderLight}`,cursor:"pointer"}}
                    onMouseEnter={e=>e.currentTarget.style.boxShadow=`0 0 0 2px ${QB.blue}`}
                    onMouseLeave={e=>e.currentTarget.style.boxShadow="none"}>
                      <div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>{label}</div>
                      <div style={{fontSize:16,fontWeight:700,color}}>{value}</div>
                      <div style={{fontSize:10,color:QB.blue,marginTop:4}}>View list →</div>
                    </div>
                  ))}
                </div>

                {/* Expiry breakdown — clickable, recalculated from lease_end */}
                <div style={{marginBottom:20}}>
                  <div style={{fontSize:12,fontWeight:600,color:QB.textSecondary,marginBottom:8}}>Lease Expiry Breakdown</div>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
                    {(()=>{
                      const cached=rentRollLeases[rr.property_id];
                      const subL=cached?(rr.sub_location?cached.filter(l=>(l.sub_location||"")===(rr.sub_location||"")):cached):null;
                      const now2=new Date();
                      const calcN=(mn,mx)=>subL?subL.filter(l=>{if(!l.lease_end)return false;const d=(new Date(l.lease_end)-now2)/(1000*60*60*24*365.25);return d>mn&&d<=mx;}).length:null;
                      return[
                        {label:"< 1 year",val:calcN(0,1)??rr.expiry_0_1yr,bg:"#FEF2F2",color:"#C80C0F",minYr:0,maxYr:1},
                        {label:"1–2 years",val:calcN(1,2)??rr.expiry_1_2yr,bg:"#FFFBEB",color:"#B45309",minYr:1,maxYr:2},
                        {label:"2–3 years",val:calcN(2,3)??rr.expiry_2_3yr,bg:"#EFF6FF",color:"#0077C5",minYr:2,maxYr:3},
                        {label:"> 3 years",val:calcN(3,99)??rr.expiry_3plus,bg:"#F2FBF0",color:"#2CA01C",minYr:3,maxYr:99},
                      ];
                    })().map(({label,val,bg,color,minYr,maxYr})=>{
                      const total=rr.active_leases||1;
                      const pct=Math.round(val/total*100);
                      return(
                        <div key={label} onClick={async()=>{
                          const all=rentRollLeases[rr.property_id]||await loadRentRollLeases(rr.property_id);
                          const subFiltered=rr.sub_location?all.filter(l=>(l.sub_location||"")===(rr.sub_location||"")):all;
                          const drillNow=new Date();
                          const filtered=subFiltered.filter(l=>{
                            if(!l.lease_end) return false;
                            const diffMs=new Date(l.lease_end)-drillNow;
                            const diffYrs=diffMs/(1000*60*60*24*365.25);
                            if(minYr===0) return diffYrs>0&&diffYrs<=maxYr; // < 1 year: only future expiry
                            return diffYrs>minYr&&diffYrs<=maxYr;
                          });
                          setRrDrilldown({label,color,leases:filtered,subLabel:rr.sub_location});
                        }} style={{padding:"10px 12px",background:bg,borderRadius:QB.radiusMD,textAlign:"center",cursor:"pointer",border:"2px solid transparent",transition:"border .15s"}}
                        onMouseEnter={e=>e.currentTarget.style.border=`2px solid ${color}`}
                        onMouseLeave={e=>e.currentTarget.style.border="2px solid transparent"}>
                          <div style={{fontSize:22,fontWeight:700,color}}>{val}</div>
                          <div style={{fontSize:11,color,marginTop:2}}>{label}</div>
                          <div style={{fontSize:10,color:QB.textMuted}}>{pct}% of portfolio</div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Monthly figures */}
                <div style={{padding:"12px 16px",background:QB.bgSidebar,borderRadius:QB.radiusMD,border:`1px solid ${QB.borderLight}`,display:"flex",gap:24}}>
                  <div><div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em"}}>Monthly Rent</div><div style={{fontSize:15,fontWeight:700,color:QB.green}}>EGP {fmtShort(rr.monthly_rent)}</div></div>
                  <div><div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em"}}>Monthly SC</div><div style={{fontSize:15,fontWeight:700,color:QB.blue}}>EGP {fmtShort(rr.monthly_sc)}</div></div>
                  <div><div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em"}}>Total Monthly</div><div style={{fontSize:15,fontWeight:700,color:QB.textPrimary}}>EGP {fmtShort(rr.monthly_rent+rr.monthly_sc)}</div></div>
                </div>
                {/* Drill-down inline table */}
                {rrDrilldown&&(
                  <div style={{marginTop:16,borderTop:`1px solid ${QB.borderLight}`,paddingTop:16}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                      <div>
                        <span style={{fontSize:13,fontWeight:700,color:rrDrilldown.color}}>{rrDrilldown.label}</span>
                        {rrDrilldown.subLabel&&<span style={{fontSize:12,color:QB.textMuted,marginLeft:8}}>· {rrDrilldown.subLabel}</span>}
                        <span style={{fontSize:12,color:QB.textMuted,marginLeft:8}}>({rrDrilldown.leases.length} leases)</span>
                      </div>
                      <div style={{display:"flex",gap:8,alignItems:"center"}}>
                        <button style={{...s.btnS,padding:"4px 12px",fontSize:12,color:QB.blue,borderColor:QB.blue}} onClick={()=>{
                          // Navigate to Rent Roll tab with filter
                          const rr=showRentRoll;
                          const propId=rr?.property_id;
                          if(propId){
                            setTab("rent-roll");
                            setRrTabProp(String(propId));
                            if(rrDrilldown.subLabel) setRrTabSub(rrDrilldown.subLabel);
                            // Set expiry filter based on drilldown label
                            const label=rrDrilldown.label;
                            if(label==="< 1 year") setRrTabExpiry("0-1");
                            else if(label==="1–2 years") setRrTabExpiry("1-2");
                            else if(label==="2–3 years") setRrTabExpiry("2-3");
                            else if(label==="> 3 years") setRrTabExpiry("3+");
                            else setRrTabExpiry("");
                            loadRentRollTab(propId);
                          }
                          setShowRentRoll(null);setRrDrilldown(null);
                        }}>📋 Open in Rent Roll →</button>
                        <button style={{...s.btnS,padding:"4px 12px",fontSize:12}} onClick={()=>{
                          // PDF Export of drill-down
                          const rr=showRentRoll;
                          const prop=properties.find(p=>p.id===rr?.property_id);
                          const fmtDate=d=>d?new Date(d).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—";
                          const rows=rrDrilldown.leases.map((l,i)=>`
                            <tr style="background:${i%2===0?"#fff":"#F8F9FA"};border-bottom:1px solid #EEF0F3">
                              <td style="padding:7px 10px;font-weight:500;color:#1C1C1C">${l.tenant_brand||"—"}</td>
                              <td style="padding:7px 10px;color:#57647A">${l.unit_code||"—"}</td>
                              <td style="padding:7px 10px;color:#57647A">${l.unit_type||"—"}</td>
                              <td style="padding:7px 10px;text-align:right;color:#57647A">${fmtShort(l.gla)}</td>
                              <td style="padding:7px 10px;text-align:right;font-weight:600;color:#2CA01C">EGP ${fmtShort(l.annualized_rent)}</td>
                              <td style="padding:7px 10px;text-align:right;color:#57647A">${l.rent_per_sqm?`EGP ${fmtShort(l.rent_per_sqm)}`:"—"}</td>
                              <td style="padding:7px 10px;color:#57647A;white-space:nowrap">${fmtDate(l.lease_end)}</td>
                              <td style="padding:7px 10px;text-align:center;font-weight:700;color:${parseFloat(l.remaining_years)<=1?"#C80C0F":parseFloat(l.remaining_years)<=2?"#B45309":"#2CA01C"}">${(parseFloat(l.remaining_years)||0).toFixed(1)}</td>
                            </tr>`).join("");
                          const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${rrDrilldown.label} — ${prop?.name||""}</title>
                            <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
                            @media print{@page{margin:15mm;size:A4 landscape}body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head>
                            <body>
                            <div style="height:4px;background:#FEDE07"></div>
                            <div style="padding:18px 24px;border-bottom:1px solid #E3E8EF;display:flex;justify-content:space-between;align-items:center">
                              <div>
                                <div style="font-size:15px;font-weight:700;color:#1C1C1C">${prop?.name||""} — ${rrDrilldown.label}</div>
                                <div style="font-size:11px;color:#8C96A3">${rrDrilldown.subLabel||""} · ${rrDrilldown.leases.length} leases · Generated ${new Date().toLocaleDateString("en-GB")}</div>
                              </div>
                              <span style="font-size:11px;color:#C4CBD6">Confidential</span>
                            </div>
                            <div style="padding:16px 24px">
                            <div style="height:2px;background:linear-gradient(to right,#C80C0F,#FEDE07);margin-bottom:14px"></div>
                            <table style="width:100%;border-collapse:collapse;font-size:11px">
                            <thead><tr style="background:#F8F9FA;border-bottom:2px solid #E3E8EF">
                              ${["Tenant","Unit","Type","GLA m²","Ann. Rent","Rent/m²","Lease End","Rem. Yrs"].map(h=>`<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;color:#57647A;text-transform:uppercase;letter-spacing:.07em">${h}</th>`).join("")}
                            </tr></thead>
                            <tbody>${rows}</tbody>
                            </table>
                            <div style="margin-top:12px;padding-top:10px;border-top:1px solid #EEF0F3;display:flex;justify-content:space-between;font-size:10px;color:#8C96A3">
                              <span>Savills Egypt CA · Client Accounting · Property Management</span>
                              <span>Total GLA: ${fmtShort(rrDrilldown.leases.reduce((a,l)=>a+(parseFloat(l.gla)||0),0))} m² · Ann. Rent: EGP ${fmtShort(rrDrilldown.leases.reduce((a,l)=>a+(parseFloat(l.annualized_rent)||0),0))}</span>
                            </div></div></body></html>`;
                          const w=window.open("","_blank");w.document.write(html);w.document.close();w.focus();setTimeout(()=>w.print(),500);
                        }}>📄 Export PDF</button>
                        <button onClick={()=>setRrDrilldown(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:13,color:QB.textMuted}}>✕ Close</button>
                      </div>
                    </div>
                    <div style={{overflowX:"auto",maxHeight:320,overflowY:"auto"}}>
                      <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                        <thead style={{position:"sticky",top:0,background:QB.bgSidebar}}>
                          <tr>
                            {["Tenant","Unit","Type","GLA (m²)","Ann. Rent","Rent/m²","Lease End","Rem. Yrs"].map(h=>(
                              <th key={h} style={{padding:"8px 10px",textAlign:"left",fontSize:10,color:QB.textMuted,fontWeight:600,textTransform:"uppercase",letterSpacing:".06em",borderBottom:`1px solid ${QB.borderLight}`,whiteSpace:"nowrap"}}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rrDrilldown.leases.length===0
                            ?<tr><td colSpan={8} style={{padding:"20px",textAlign:"center",color:QB.textMuted}}>No leases in this range</td></tr>
                            :rrDrilldown.leases.map((l,i)=>{
                              const remYr=parseFloat(l.remaining_years)||0;
                              const remColor=remYr<=1?"#C80C0F":remYr<=2?"#B45309":QB.textPrimary;
                              return(
                                <tr key={l.id||i} onClick={()=>setUnitDetail(l)} style={{background:i%2===0?QB.bgCard:QB.bgSidebar,cursor:"pointer"}}
                                  onMouseEnter={e=>e.currentTarget.style.background=QB.blueLight}
                                  onMouseLeave={e=>e.currentTarget.style.background=i%2===0?QB.bgCard:QB.bgSidebar}>
                                  <td style={{padding:"7px 10px",color:QB.textPrimary,fontWeight:500,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.tenant_brand||"—"}</td>
                                  <td style={{padding:"7px 10px",color:QB.textSecondary,whiteSpace:"nowrap"}}>{l.unit_code||"—"}</td>
                                  <td style={{padding:"7px 10px"}}><span style={{padding:"2px 7px",borderRadius:10,fontSize:10,background:QB.bgSidebar,border:`1px solid ${QB.borderLight}`,color:QB.textSecondary}}>{l.unit_type||"—"}</span></td>
                                  <td style={{padding:"7px 10px",textAlign:"right",color:QB.textSecondary}}>{fmtShort(l.gla)}</td>
                                  <td style={{padding:"7px 10px",textAlign:"right",fontWeight:600,color:QB.green,whiteSpace:"nowrap"}}>EGP {fmtShort(l.annualized_rent)}</td>
                                  <td style={{padding:"7px 10px",textAlign:"right",color:QB.textSecondary,whiteSpace:"nowrap"}}>{l.rent_per_sqm?`EGP ${fmtShort(l.rent_per_sqm)}`:"—"}</td>
                                  <td style={{padding:"7px 10px",color:QB.textSecondary,whiteSpace:"nowrap"}}>{l.lease_end?new Date(l.lease_end).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"—"}</td>
                                  <td style={{padding:"7px 10px",textAlign:"right",fontWeight:700,color:remColor,whiteSpace:"nowrap"}}>{remYr.toFixed(1)}</td>
                                </tr>
                              );
                            })
                          }
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Unit Detail Modal */}
        {unitDetail&&<div style={s.overlay} onClick={()=>setUnitDetail(null)}>
          <div style={{...s.modal,width:520}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:QB.textPrimary}}>{unitDetail.tenant_brand||"—"}</div>
                <div style={{fontSize:12,color:QB.textMuted,marginTop:2}}>{unitDetail.unit_code} · {unitDetail.unit_type} · {unitDetail.floor||"—"}</div>
              </div>
              <button onClick={()=>setUnitDetail(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[
                {label:"GLA",value:`${fmtShort(unitDetail.gla)} m²`},
                {label:"Annual Rent",value:`EGP ${fmtShort(unitDetail.annualized_rent)}`,color:QB.green},
                {label:"Annual SC",value:`EGP ${fmtShort(unitDetail.annualized_sc)}`},
                {label:"Rent / m²",value:unitDetail.rent_per_sqm?`EGP ${fmtShort(unitDetail.rent_per_sqm)}`:"—"},
                {label:"SC / m²",value:unitDetail.sc_per_sqm?`EGP ${fmtShort(unitDetail.sc_per_sqm)}`:"—"},
                {label:"Escalation",value:unitDetail.escalation_rate?`${unitDetail.escalation_rate}%`:"—"},
                {label:"Revenue Share",value:unitDetail.revenue_sharing_rate?`${unitDetail.revenue_sharing_rate}%`:"—"},
                {label:"Security Deposit",value:unitDetail.security_deposit?`EGP ${fmtShort(unitDetail.security_deposit)}`:"—"},
              ].map(({label,value,color})=>(
                <div key={label} style={{padding:"10px 12px",background:QB.bgSidebar,borderRadius:QB.radiusMD,border:`1px solid ${QB.borderLight}`}}>
                  <div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>{label}</div>
                  <div style={{fontSize:14,fontWeight:700,color:color||QB.textPrimary}}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{padding:"12px 16px",background:QB.bgSidebar,borderRadius:QB.radiusMD,border:`1px solid ${QB.borderLight}`,display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12}}>
              <div>
                <div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>Lease Start</div>
                <div style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}>{unitDetail.lease_start?new Date(unitDetail.lease_start).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—"}</div>
              </div>
              <div>
                <div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>Lease End</div>
                <div style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}>{unitDetail.lease_end?new Date(unitDetail.lease_end).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—"}</div>
              </div>
              <div>
                <div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:4}}>Remaining</div>
                <div style={{fontSize:13,fontWeight:700,color:(()=>{const d=(new Date(unitDetail.lease_end)-new Date())/(1000*60*60*24*365.25);return d<=1?"#C80C0F":d<=2?"#B45309":QB.green;})()}}>
                  {(()=>{const d=(new Date(unitDetail.lease_end)-new Date())/(1000*60*60*24*365.25);return d>0?`${d.toFixed(1)} years`:"Expired";})()}
                </div>
              </div>
            </div>
            {unitDetail.tenant_legal&&unitDetail.tenant_legal!==unitDetail.tenant_brand&&(
              <div style={{marginTop:10,padding:"8px 12px",background:QB.bgSidebar,borderRadius:QB.radiusMD,fontSize:12,color:QB.textSecondary}}>
                Legal name: <strong>{unitDetail.tenant_legal}</strong>
              </div>
            )}
            {unitDetail.document_no&&(
              <div style={{marginTop:6,padding:"8px 12px",background:QB.bgSidebar,borderRadius:QB.radiusMD,fontSize:12,color:QB.textMuted}}>
                Contract No: {unitDetail.document_no}
              </div>
            )}

            {/* Payment Schedule */}
            {unitDetail.lease_start&&unitDetail.lease_end&&(()=>{
              const start=new Date(unitDetail.lease_start);
              const end=new Date(unitDetail.lease_end);
              const baseRent=parseFloat(unitDetail.monthly_rent)||0;
              const esc=(parseFloat(unitDetail.escalation_rate)||0)/100;
              const months=[];
              let cur=new Date(start.getFullYear(),start.getMonth(),1);
              const endMonth=new Date(end.getFullYear(),end.getMonth(),1);
              while(cur<=endMonth){
                const yearsSinceStart=cur.getFullYear()-start.getFullYear()+
                  (cur.getMonth()<start.getMonth()?-1:0);
                const escalationYears=Math.max(0,yearsSinceStart);
                const rent=esc>0?baseRent*Math.pow(1+esc,escalationYears):baseRent;
                months.push({date:new Date(cur),rent:rent,year:escalationYears});
                cur=new Date(cur.getFullYear(),cur.getMonth()+1,1);
              }
              // Group by year for display
              const years={};
              months.forEach(m=>{
                const yr=m.date.getFullYear();
                if(!years[yr]){years[yr]={months:[],totalRent:0,rent:m.rent};}
                years[yr].months.push(m);
                years[yr].totalRent+=m.rent;
              });
              return(
                <div style={{marginTop:16,borderTop:`1px solid ${QB.borderLight}`,paddingTop:14}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                    <div style={{fontSize:13,fontWeight:600,color:QB.textPrimary}}>💰 Payment Schedule</div>
                    <div style={{display:"flex",gap:0,border:`1px solid ${QB.borderCard}`,borderRadius:QB.radiusMD,overflow:"hidden"}}>
                      {["yearly","monthly"].map(t=>(
                        <button key={t} onClick={()=>setScheduleTab(t)}
                          style={{padding:"4px 12px",fontSize:11,fontWeight:scheduleTab===t?600:400,background:scheduleTab===t?QB.blue:"transparent",color:scheduleTab===t?"#fff":QB.textMuted,border:"none",cursor:"pointer",fontFamily:QB.fontFamily}}>
                          {t==="yearly"?"By Year":"Monthly"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{maxHeight:240,overflowY:"auto",borderRadius:QB.radiusMD,border:`1px solid ${QB.borderLight}`}}>
                    <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                      <thead style={{position:"sticky",top:0,background:QB.bgSidebar}}>
                        <tr>
                          {scheduleTab==="yearly"
                            ?["Year","Period","Monthly Rent","Annual Total"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:10,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".06em",borderBottom:`1px solid ${QB.borderLight}`}}>{h}</th>)
                            :["Month","Monthly Rent","Cumulative"].map(h=><th key={h} style={{padding:"7px 10px",textAlign:"left",fontSize:10,fontWeight:600,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".06em",borderBottom:`1px solid ${QB.borderLight}`}}>{h}</th>)
                          }
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleTab==="yearly"
                          ?Object.entries(years).map(([yr,data],i)=>(
                            <tr key={yr} style={{background:i%2===0?QB.bgCard:QB.bgSidebar,borderBottom:`1px solid ${QB.borderLight}`}}>
                              <td style={{padding:"7px 10px",fontWeight:600,color:QB.textPrimary}}>{yr}</td>
                              <td style={{padding:"7px 10px",color:QB.textMuted,fontSize:11}}>
                                {new Date(data.months[0].date).toLocaleDateString("en-GB",{month:"short",year:"numeric"})}
                                {" – "}
                                {new Date(data.months[data.months.length-1].date).toLocaleDateString("en-GB",{month:"short",year:"numeric"})}
                              </td>
                              <td style={{padding:"7px 10px",color:QB.green,fontWeight:600}}>EGP {fmtShort(data.rent)}</td>
                              <td style={{padding:"7px 10px",color:QB.textSecondary,fontWeight:600}}>EGP {fmtShort(data.totalRent)}</td>
                            </tr>
                          ))
                          :(()=>{
                            let cum=0;
                            return months.map((m,i)=>{
                              cum+=m.rent;
                              const isNow=m.date.getFullYear()===new Date().getFullYear()&&m.date.getMonth()===new Date().getMonth();
                              return(
                                <tr key={i} style={{background:isNow?QB.blueLight:i%2===0?QB.bgCard:QB.bgSidebar,borderBottom:`1px solid ${QB.borderLight}`}}>
                                  <td style={{padding:"7px 10px",fontWeight:isNow?600:400,color:isNow?QB.blue:QB.textPrimary}}>
                                    {m.date.toLocaleDateString("en-GB",{month:"short",year:"numeric"})}
                                    {isNow&&<span style={{fontSize:9,background:QB.blue,color:"#fff",borderRadius:6,padding:"1px 5px",marginLeft:5}}>Now</span>}
                                  </td>
                                  <td style={{padding:"7px 10px",color:QB.green,fontWeight:600}}>EGP {fmtShort(m.rent)}</td>
                                  <td style={{padding:"7px 10px",color:QB.textMuted}}>EGP {fmtShort(cum)}</td>
                                </tr>
                              );
                            });
                          })()
                        }
                      </tbody>
                    </table>
                  </div>
                  <div style={{marginTop:8,display:"flex",justifyContent:"space-between",fontSize:11,color:QB.textMuted}}>
                    <span>{months.length} months total</span>
                    <span style={{fontWeight:600,color:QB.textPrimary}}>Total: EGP {fmtShort(months.reduce((a,m)=>a+m.rent,0))}</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>}

        {/* Customer Detail Modal */}
        {customerDetail&&<div style={s.overlay} onClick={()=>setCustomerDetail(null)}>
          <div style={{...s.modal,width:520}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:QB.textPrimary}}>{customerDetail.brand_name}</div>
                {customerDetail.legal_name&&<div style={{fontSize:12,color:QB.textMuted,marginTop:2}}>{customerDetail.legal_name}</div>}
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={{...s.btnS,padding:"5px 12px",fontSize:12}} onClick={()=>{setEditCustomer(customerDetail);setCustomerForm({...customerDetail,property_id:customerDetail.property_id||""});setShowCustomerForm(true);setCustomerDetail(null);}}>✏ Edit</button>
                <button onClick={()=>setCustomerDetail(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
              </div>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[
                {label:"Unit Code",value:customerDetail.unit_code},
                {label:"Unit Type",value:customerDetail.unit_type},
                {label:"Location",value:customerDetail.location||customerDetail.sub_location},
                {label:"Lease Type",value:customerDetail.lease_type},
                {label:"Property",value:customerDetail.property_name},
                {label:"Tenant Number",value:customerDetail.tenant_number},
                {label:"Document Type",value:customerDetail.document_type},
                {label:"Document No.",value:customerDetail.document_no},
                {label:"Bank Account",value:customerDetail.bank_account},
                {label:"Phone",value:customerDetail.phone},
                {label:"Email",value:customerDetail.email},
              ].map(({label,value})=>value?(
                <div key={label} style={{padding:"10px 12px",background:QB.bgSidebar,borderRadius:QB.radiusMD,border:`1px solid ${QB.borderLight}`}}>
                  <div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>{label}</div>
                  <div style={{fontSize:13,fontWeight:500,color:QB.textPrimary}}>{value}</div>
                </div>
              ):null)}
            </div>
            {customerDetail.notes&&<div style={{padding:"10px 14px",background:QB.amberBg,borderRadius:QB.radiusMD,border:`1px solid ${QB.amberBorder}`,fontSize:12,color:QB.textSecondary}}>
              <strong>Notes:</strong> {customerDetail.notes}
            </div>}
            <div style={{marginTop:12,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <Badge label={customerDetail.source||"manual"} color={customerDetail.source==="rent_roll"?"green":customerDetail.source==="import"?"purple":"gray"}/>
              {isAdmin&&<button style={{...s.btnS,padding:"5px 12px",fontSize:12,color:QB.red,borderColor:QB.redBorder}}
                onClick={async()=>{if(!confirm(`Delete "${customerDetail.brand_name}"?`))return;
                  await apiFetch(`/customers/${customerDetail.id}`,{method:"DELETE"});
                  setCustomerDetail(null);loadCustomers(customerSearch);flash("Customer deleted");}}>Delete</button>}
            </div>
          </div>
        </div>}

        {/* Customer Add/Edit Form Modal */}
        {showCustomerForm&&<div style={s.overlay} onClick={()=>setShowCustomerForm(false)}>
          <div style={{...s.modal,width:560}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={s.modalTitle}>{editCustomer?"Edit Customer":"Add Customer"}</div>
              <button onClick={()=>setShowCustomerForm(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
            </div>
            <div style={s.formGrid}>
              <div><label style={s.label}>Brand Name *</label>
                <input style={s.input} value={customerForm.brand_name} onChange={e=>setCustomerForm(f=>({...f,brand_name:e.target.value}))} placeholder="e.g. Ariika"/>
              </div>
              <div><label style={s.label}>Legal Name</label>
                <input style={s.input} value={customerForm.legal_name} onChange={e=>setCustomerForm(f=>({...f,legal_name:e.target.value}))} placeholder="Full legal entity name"/>
              </div>
              <div><label style={s.label}>Unit Code</label>
                <input style={s.input} value={customerForm.unit_code} onChange={e=>setCustomerForm(f=>({...f,unit_code:e.target.value}))} placeholder="e.g. AZ-305"/>
              </div>
              <div><label style={s.label}>Unit Type</label>
                <input style={s.input} value={customerForm.unit_type} onChange={e=>setCustomerForm(f=>({...f,unit_type:e.target.value}))} placeholder="e.g. Retail, Offices"/>
              </div>
              <div><label style={s.label}>Property</label>
                <select style={s.input} value={customerForm.property_id} onChange={e=>setCustomerForm(f=>({...f,property_id:e.target.value}))}>
                  <option value="">—</option>
                  {properties.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={s.label}>Sub-location</label>
                <input style={s.input} value={customerForm.sub_location} onChange={e=>setCustomerForm(f=>({...f,sub_location:e.target.value}))} placeholder="e.g. Arkan 1"/>
              </div>
              <div><label style={s.label}>Location</label>
                <input style={s.input} value={customerForm.location} onChange={e=>setCustomerForm(f=>({...f,location:e.target.value}))} placeholder="e.g. Arkan Extension"/>
              </div>
              <div><label style={s.label}>Lease Type</label>
                <input style={s.input} value={customerForm.lease_type} onChange={e=>setCustomerForm(f=>({...f,lease_type:e.target.value}))} placeholder="e.g. Retail, Offices"/>
              </div>
              <div><label style={s.label}>Tenant Number</label>
                <input style={s.input} value={customerForm.tenant_number||""} onChange={e=>setCustomerForm(f=>({...f,tenant_number:e.target.value}))} placeholder="Oracle tenant number"/>
              </div>
              <div><label style={s.label}>Document Type</label>
                <input style={s.input} value={customerForm.document_type||""} onChange={e=>setCustomerForm(f=>({...f,document_type:e.target.value}))} placeholder="e.g. Lease, License"/>
              </div>
              <div><label style={s.label}>Document No.</label>
                <input style={s.input} value={customerForm.document_no||""} onChange={e=>setCustomerForm(f=>({...f,document_no:e.target.value}))} placeholder="Contract/document number"/>
              </div>
              <div><label style={s.label}>Bank Account</label>
                <input style={s.input} value={customerForm.bank_account||""} onChange={e=>setCustomerForm(f=>({...f,bank_account:e.target.value}))} placeholder="Remittance account"/>
              </div>
              <div><label style={s.label}>Phone</label>
                <input style={s.input} value={customerForm.phone} onChange={e=>setCustomerForm(f=>({...f,phone:e.target.value}))}/>
              </div>
              <div style={{gridColumn:"1/-1"}}><label style={s.label}>Email</label>
                <input style={s.input} value={customerForm.email} onChange={e=>setCustomerForm(f=>({...f,email:e.target.value}))}/>
              </div>
              <div style={{gridColumn:"1/-1"}}><label style={s.label}>Notes</label>
                <textarea style={{...s.input,minHeight:56,resize:"vertical"}} value={customerForm.notes} onChange={e=>setCustomerForm(f=>({...f,notes:e.target.value}))}/>
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={s.btnP} onClick={async()=>{
                if(!customerForm.brand_name.trim()){flash("Brand name required","error");return;}
                try{
                  const payload={...customerForm,property_id:customerForm.property_id?parseInt(customerForm.property_id):null};
                  if(editCustomer){
                    await apiFetch(`/customers/${editCustomer.id}`,{method:"PATCH",body:JSON.stringify(payload)});
                    flash("Customer updated");
                  }else{
                    await apiFetch("/customers",{method:"POST",body:JSON.stringify(payload)});
                    flash("Customer added");
                  }
                  setShowCustomerForm(false);loadCustomers(customerSearch);
                }catch(ex){flash(ex.message,"error");}
              }}>{editCustomer?"Save changes":"Add customer"}</button>
              <button style={s.btnS} onClick={()=>setShowCustomerForm(false)}>Cancel</button>
            </div>
          </div>
        </div>}

        {/* Add/Edit Guide Section Modal */}
        {(showGuideForm||editingGuide)&&<div style={s.overlay} onClick={()=>{setShowGuideForm(false);setEditingGuide(null);}}>
          <div style={{...s.modal,width:560}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div style={s.modalTitle}>{editingGuide?"Edit section":"Add section"}</div>
              <button onClick={()=>{setShowGuideForm(false);setEditingGuide(null);}} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
            </div>
            <div style={{marginBottom:10}}>
              <label style={s.label}>Title</label>
              <input style={s.input} value={editingGuide?editingGuide.title:newGuideForm.title}
                onChange={e=>editingGuide?setEditingGuide(g=>({...g,title:e.target.value})):setNewGuideForm(f=>({...f,title:e.target.value}))}
                placeholder="e.g. Getting Started"/>
            </div>
            <div style={{marginBottom:16}}>
              <label style={s.label}>Content</label>
              <textarea style={{...s.input,minHeight:160,resize:"vertical",lineHeight:1.6}}
                value={editingGuide?editingGuide.content:newGuideForm.content}
                onChange={e=>editingGuide?setEditingGuide(g=>({...g,content:e.target.value})):setNewGuideForm(f=>({...f,content:e.target.value}))}
                placeholder="Write the guide content here..."/>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={s.btnP} onClick={async()=>{
                if(editingGuide){
                  await apiFetch(`/guide/${editingGuide.id}`,{method:"PATCH",body:JSON.stringify({title:editingGuide.title,content:editingGuide.content})});
                  flash("Section updated"); setEditingGuide(null); loadGuide();
                } else {
                  if(!newGuideForm.title||!newGuideForm.content){flash("Title and content required","error");return;}
                  await apiFetch("/guide",{method:"POST",body:JSON.stringify({...newGuideForm,section:newGuideForm.title.toLowerCase().replace(/\s+/g,"-"),order_index:99})});
                  flash("Section added"); setShowGuideForm(false); setNewGuideForm({section:"",title:"",content:""}); loadGuide();
                }
              }}>{editingGuide?"Save changes":"Add section"}</button>
              <button style={s.btnS} onClick={()=>{setShowGuideForm(false);setEditingGuide(null);}}>Cancel</button>
            </div>
          </div>
        </div>}

        {/* Add Property Modal */}
        {showAddPropForm&&<div style={s.overlay} onClick={()=>setShowAddPropForm(false)}>
          <div style={{...s.modal,width:520}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20}}>
              <div style={s.modalTitle}>Add Property</div>
              <button onClick={()=>setShowAddPropForm(false)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
            </div>
            <div style={s.formGrid}>
              <div><label style={s.label}>Name</label><input style={s.input} value={newProp.name} onChange={e=>setNewProp(p=>({...p,name:e.target.value}))} placeholder="e.g. Arkan"/></div>
              <div><label style={s.label}>System</label>
                <select style={s.input} value={newProp.system} onChange={e=>setNewProp(p=>({...p,system:e.target.value}))}>
                  <option value="">—</option><option>Oracle</option><option>Yardi</option>
                </select>
              </div>
              <div><label style={s.label}>Location</label><input style={s.input} value={newProp.location} onChange={e=>setNewProp(p=>({...p,location:e.target.value}))} placeholder="e.g. Sheikh Zayed"/></div>
              <div><label style={s.label}>Landlord name (optional)</label><input style={s.input} value={newProp.landlord_name} onChange={e=>setNewProp(p=>({...p,landlord_name:e.target.value}))} placeholder="e.g. Arkan Development"/></div>
              <div style={{gridColumn:"1/-1"}}><label style={s.label}>Logo URL (optional)</label><input style={s.input} value={newProp.logo_url} onChange={e=>setNewProp(p=>({...p,logo_url:e.target.value}))} placeholder="https://..."/></div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={s.btnP} onClick={async()=>{
                if(!newProp.name.trim()){flash("Name required","error");return;}
                try{
                  await apiFetch("/properties",{method:"POST",body:JSON.stringify(newProp)});
                  setNewProp({name:"",location:"",system:"",logo_url:"",landlord_name:""});
                  setShowAddPropForm(false);
                  load();flash("Property added");
                }catch(e){flash(e.message,"error");}
              }}>Add property</button>
              <button style={s.btnS} onClick={()=>setShowAddPropForm(false)}>Cancel</button>
            </div>
          </div>
        </div>}

        {/* Invoice Recon Line Detail Modal */}
        {reconDetail&&<div style={s.overlay} onClick={()=>setReconDetail(null)}>
          <div style={{...s.modal,width:540}} onClick={e=>e.stopPropagation()}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:QB.textPrimary}}>{reconDetail.brand||reconDetail.customer_name}</div>
                <div style={{fontSize:12,color:QB.textMuted}}>{reconDetail.unit} · {reconDetail.element_group} · {reconDetail.report_month}</div>
              </div>
              <button onClick={()=>setReconDetail(null)} style={{background:"none",border:"none",cursor:"pointer",fontSize:18,color:QB.textMuted}}>✕</button>
            </div>

            {/* Details grid */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
              {[
                {label:"Expected",value:`EGP ${fmtShort(reconDetail.ps_amount)}`,color:QB.textPrimary},
                {label:"Invoiced Amount",value:reconDetail.ps_revenue_amount>0?`EGP ${fmtShort(reconDetail.ps_revenue_amount)}`:"—",color:reconDetail.ps_invoiced_flag==="Y"?QB.green:"#C80C0F"},
                {label:"Invoice No.",value:reconDetail.invoice_no||"—",color:QB.textMuted},
                {label:"Unit Type",value:reconDetail.unit_type||"—",color:QB.textSecondary},
                {label:"Lease Start",value:reconDetail.lease_start?new Date(reconDetail.lease_start).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—",color:QB.textSecondary},
                {label:"Lease End",value:reconDetail.lease_end?new Date(reconDetail.lease_end).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}):"—",color:QB.textSecondary},
              ].map(({label,value,color})=>(
                <div key={label} style={{padding:"10px 12px",background:QB.bgSidebar,borderRadius:QB.radiusMD,border:`1px solid ${QB.borderLight}`}}>
                  <div style={{fontSize:10,color:QB.textMuted,textTransform:"uppercase",letterSpacing:".07em",marginBottom:3}}>{label}</div>
                  <div style={{fontSize:13,fontWeight:600,color}}>{value}</div>
                </div>
              ))}
            </div>

            {/* Status badge */}
            <div style={{marginBottom:16,textAlign:"center"}}>
              {reconDetail.ps_invoiced_flag==="Y"
                ?<span style={{padding:"6px 16px",borderRadius:20,fontSize:13,fontWeight:700,background:"#F2FBF0",color:"#2CA01C",border:"1px solid #B7E5B0"}}>✅ Invoiced</span>
                :<span style={{padding:"6px 16px",borderRadius:20,fontSize:13,fontWeight:700,background:"#FEF2F2",color:"#C80C0F",border:"1px solid #FECACA"}}>❌ Not Invoiced</span>
              }
            </div>

            {/* Comment section — only for not invoiced */}
            {reconDetail.ps_invoiced_flag==="N"&&<div style={{borderTop:`1px solid ${QB.borderLight}`,paddingTop:14}}>
              <div style={{fontSize:13,fontWeight:600,color:QB.textPrimary,marginBottom:10}}>Comment</div>
              <div style={{marginBottom:10}}>
                <label style={s.label}>Reason</label>
                <select style={s.input} value={reconComment.reason} onChange={e=>setReconComment(c=>({...c,reason:e.target.value}))}>
                  <option value="">Select reason...</option>
                  {["Cancellation","Amendment Request","Missing Tax Data","Grace Period","Under Review","Dispute","Other"].map(r=>(
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div style={{marginBottom:10}}>
                <label style={s.label}>Notes</label>
                <textarea style={{...s.input,minHeight:64,resize:"vertical"}} placeholder="Additional details..." value={reconComment.notes} onChange={e=>setReconComment(c=>({...c,notes:e.target.value}))}/>
              </div>
              <div style={{marginBottom:14}}>
                <label style={s.label}>Status</label>
                <select style={s.input} value={reconComment.status} onChange={e=>setReconComment(c=>({...c,status:e.target.value}))}>
                  <option value="open">Open</option>
                  <option value="resolved">Resolved</option>
                  <option value="pending">Pending</option>
                </select>
              </div>
              <div style={{display:"flex",gap:8}}>
                <button style={s.btnP} onClick={async()=>{
                  await apiFetch("/invoice-recon/comments",{method:"POST",body:JSON.stringify({line_id:reconDetail.id,...reconComment})});
                  flash("Comment saved");
                  // Refresh lines
                  loadReconLines(reconProp,reconMonth,reconSub,reconElement,reconStatus);
                  setReconDetail(null);
                }}>Save comment</button>
                <button style={s.btnS} onClick={()=>setReconDetail(null)}>Cancel</button>
              </div>
            </div>}

            {/* Existing comment display */}
            {reconDetail.ps_invoiced_flag==="Y"&&reconDetail.reason&&<div style={{borderTop:`1px solid ${QB.borderLight}`,paddingTop:12,marginTop:4}}>
              <div style={{fontSize:12,color:QB.textMuted}}>Comment: <strong>{reconDetail.reason}</strong>{reconDetail.notes&&` — ${reconDetail.notes}`}</div>
            </div>}
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
