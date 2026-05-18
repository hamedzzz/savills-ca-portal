import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try { await login(form.username, form.password); }
    catch (e) { setError("Invalid username or password"); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",background:"#f5f4f0",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{background:"#fff",borderRadius:16,padding:"2.5rem",width:380,border:"0.5px solid #e0e0e0",boxShadow:"0 4px 24px rgba(0,0,0,0.06)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:"2rem"}}>
          <div style={{width:40,height:40,background:"#F5B800",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <span style={{fontSize:20,fontWeight:700,color:"#111"}}>S</span>
          </div>
          <div>
            <div style={{fontSize:16,fontWeight:600,color:"#111"}}>Savills Egypt</div>
            <div style={{fontSize:12,color:"#888"}}>Client Accounting Portal</div>
          </div>
        </div>
        <form onSubmit={handleSubmit}>
          <div style={{marginBottom:12}}>
            <label style={{display:"block",fontSize:12,color:"#666",marginBottom:4,fontWeight:500}}>Username</label>
            <input style={{width:"100%",padding:"10px 12px",fontSize:13,border:"0.5px solid #ccc",borderRadius:8,outline:"none",boxSizing:"border-box"}} value={form.username} onChange={e=>setForm(p=>({...p,username:e.target.value}))} placeholder="ahmed.hamed" required/>
          </div>
          <div style={{marginBottom:"1.5rem"}}>
            <label style={{display:"block",fontSize:12,color:"#666",marginBottom:4,fontWeight:500}}>Password</label>
            <input type="password" style={{width:"100%",padding:"10px 12px",fontSize:13,border:"0.5px solid #ccc",borderRadius:8,outline:"none",boxSizing:"border-box"}} value={form.password} onChange={e=>setForm(p=>({...p,password:e.target.value}))} required/>
          </div>
          {error&&<div style={{marginBottom:12,padding:"8px 12px",borderRadius:8,background:"#FCEBEB",color:"#A32D2D",fontSize:13}}>{error}</div>}
          <button type="submit" disabled={loading} style={{width:"100%",padding:"10px",background:"#111",color:"#fff",border:"none",borderRadius:8,fontSize:13,fontWeight:500,cursor:"pointer"}}>
            {loading?"Signing in...":"Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
