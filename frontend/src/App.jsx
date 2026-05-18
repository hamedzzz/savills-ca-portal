import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Portal from "./pages/Portal";

export default function App() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{minHeight:"100vh",background:"#f5f4f0",display:"flex",alignItems:"center",justifyContent:"center",color:"#888",fontSize:13}}>Loading...</div>;
  return user ? <Portal /> : <Login />;
}
