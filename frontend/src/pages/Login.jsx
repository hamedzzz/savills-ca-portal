import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login, settings } = useAuth();
  const [form, setForm]     = useState({ username: "", password: "" });
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // OTP state
  const [otpStep, setOtpStep]     = useState(false);
  const [otpCode, setOtpCode]     = useState("");
  const [userId, setUserId]       = useState(null);
  const [otpHint, setOtpHint]     = useState("");

  const primaryColor = settings?.primary_color || "#0077C5";
  const accentColor  = settings?.accent_color  || "#FEDE07";
  const fontFamily   = `'${settings?.font_family || "Inter"}',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif`;
  const logoUrl      = settings?.logo_url || "";
  const appName      = settings?.app_name || "Savills Egypt CA";
  const tagline      = settings?.portal_tagline || "Client Accounting Portal";

  const API = import.meta.env.VITE_API_URL || "http://localhost:8001";

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.username, password: form.password }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || "Invalid credentials");

      if (d.otp_required) {
        setUserId(d.user_id);
        setOtpHint(d.message || "OTP sent to your email");
        setOtpStep(true);
      } else {
        // Direct login (no email)
        await login(form.username, form.password);
      }
    } catch (e) {
      setError(e.message || "Invalid username or password");
    } finally {
      setLoading(false);
    }
  };

  const handleOtp = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const res = await fetch(`${API}/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, otp_code: otpCode }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.detail || "Invalid OTP");
      // Store token and user
      localStorage.setItem("ca_token", d.token);
      window.location.reload();
    } catch (e) {
      setError(e.message || "Invalid or expired code");
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width:"100%", padding:"9px 12px", fontSize:13,
    border:"1px solid #C4CBD6", borderRadius:6, outline:"none",
    boxSizing:"border-box", fontFamily, color:"#1C1C1C", background:"#fff",
  };

  return (
    <div style={{
      minHeight:"100vh", background:"#F4F5F7",
      display:"flex", alignItems:"center", justifyContent:"center",
      fontFamily,
    }}>
      <div style={{
        background:"#fff", borderRadius:12, width:400,
        border:"1px solid #E3E8EF",
        boxShadow:"0 4px 24px rgba(0,0,0,0.08)",
        overflow:"hidden",
      }}>
        <div style={{height:4, background:accentColor}}/>

        <div style={{padding:"32px 36px 36px"}}>
          {/* Logo + App name */}
          <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:32}}>
            <div style={{
              width:48, height:48, borderRadius:10,
              background:accentColor, flexShrink:0,
              overflow:"hidden", border:"1px solid rgba(0,0,0,0.06)",
              display:"flex", alignItems:"center", justifyContent:"center",
            }}>
              {logoUrl && !logoError
                ? <img src={logoUrl} alt={appName}
                    style={{width:48,height:48,objectFit:"contain",display:"block"}}
                    onError={()=>setLogoError(true)}/>
                : <span style={{fontSize:22,fontWeight:900,color:"#111",fontFamily:"Georgia,serif"}}>
                    {appName?.[0]||"S"}
                  </span>
              }
            </div>
            <div>
              <div style={{fontSize:17,fontWeight:700,color:"#1C1C1C",letterSpacing:-0.3}}>{appName}</div>
              <div style={{fontSize:12,color:"#8C96A3",marginTop:1}}>{tagline}</div>
            </div>
          </div>

          {!otpStep ? (
            /* ── Step 1: Username + Password ── */
            <form onSubmit={handleSubmit}>
              <div style={{marginBottom:14}}>
                <label style={{display:"block",fontSize:12,color:"#57647A",marginBottom:5,fontWeight:500}}>Username</label>
                <input style={inputStyle} value={form.username}
                  onChange={e=>setForm(p=>({...p,username:e.target.value}))}
                  placeholder="first.last" required
                  onFocus={e=>e.target.style.borderColor=primaryColor}
                  onBlur={e=>e.target.style.borderColor="#C4CBD6"}/>
              </div>
              <div style={{marginBottom:22}}>
                <label style={{display:"block",fontSize:12,color:"#57647A",marginBottom:5,fontWeight:500}}>Password</label>
                <input type="password" style={inputStyle} value={form.password}
                  onChange={e=>setForm(p=>({...p,password:e.target.value}))}
                  required
                  onFocus={e=>e.target.style.borderColor=primaryColor}
                  onBlur={e=>e.target.style.borderColor="#C4CBD6"}/>
              </div>
              {error&&<div style={{marginBottom:16,padding:"9px 12px",borderRadius:6,background:"#FEF2F2",color:"#C80C0F",fontSize:13,border:"1px solid #FECACA"}}>{error}</div>}
              <button type="submit" disabled={loading} style={{
                width:"100%", padding:"11px",
                background:loading?"#6B7280":primaryColor,
                color:"#fff", border:"none", borderRadius:6,
                fontSize:13, fontWeight:600, cursor:loading?"not-allowed":"pointer",
                fontFamily, letterSpacing:0.2, transition:"background 0.15s",
              }}>
                {loading?"Signing in...":"Sign in"}
              </button>
            </form>
          ) : (
            /* ── Step 2: OTP ── */
            <form onSubmit={handleOtp}>
              <div style={{textAlign:"center",marginBottom:24}}>
                <div style={{fontSize:32,marginBottom:8}}>📧</div>
                <div style={{fontSize:14,fontWeight:600,color:"#1C1C1C",marginBottom:4}}>Check your email</div>
                <div style={{fontSize:12,color:"#8C96A3"}}>{otpHint}</div>
              </div>
              <div style={{marginBottom:22}}>
                <label style={{display:"block",fontSize:12,color:"#57647A",marginBottom:5,fontWeight:500}}>6-digit code</label>
                <input
                  style={{...inputStyle,fontSize:24,textAlign:"center",letterSpacing:8,fontWeight:700}}
                  value={otpCode}
                  onChange={e=>setOtpCode(e.target.value.replace(/\D/g,"").slice(0,6))}
                  placeholder="000000"
                  maxLength={6}
                  required
                  autoFocus
                  onFocus={e=>e.target.style.borderColor=primaryColor}
                  onBlur={e=>e.target.style.borderColor="#C4CBD6"}/>
              </div>
              {error&&<div style={{marginBottom:16,padding:"9px 12px",borderRadius:6,background:"#FEF2F2",color:"#C80C0F",fontSize:13,border:"1px solid #FECACA"}}>{error}</div>}
              <button type="submit" disabled={loading||otpCode.length<6} style={{
                width:"100%", padding:"11px",
                background:loading||otpCode.length<6?"#6B7280":primaryColor,
                color:"#fff", border:"none", borderRadius:6,
                fontSize:13, fontWeight:600,
                cursor:loading||otpCode.length<6?"not-allowed":"pointer",
                fontFamily, transition:"background 0.15s",
              }}>
                {loading?"Verifying...":"Verify & Sign in"}
              </button>
              <button type="button" onClick={()=>{setOtpStep(false);setOtpCode("");setError("");}} style={{
                width:"100%", marginTop:10, padding:"9px",
                background:"transparent", border:"1px solid #E3E8EF",
                borderRadius:6, fontSize:12, color:"#57647A", cursor:"pointer", fontFamily,
              }}>
                ← Back
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
