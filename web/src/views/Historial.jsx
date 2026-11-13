import { useEffect, useMemo, useRef, useState } from "react";
import {
  listarCotizaciones,
  extraGanado,
  fijarPrecioVenta,
  cambiarEstado,
  eliminarCotizacion,
} from "../services/cotizaciones.js";
import { formatQ } from "../format.js";

const BADGES = {
  Emitida: "badge-emitida",
  Confirmada: "badge-confirmada",
  Entregada: "badge-entregada",
  Cancelada: "badge-cancelada",
};

const ESTADOS = ["Emitida", "Confirmada", "Entregada", "Cancelada"];

// editar: solo pasa el FOLIO por la URL; el Cotizador lee TODO de la base
function editarFila(folio) {
  window.location.hash = `#/cotizador?edit=${encodeURIComponent(folio)}`;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

const medicion = (r) =>
  `${r.tipo} · ${r.impresora} · ${Number(r.gramos)} g · ${Number(r.horas_impresion)} h imp · ${Number(r.horas_mo)} h MO`;

function badgeBandeja(r) {
  if (!r.es_bandeja) return null;
  return (
    <span className="badge badge-confirmada" style={{ marginLeft: ".3rem" }}>
      {r.metodo_cobro === "unidad" && r.precio_venta_unidad
        ? `BANDEJA · UNIDAD ${formatQ(r.precio_venta_unidad)}`
        : "BANDEJA · TOTAL"}
    </span>
  );
}

export default function Historial() {
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState("");
  const [error, setError] = useState("");
  const searchRef = useRef(null);

  const cargar = () => listarCotizaciones().then(setRows).catch((e) => setError(e.message));
  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (
        e.key === "/" &&
        !["INPUT", "SELECT", "TEXTAREA"].includes(document.activeElement?.tagName)
      ) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtradas = useMemo(() => {
    if (!rows) return [];
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      const okQ =
        !q ||
        (r.folio || "").toLowerCase().includes(q) ||
        (r.producto || "").toLowerCase().includes(q) ||
        (r.cliente || "").toLowerCase().includes(q);
      const okE = !estado || r.estado === estado;
      return okQ && okE;
    });
  }, [rows, query, estado]);

  const stats = useMemo(() => {
    const visibles = filtradas.filter((r) => r.estado !== "Cancelada");
    const sum = (fn) => visibles.reduce((s, r) => s + Number(fn(r) || 0), 0);
    return {
      total: visibles.length,
      sinIva: redondeo(sum((r) => r.total_sin_iva_q)),
      conIva: redondeo(sum((r) => r.con_factura_q)),
      extra: redondeo(filtradas.reduce((s, r) => s + (extraGanado(r) || 0), 0)),
    };
  }, [filtradas]);

  async function onPrecio(folio, valor, backup) {
    if (valor === "") {
      setRows((rs) => rs.map((r) => (r.folio === folio ? backup : r)));
      return;
    }
    try {
      await fijarPrecioVenta(folio, valor);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function onEstado(folio, nuevo) {
    try {
      await cambiarEstado(folio, nuevo);
      setRows((rs) => rs.map((r) => (r.folio === folio ? { ...r, estado: nuevo } : r)));
    } catch (e) {
      setError(e.message);
    }
  }

  async function onEliminar(r) {
    const ok = confirm(
      `¿Eliminar ${r.folio} (${r.producto})?\n\nSi es una bandeja, sus piezas desaparecen también.\n` +
        "No se puede eliminar si ya tiene unidades vendidas."
    );
    if (!ok) return;
    try {
      await eliminarCotizacion(r.folio);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div>
      {error && <div className="alerta-roja" style={{ marginBottom: "1rem" }}>{error}</div>}
      <div className="stats-fila">
        <div className="stat-card"><div className="num">{stats.total}</div><div className="lbl">cotizaciones</div></div>
        <div className="stat-card"><div className="num">{formatQ(stats.sinIva)}</div><div className="lbl">total sin IVA</div></div>
        <div className="stat-card"><div className="num">{formatQ(stats.conIva)}</div><div className="lbl">total con factura</div></div>
        <div className="stat-card"><div className="num">{formatQ(stats.extra)}</div><div className="lbl">extra ganado</div></div>
      </div>
      <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", marginBottom: ".9rem" }}>
        <input
          ref={searchRef}
          className="input-amarillo"
          style={{ maxWidth: 320 }}
          placeholder='Buscar folio, producto, cliente… (tecla "/")'
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          className="input-amarillo"
          style={{ maxWidth: 180 }}
          value={estado}
          onChange={(e) => setEstado(e.target.value)}
        >
          <option value="">Todos los estados</option>
          {ESTADOS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        {query && (
          <button className="btn-mini" onClick={() => setQuery("")}>✕ limpiar</button>
        )}
      </div>

      {/* Tabla desktop (condensada) */}
      <div className="table-wrap table-solo-desk">
        <table className="grid">
          <thead>
            <tr>
              <th>Folio</th><th>Fecha</th><th>Producto y medición</th>
              <th>Estado</th><th>TOTAL</th><th>Precio venta</th><th>Extra</th><th></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((r) => {
              const extra = extraGanado(r);
              const base = r.factura ? Number(r.con_factura_q) : Number(r.total_sin_iva_q);
              const precio = r.precio_venta_final != null ? Number(r.precio_venta_final) : base;
              return (
                <tr key={r.folio}>
                  <td><span className="chip-folio">{r.folio}</span></td>
                  <td style={{ whiteSpace: "nowrap" }}>{r.fecha}</td>
                  <td>
                    <strong>{r.producto}</strong>{badgeBandeja(r)}
                    <div className="muted" style={{ fontSize: ".74rem" }}>
                      {r.cliente} · {medicion(r)}
                      {r.hist_total_previo ? ` · anterior: ${formatQ(r.hist_total_previo)}` : ""}
                    </div>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: ".3rem", alignItems: "center" }}>
                      <span className={`badge ${BADGES[r.estado]}`}>{r.estado}</span>
                      <select
                        aria-label="Cambiar estado"
                        value={r.estado}
                        onChange={(e) => onEstado(r.folio, e.target.value)}
                      >
                        {ESTADOS.map((s) => (
                          <option key={s} value={s}>{s}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td>
                    <strong>{formatQ(base)}</strong>
                    {r.factura && <div className="muted" style={{ fontSize: ".7rem" }}>con factura</div>}
                  </td>
                  <td>
                    <input
                      className={r.factura ? "input-plano" : "input-amarillo"}
                      type="number"
                      step="0.01"
                      style={{ width: 95 }}
                      value={precio}
                      onChange={(e) => onPrecio(r.folio, e.target.value, r)}
                    />
                  </td>
                  <td className={extra >= 0 ? "extra-positivo" : "extra-negativo"}>{formatQ(extra)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn-mini" onClick={() => editarFila(r.folio)}>
                      ✎ Editar
                    </button>
                    <button
                      className="btn-peligro"
                      style={{ padding: ".25rem .55rem", fontSize: ".75rem", marginLeft: ".3rem" }}
                      onClick={() => onEliminar(r)}
                    >
                      🗑
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Tarjetas móvil */}
      <div className="cards-movil">
        {filtradas.map((r) => {
          const extra = extraGanado(r);
          const base = r.factura ? Number(r.con_factura_q) : Number(r.total_sin_iva_q);
          const precio = r.precio_venta_final != null ? Number(r.precio_venta_final) : base;
          return (
            <div className="card-cot" key={r.folio}>
              <div className="titulo">
                <span className="chip-folio">{r.folio}</span>
                <span className={`badge ${BADGES[r.estado]}`}>{r.estado}</span>
              </div>
              <div className="fila">
                <span className="muted">Producto</span>
                <span><strong>{r.producto}</strong>{badgeBandeja(r)}</span>
              </div>
              <div className="fila">
                <span className="muted">Cliente / fecha</span>
                <span>{r.cliente} · {r.fecha}</span>
              </div>
              <div className="fila">
                <span className="muted">Medición</span>
                <span>{r.tipo} · {Number(r.gramos)} g · {Number(r.horas_impresion)} h</span>
              </div>
              {r.hist_total_previo && (
                <div className="fila">
                  <span className="muted">Anterior</span>
                  <span>{formatQ(r.hist_total_previo)}</span>
                </div>
              )}
              <div className="fila total">
                <span>TOTAL {r.factura ? "(con factura)" : "sin IVA"}</span>
                <span>{formatQ(base)}</span>
              </div>
              <div className="fila">
                <span className="muted">Precio venta</span>
                <input
                  className={r.factura ? "input-plano" : "input-amarillo"}
                  type="number"
                  step="0.01"
                  style={{ width: 110, fontWeight: 700 }}
                  value={precio}
                  onChange={(e) => onPrecio(r.folio, e.target.value, r)}
                />
              </div>
              <div className="fila">
                <span className="muted">Extra ganado</span>
                <span className={extra >= 0 ? "extra-positivo" : "extra-negativo"}>{formatQ(extra)}</span>
              </div>
              <div style={{ display: "flex", gap: ".5rem", marginTop: ".6rem" }}>
                <button className="btn-mini" onClick={() => editarFila(r.folio)}>✎ Editar</button>
                <button
                  className="btn-peligro"
                  style={{ padding: ".3rem .6rem", fontSize: ".78rem" }}
                  onClick={() => onEliminar(r)}
                >
                  🗑 Eliminar
                </button>
                <select
                  className="input-plano"
                  style={{ maxWidth: 150 }}
                  value={r.estado}
                  onChange={(e) => onEstado(r.folio, e.target.value)}
                >
                  {ESTADOS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            </div>
          );
        })}
        {rows && filtradas.length === 0 && (
          <div className="card-cot muted">Sin resultados para la búsqueda.</div>
        )}
      </div>
    </div>
  );
}

function redondeo(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}





