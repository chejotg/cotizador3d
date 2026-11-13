import { useEffect, useState } from "react";
import { fetchPedidos, actualizarPedido, eliminarPedido } from "../services/pedidos.js";
import { formatQ } from "../format.js";

const ESTADOS_PEDIDO = ["Nuevo", "Preparando", "Enviado", "Entregado", "Cancelado"];
const METODOS_ENVIO = ["Entrega en mano", "Guatex", "Cargoocca", "Otro"];
const BADGE = {
  Nuevo: "badge-emitida",
  Preparando: "badge-confirmada",
  Enviado: "badge-entregada",
  Entregado: "badge-confirmada",
  Cancelado: "badge-cancelada",
};

export default function Seguimiento() {
  const [pedidos, setPedidos] = useState(null);
  const [filtro, setFiltro] = useState("");
  const [busca, setBusca] = useState("");
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null); // pedido abierto en modal

  const cargar = () => fetchPedidos().then(setPedidos).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
  }, []);

  const visibles = (pedidos ?? []).filter((p) => {
    const okE = !filtro || p.estado_pedido === filtro;
    const q = busca.trim().toLowerCase();
    const okQ =
      !q ||
      (p.folio || "").toLowerCase().includes(q) ||
      (p.cliente || "").toLowerCase().includes(q) ||
      (p.producto || "").toLowerCase().includes(q);
    return okE && okQ;
  });

  const pendientes = (pedidos ?? []).filter(
    (p) => p.estado_pedido !== "Entregado" && p.estado_pedido !== "Cancelado"
  ).length;

  async function eliminar(folio) {
    if (!confirm(`¿ELIMINAR ${folio}? Las piezas vendidas vuelven al inventario y no queda registro.`)) return;
    try {
      await eliminarPedido(folio);
      setModal(null);
      cargar();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  async function cambiarEstado(folio, estado) {
    try {
      await actualizarPedido(folio, { estadoPedido: estado });
      cargar();
    } catch (e) {
      setError(e.message || String(e));
    }
  }

  return (
    <div>
      {error && <div className="alerta-roja" style={{ marginBottom: "1rem" }}>{error}</div>}
      <div className="stats-fila">
        <div className="stat-card"><div className="num">{pedidos?.length ?? "—"}</div><div className="lbl">pedidos totales</div></div>
        <div className="stat-card"><div className="num">{pendientes}</div><div className="lbl">pendientes</div></div>
      </div>
      <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", marginBottom: ".9rem" }}>
        <input
          className="input-amarillo"
          style={{ maxWidth: 280 }}
          placeholder="Buscar folio, cliente, producto…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <select
          className="input-amarillo"
          style={{ maxWidth: 180 }}
          value={filtro}
          onChange={(e) => setFiltro(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {ESTADOS_PEDIDO.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Tabla desktop (solo lectura, click abre modal) */}
      <div className="table-wrap table-solo-desk">
        <table className="grid">
          <thead>
            <tr>
              <th>Folio</th><th>Fecha</th><th>Cliente</th><th>Contacto</th><th>Producto</th>
              <th>TOTAL</th><th>Estado</th><th>Envío</th><th>Tracking</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((p) => (
              <tr
                key={p.folio}
                style={{ cursor: "pointer" }}
                onClick={() => setModal(p)}
              >
                <td><span className="chip-folio">{p.folio}</span></td>
                <td style={{ whiteSpace: "nowrap" }}>{p.fecha}</td>
                <td>
                  <strong>{p.cliente}</strong>
                  {p.cliente_direccion && <div className="muted" style={{ fontSize: ".72rem" }}>{p.cliente_direccion}</div>}
                </td>
                <td>{p.cliente_telefono || "—"}</td>
                <td>{p.producto} × {p.cantidad}</td>
                <td><strong>{formatQ(p.total_q)}</strong></td>
                <td><span className={`badge ${BADGE[p.estado_pedido] || "badge-emitida"}`}>{p.estado_pedido}</span></td>
                <td>{p.metodo_envio || "—"}</td>
                <td>{p.tracking || "—"}</td>
              </tr>
            ))}
            {pedidos && visibles.length === 0 && (
              <tr><td colSpan={9} className="muted">Sin pedidos para este filtro.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Tarjetas móvil (solo lectura, click abre modal) */}
      <div className="cards-movil">
        {visibles.map((p) => (
          <div
            className="card-cot"
            key={p.folio}
            style={{ cursor: "pointer" }}
            onClick={() => setModal(p)}
          >
            <div className="titulo">
              <span className="chip-folio">{p.folio}</span>
              <span className={`badge ${BADGE[p.estado_pedido] || "badge-emitida"}`}>{p.estado_pedido}</span>
            </div>
            <div className="fila"><span className="muted">Cliente</span><strong>{p.cliente}</strong></div>
            {p.cliente_direccion && <div className="fila"><span className="muted">Dirección</span><span>{p.cliente_direccion}</span></div>}
            {p.cliente_telefono && <div className="fila"><span className="muted">Teléfono</span><span>{p.cliente_telefono}</span></div>}
            <div className="fila"><span className="muted">Producto</span><span>{p.producto} × {p.cantidad}</span></div>
            <div className="fila total"><span>TOTAL</span><span>{formatQ(p.total_q)}</span></div>
          </div>
        ))}
        {pedidos && visibles.length === 0 && (
          <div className="card-cot muted">Sin pedidos para este filtro.</div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <PedidoModal
          pedido={modal}
          onClose={() => setModal(null)}
          onGuardar={async (patch) => {
            try {
              await actualizarPedido(modal.folio, patch);
              setModal(null);
              cargar();
            } catch (e) {
              setError(e.message || String(e));
            }
          }}
          onEliminar={() => eliminar(modal.folio)}
        />
      )}
    </div>
  );
}

function PedidoModal({ pedido: p, onClose, onGuardar, onEliminar }) {
  const [form, setForm] = useState({
    cliente: p.cliente || "",
    direccion: p.cliente_direccion || "",
    telefono: p.cliente_telefono || "",
    estadoPedido: p.estado_pedido || "Nuevo",
    metodoEnvio: p.metodo_envio || "",
    costoEnvio: p.costo_envio != null ? String(p.costo_envio) : "",
    tracking: p.tracking || "",
    notas: p.notas || "",
  });
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState("");

  function set(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  return (
    <div
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
        display: "grid", placeItems: "center", zIndex: 100, padding: "1rem",
      }}
    >
      <div
        className="modal-content"
        style={{
          background: "#fff", borderRadius: 14, boxShadow: "0 8px 40px rgba(0,0,0,.2)",
          width: "min(94vw, 560px)", maxHeight: "92vh", overflowY: "auto", padding: "1.4rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <span className="chip-folio" style={{ fontSize: "1rem" }}>{p.folio}</span>
          <span className={`badge ${BADGE[p.estado_pedido] || "badge-emitida"}`}>{p.estado_pedido}</span>
          <button className="btn-salir" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: "grid", gap: ".55rem" }}>
          <div className="input-dos">
            <label className="input-label">
              Fecha
              <input className="input-plano" value={p.fecha} disabled readOnly />
            </label>
            <label className="input-label">
              Producto
              <input className="input-plano" value={`${p.producto} × ${p.cantidad}`} disabled readOnly />
            </label>
          </div>
          <div className="input-dos">
            <label className="input-label">
              TOTAL
              <input className="input-plano" value={formatQ(p.total_q)} disabled readOnly style={{ fontWeight: 800, color: "var(--verde-texto)" }} />
            </label>
            <label className="input-label">
              Factura
              <input className="input-plano" value={p.factura ? "Sí (con factura)" : "No"} disabled readOnly />
            </label>
          </div>

          <h4 style={{ margin: ".3rem 0 .2rem", color: "var(--azul)" }}>Datos del cliente</h4>
          <label className="input-label">
            Nombre
            <input className="input-amarillo" value={form.cliente} onChange={(e) => set("cliente", e.target.value)} />
          </label>
          <label className="input-label">
            Dirección
            <input className="input-amarillo" value={form.direccion} onChange={(e) => set("direccion", e.target.value)} />
          </label>
          <label className="input-label">
            Teléfono
            <input className="input-amarillo" value={form.telefono} onChange={(e) => set("telefono", e.target.value)} />
          </label>

          <h4 style={{ margin: ".3rem 0 .2rem", color: "var(--azul)" }}>Estado y envío</h4>
          <div className="input-dos">
            <label className="input-label">
              Estado del pedido
              <select className="input-amarillo" value={form.estadoPedido} onChange={(e) => set("estadoPedido", e.target.value)}>
                {ESTADOS_PEDIDO.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
            <label className="input-label">
              Método de envío
              <select className="input-amarillo" value={form.metodoEnvio} onChange={(e) => set("metodoEnvio", e.target.value)}>
                <option value="">— envío —</option>
                {METODOS_ENVIO.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="input-dos">
            <label className="input-label">
              Costo de envío (Q)
              <input
                className="input-amarillo"
                type="number"
                step="0.01"
                min={0}
                value={form.costoEnvio}
                onChange={(e) => set("costoEnvio", e.target.value)}
              />
            </label>
            <label className="input-label">
              Tracking
              <input className="input-amarillo" value={form.tracking} onChange={(e) => set("tracking", e.target.value)} />
            </label>
          </div>
          <label className="input-label">
            Observaciones
            <textarea
              className="input-amarillo"
              style={{ minHeight: 56, resize: "vertical" }}
              value={form.notas}
              onChange={(e) => set("notas", e.target.value)}
            />
          </label>

          {err && <div className="alerta-roja">{err}</div>}
          <div style={{ display: "flex", gap: ".5rem", marginTop: ".5rem" }}>
            <button
              className="btn-primario"
              style={{ flex: 1 }}
              disabled={guardando}
              onClick={async () => {
                setGuardando(true);
                setErr("");
                await onGuardar(form);
                setGuardando(false);
              }}
            >
              {guardando ? "Guardando…" : "💾 GUARDAR CAMBIOS"}
            </button>
            <button
              className="btn-peligro"
              onClick={() => {
                if (confirm(`¿ELIMINAR ${p.folio}? Las piezas vendidas vuelven al inventario y no queda registro.`)) {
                  onEliminar();
                }
              }}
            >
              🗑
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

