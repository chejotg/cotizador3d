import { useEffect, useState } from "react";
import { AuthProvider, useAuth } from "./auth.jsx";
import Login from "./views/Login.jsx";
import Cotizador from "./views/Cotizador.jsx";
import Historial from "./views/Historial.jsx";
import Inventario from "./views/Inventario.jsx";
import POS from "./views/POS.jsx";
import Tarifas from "./views/Tarifas.jsx";
import Seguimiento from "./views/Seguimiento.jsx";
import Reportes from "./views/Reportes.jsx";

const TABS = [
  { id: "cotizador", label: "Cotizador", ico: "🧮" },
  { id: "historial", label: "Cotizaciones", ico: "📋" },
  { id: "inventario", label: "Inventario", ico: "📦" },
  { id: "pos", label: "Punto de venta", ico: "🛒" },
  { id: "tarifas", label: "Tarifas", ico: "⚙️" },
  { id: "pedidos", label: "Pedidos", ico: "🚚" },
  { id: "reportes", label: "Reportes", ico: "📊" },
];

// el tab vive en el hash SIN los parámetros (ej. '#/cotizador?edit=COT-019')
function parseTabFromHash() {
  const h = (window.location.hash || "#/cotizador").replace("#/", "").split("?")[0];
  return TABS.some((t) => t.id === h) ? h : "cotizador";
}

function useTab() {
  const [tab, setTab] = useState(() => parseTabFromHash());
  useEffect(() => {
    const onHash = () => setTab(parseTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (id) => {
    window.location.hash = `#/${id}`;
    setTab(id);
  };
  return [tab, go];
}

function Shell() {
  const { session, loading, user, signOut } = useAuth();
  const [tab, go] = useTab();
  const [offline, setOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  if (loading) return <div className="cargando">Cargando…</div>;
  if (!session) return <Login />;

  return (
    <div className="shell">
      <header className="header">
        <div className="marca">COTIZADOR 3D</div>
        <nav className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? "activo" : ""}`}
              onClick={() => go(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <div className="sesion">
          <span className="muted">{user?.email}</span>
          <button className="btn-salir" onClick={() => signOut()}>
            Salir
          </button>
        </div>
      </header>
      {offline && (
        <div className="banner-offline">
          Sin conexión: el formulario conserva sus datos — al reconectar puedes guardar.
        </div>
      )}
      <main className="contenido">
        {tab === "cotizador" && <Cotizador />}
        {tab === "historial" && <Historial />}
        {tab === "inventario" && <Inventario />}
        {tab === "pos" && <POS />}
        {tab === "tarifas" && <Tarifas />}
        {tab === "pedidos" && <Seguimiento />}
        {tab === "reportes" && <Reportes />}
      </main>
      <nav className="nav-movil">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "activo" : ""}
            onClick={() => go(t.id)}
          >
            <span className="ico">{t.ico}</span>
            {t.label}
          </button>
        ))}
      </nav>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Shell />
    </AuthProvider>
  );
}




