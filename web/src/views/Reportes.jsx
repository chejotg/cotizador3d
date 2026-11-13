import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase.js";
import { formatQ, hoyISO } from "../format.js";

const RUBROS = [
  ["material_q", "Material", "#2e7d32"],
  ["maquina_q", "Máquina", "#1565c0"],
  ["mano_obra_q", "Mano de obra", "#6a1b9a"],
  ["consumibles_q", "Consumibles", "#00695c"],
  ["acabado_q", "Acabado (pintado)", "#ef6c00"],
  ["embalaje_q", "Embalaje", "#546e7a"],
];

// genera los meses con su último día real (30, 31, 28/29 feb)
function mesesDisponibles() {
  const out = [];
  const hoy = new Date();
  for (let i = 0; i < 13; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth() + 1; // 1-indexed
    const ultimoDia = new Date(y, m, 0).getDate(); // día 0 del mes siguiente = último día del actual
    const mm = String(m).padStart(2, "0");
    const nombre = d.toLocaleDateString("es-GT", { month: "long", year: "numeric" });
    out.push({
      valor: `${y}-${mm}`,
      label: nombre.charAt(0).toUpperCase() + nombre.slice(1),
      desde: `${y}-${mm}-01`,
      hasta: `${y}-${mm}-${String(ultimoDia).padStart(2, "0")}`,
    });
  }
  return out;
}

export default function Reportes() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [modo, setModo] = useState("todo"); // 'todo' | 'mes' | 'rango'
  const [mesSel, setMesSel] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [cargando, setCargando] = useState(false);

  const meses = useMemo(() => mesesDisponibles(), []);

  // filtros activos según modo
  const filtros = useMemo(() => {
    if (modo === "mes") {
      const m = meses.find((mm) => mm.valor === mesSel);
      return m ? { desde: m.desde, hasta: m.hasta } : null;
    }
    if (modo === "rango" && desde && hasta) {
      return { desde, hasta };
    }
    return null;
  }, [modo, mesSel, desde, hasta, meses]);

  const cargar = async () => {
    setCargando(true);
    try {
      let query = supabase.from("desglose_ventas").select("*").order("fecha", { ascending: false });
      if (filtros) {
        query = query.gte("fecha", filtros.desde).lte("fecha", filtros.hasta);
      }
      const { data, error: err } = await query;
      if (err) throw err;
      setRows(data ?? []);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  useEffect(() => {
    if (filtros) cargar();
  }, [filtros?.desde, filtros?.hasta]);

  const totales = useMemo(() => {
    if (!rows) return null;
    const sum = (fn) => rows.reduce((s, r) => s + (Number(fn(r)) || 0), 0);
    return {
      ventas: rows.length,
      total: sum((r) => r.total_q),
      iva: sum((r) => r.iva_q),
      ...Object.fromEntries(RUBROS.map(([k]) => [k, sum((r) => r[k])])),
      costo: sum((r) => r.costo_total),
      margen: sum((r) => r.margen_real),
    };
  }, [rows]);

  if (error) return <div className="alerta-roja">{error}</div>;

  const periodoLabel =
    modo === "mes"
      ? meses.find((mm) => mm.valor === mesSel)?.label || ""
      : modo === "rango" && desde && hasta
        ? `${desde} → ${hasta}`
        : "Todos los períodos";

  return (
    <div>
      {/* Filtros */}
      <div className="bloque" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", gap: ".6rem", flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", gap: ".3rem", alignItems: "center", fontWeight: 700, fontSize: ".85rem" }}>
            <input type="radio" name="modo" checked={modo === "todo"} onChange={() => setModo("todo")} />
            Todo
          </label>
          <label style={{ display: "flex", gap: ".3rem", alignItems: "center", fontWeight: 700, fontSize: ".85rem" }}>
            <input type="radio" name="modo" checked={modo === "mes"} onChange={() => { setModo("mes"); }} />
            Por mes:
          </label>
          {modo === "mes" && (
            <select className="input-amarillo" style={{ maxWidth: 190 }} value={mesSel} onChange={(e) => setMesSel(e.target.value)}>
              {meses.map((m) => (
                <option key={m.valor} value={m.valor}>{m.label}</option>
              ))}
            </select>
          )}
          <label style={{ display: "flex", gap: ".3rem", alignItems: "center", fontWeight: 700, fontSize: ".85rem" }}>
            <input type="radio" name="modo" checked={modo === "rango"} onChange={() => setModo("rango")} />
            Rango:
          </label>
          {modo === "rango" && (
            <>
              <input className="input-amarillo" type="date" style={{ maxWidth: 140 }} value={desde} onChange={(e) => setDesde(e.target.value)} />
              <span className="muted">→</span>
              <input className="input-amarillo" type="date" style={{ maxWidth: 140 }} value={hasta} onChange={(e) => setHasta(e.target.value)} />
              {!desde || !hasta ? <span className="muted">elige ambas fechas</span> : null}
            </>
          )}
          {cargando && <span className="muted">cargando…</span>}
        </div>
        <div className="muted" style={{ marginTop: ".4rem" }}>
          Período: <strong>{periodoLabel}</strong>
          {totales && ` · ${totales.ventas} venta${totales.ventas !== 1 ? "s" : ""}`}
        </div>
      </div>

      {rows && totales && (
        <>
          <div className="stats-fila">
            <div className="stat-card"><div className="num">{totales.ventas}</div><div className="lbl">ventas</div></div>
            <div className="stat-card"><div className="num">{formatQ(totales.total)}</div><div className="lbl">total vendido</div></div>
            <div className="stat-card"><div className="num">{formatQ(totales.margen)}</div><div className="lbl">ganancia (margen real)</div></div>
            <div className="stat-card"><div className="num">{formatQ(totales.iva)}</div><div className="lbl">IVA (SAT)</div></div>
          </div>

          {/* Desglose por rubro */}
          <section className="bloque">
            <h2 className="seccion">DESGLOSE POR RUBRO — ¿cuánto de lo vendido se va en cada cosa?</h2>
            <table className="grid" style={{ marginTop: ".6rem" }}>
              <thead>
                <tr><th>Rubro</th><th>Monto</th><th>% del total</th><th style={{ width: "35%" }}></th></tr>
              </thead>
              <tbody>
                {RUBROS.map(([k, label, color]) => {
                  const v = totales[k];
                  const pct = totales.total > 0 ? ((v / totales.total) * 100).toFixed(1) : "0";
                  return (
                    <tr key={k}>
                      <td><strong style={{ color }}>{label}</strong></td>
                      <td>{formatQ(v)}</td>
                      <td>{pct}%</td>
                      <td>
                        <div style={{ background: "#e0e0e0", borderRadius: 4, height: 8, overflow: "hidden" }}>
                          <div style={{ background: color, width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 4 }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                <tr style={{ fontWeight: 800 }}>
                  <td>Subtotal costos de producción</td>
                  <td>{formatQ(totales.costo)}</td>
                  <td>{totales.total > 0 ? ((totales.costo / totales.total) * 100).toFixed(1) : 0}%</td>
                  <td></td>
                </tr>
                <tr className="extra-positivo" style={{ fontWeight: 800, fontSize: ".95rem" }}>
                  <td>💰 Margen / ganancia real</td>
                  <td>{formatQ(totales.margen)}</td>
                  <td>{totales.total > 0 ? ((totales.margen / totales.total) * 100).toFixed(1) : 0}%</td>
                  <td></td>
                </tr>
                {totales.iva > 0 && (
                  <tr style={{ color: "#9c0006", fontWeight: 700 }}>
                    <td>IVA (para SAT, no es tuyo)</td>
                    <td>{formatQ(totales.iva)}</td>
                    <td>{totales.total > 0 ? ((totales.iva / totales.total) * 100).toFixed(1) : 0}%</td>
                    <td></td>
                  </tr>
                )}
                <tr className="calc-fila total destacada" style={{ fontSize: "1rem" }}>
                  <td>TOTAL VENDIDO</td>
                  <td colSpan={2}>{formatQ(totales.total)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </section>

          {/* Desglose por venta */}
          <section className="bloque">
            <h2 className="seccion">DESGLOSE POR VENTA (detalle)</h2>
            <div style={{ overflowX: "auto" }}>
              <table className="grid">
                <thead>
                  <tr>
                    <th>Folio</th><th>Fecha</th><th>Cliente</th><th>Producto</th>
                    {RUBROS.map(([, l]) => <th key={l}>{l.split(" ")[0]}</th>)}
                    <th>Costo tot.</th><th>💰 Margen</th><th>Vendido</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.folio}>
                      <td><span className="chip-folio">{r.folio}</span></td>
                      <td style={{ whiteSpace: "nowrap" }}>{r.fecha}</td>
                      <td>{r.cliente}</td>
                      <td>{r.producto}</td>
                      {RUBROS.map(([k]) => <td key={k}>{formatQ(r[k])}</td>)}
                      <td>{formatQ(r.costo_total)}</td>
                      <td className={Number(r.margen_real) >= 0 ? "extra-positivo" : "extra-negativo"}>
                        <strong>{formatQ(r.margen_real)}</strong>
                      </td>
                      <td><strong>{formatQ(r.total_q)}</strong></td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr><td colSpan={12} className="muted">Sin ventas en este período.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
