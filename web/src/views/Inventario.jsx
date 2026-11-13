import { useEffect, useState } from "react";
import { supabase } from "../services/supabase.js";
import { fetchSaldosMaterial } from "../services/cotizaciones.js";
import { updateMaterialCosto, crearMaterial, eliminarMaterial } from "../services/materiales.js";
import { fetchPiezasBandeja, updatePiezaStock } from "../services/bandejas.js";
import { hoyISO } from "../format.js";

function NuevoMaterialForm({ onCrear }) {
  const [nombre, setNombre] = useState("");
  const [tipo, setTipo] = useState("");
  const [costo, setCosto] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim() || !tipo || costo === "") return;
    onCrear({
      nombre,
      unidad: "g",
      descontablePor: tipo,
      costoQg: costo,
      stockInicial: 0,
      minimo: 0,
    });
    setNombre("");
    setTipo("");
    setCosto("");
  }

  return (
    <form onSubmit={submit} className="input-dos" style={{ marginBottom: ".8rem" }}>
      <input
        className="input-amarillo"
        placeholder="Nombre (p. ej. PLA+ eSUN)"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
      />
      <select className="input-amarillo" value={tipo} onChange={(e) => setTipo(e.target.value)}>
        <option value="">— tipo —</option>
        <option value="pla">PLA</option>
        <option value="resina">Resina</option>
      </select>
      <input
        className="input-amarillo"
        type="number"
        step="0.0001"
        min={0}
        placeholder="Q/g"
        value={costo}
        onChange={(e) => setCosto(e.target.value)}
      />
      <button className="btn-primario" type="submit" disabled={!nombre || !tipo || costo === ""}>
        + Agregar
      </button>
    </form>
  );
}

// Inventario unificado:
//  · materiales → saldo_material (descuento automático por cotizaciones)
//  · piezas de bandejas → piezas_bandeja (disponibles = cantidad + extra − vendidas)
//  · producción de catálogo → movimiento_producto (productos de venta directa, sin bandeja)
export default function Inventario() {
  const [materiales, setMateriales] = useState(null);
  const [piezasStock, setPiezasStock] = useState(null);
  const [productos, setProductos] = useState(null);
  const [consumo, setConsumo] = useState(null);
  const [movMat, setMovMat] = useState(null);
  const [movProd, setMovProd] = useState(null);
  const [nuevoMov, setNuevoMov] = useState({ fecha: hoyISO(), material: "", entrada: null, salida: null, nota: "" });
  const [nuevaProd, setNuevaProd] = useState({ fecha: hoyISO(), producto: "", piezas: 1 });
  const [error, setError] = useState("");

  const cargar = async () => {
    try {
      const [m, pzs, p, c, mm, mp] = await Promise.all([
        fetchSaldosMaterial(),
        fetchPiezasBandeja().catch(() => []),
        supabase.from("saldo_producto").select("*").then(({ data, error }) => { if (error) throw error; return data; }),
        supabase
          .from("cotizacion")
          .select("folio,producto,tipo,bandejas,gramos")
          .order("folio")
          .then(({ data, error }) => { if (error) throw error; return data; }),
        supabase
          .from("movimiento_material")
          .select("*")
          .order("fecha", { ascending: false })
          .order("id", { ascending: false })
          .then(({ data, error }) => { if (error) throw error; return data; }),
        supabase
          .from("movimiento_producto")
          .select("*")
          .order("fecha", { ascending: false })
          .order("id", { ascending: false })
          .then(({ data, error }) => { if (error) throw error; return data; }),
      ]);
      setMateriales(m ?? []);
      setPiezasStock(pzs ?? []);
      setProductos(p ?? []);
      setConsumo(c ?? []);
      setMovMat(mm ?? []);
      setMovProd(mp ?? []);
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  async function guardarCostoMaterial(nombre, valor) {
    try {
      await updateMaterialCosto(nombre, valor);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  async function updateMaterial(nombre, actualizar) {
    const { error: err } = await supabase.from("material").update(actualizar).eq("nombre", nombre);
    if (err) setError(err.message);
    else cargar();
  }
  async function updateProducto(nombre, actualizar) {
    const { error: err } = await supabase.from("producto").update(actualizar).eq("nombre", nombre);
    if (err) setError(err.message);
    else cargar();
  }

  async function guardarMovMaterial(e) {
    e.preventDefault();
    const { error: err } = await supabase.from("movimiento_material").insert({
      fecha: nuevoMov.fecha,
      material: nuevoMov.material,
      entrada: Number(nuevoMov.entrada) || 0,
      salida: Number(nuevoMov.salida) || 0,
      nota: nuevoMov.nota || null,
    });
    if (err) setError(err.message);
    else {
      setNuevoMov((m) => ({ ...m, material: "", entrada: null, salida: null, nota: "" }));
      cargar();
    }
  }

  async function guardarProduccion(e) {
    e.preventDefault();
    const { error: err } = await supabase.from("movimiento_producto").insert({
      fecha: nuevaProd.fecha,
      producto: nuevaProd.producto,
      entrada: Number(nuevaProd.piezas) || 0,
      salida: 0,
      nota: "producido",
    });
    if (err) setError(err.message);
    else {
      setNuevaProd((m) => ({ ...m, producto: "", piezas: 1 }));
      cargar();
    }
  }

  const enReposicionMat = (materiales ?? []).filter((m) => m.alerta === "REPOSICION").length;
  const enReposicionPz = (piezasStock ?? []).filter(
    (p) => p.estado === "Confirmada" && Number(p.disponibles) <= Number(p.minimo) && Number(p.minimo) > 0
  ).length;
  const nivelesCta = enReposicionMat + enReposicionPz;

  return (
    <div>
      {error && <div className="alerta-roja" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="stats-fila">
        <div className="stat-card"><div className="num">{materiales?.length ?? "—"}</div><div className="lbl">materiales</div></div>
        <div className="stat-card"><div className="num">{piezasStock?.length ?? "—"}</div><div className="lbl">piezas · bandejas</div></div>
        <div className={`stat-card ${nivelesCta > 0 ? "alerta" : ""}`}>
          <div className="num">{nivelesCta}</div><div className="lbl">en reposición</div>
        </div>
      </div>

      <details className="accordion" open>
        <summary>
          🧱 MATERIALES <span className="muted">saldo = inicial + entradas − consumo por cotizaciones − salidas</span>
        </summary>
        <div className="accordion-body">
          <NuevoMaterialForm onCrear={(m) => { crearMaterial(m).then(cargar).catch((e) => setError(e.message)); }} />
          <table className="grid">
            <thead>
              <tr>
                <th>Ítem</th><th>Unidad</th><th>Costo Q/g</th><th>Stock inicial</th><th>Mínimo</th><th>Saldo</th><th>Alerta</th>
              </tr>
            </thead>
            <tbody>
              {(materiales ?? []).map((m) => (
                <tr key={m.nombre}>
                  <td><strong>{m.nombre}</strong>{m.descontable_por && <div className="muted" style={{ fontSize: ".68rem" }}>{m.descontable_por === "pla" ? "PLA" : m.descontable_por === "resina" ? "Resina" : ""}</div>}</td>
                  <td>{m.unidad}</td>
                  <td>
                    <input
                      className="input-amarillo"
                      type="number"
                      step="0.0001"
                      style={{ width: 85 }}
                      defaultValue={Number(m.costo_qg) || 0}
                      onBlur={(e) => guardarCostoMaterial(m.nombre, e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      className="input-amarillo"
                      type="number"
                      step="0.01"
                      style={{ width: 95 }}
                      defaultValue={Number(m.stock_inicial) || 0}
                      onBlur={(e) => updateMaterial(m.nombre, { stock_inicial: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      className="input-amarillo"
                      type="number"
                      step="0.01"
                      style={{ width: 90 }}
                      defaultValue={Number(m.minimo) || 0}
                      onBlur={(e) => updateMaterial(m.nombre, { minimo: Number(e.target.value) || 0 })}
                    />
                  </td>
                  <td className={Number(m.saldo) < 0 ? "saldo-neg" : ""}>{m.saldo}</td>
                  <td>
                    {m.alerta === "REPOSICION"
                      ? <span className="badge badge-reposicion">REPOSICIÓN</span>
                      : <span className="muted">ok</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="accordion" open>
        <summary>
          🧩 PIEZAS DE BANDEJAS <span className="muted">disponibles = en bandeja + extra − vendidas · usa los botones +/− para ajustar stock</span>
        </summary>
        <div className="accordion-body">
          <table className="grid">
            <thead>
              <tr>
                <th>Folio</th><th>Pieza</th><th>Vendidas</th>
                <th>Disponibles</th><th style={{ width: 150 }}>Ajustar stock</th>
                <th>Mínimo</th><th>Alerta</th>
              </tr>
            </thead>
            <tbody>
              {(piezasStock ?? []).map((p) => (
                <PiezaStockRow key={p.id} pieza={p} onGuardar={async (id, patch) => {
                  await updatePiezaStock(id, patch);
                  cargar();
                }} />
              ))}
            </tbody>
          </table>
          <p className="muted" style={{ marginTop: ".5rem" }}>
            💡 Para agregar o quitar piezas: escribe la cantidad en el campo y presiona <strong>+</strong> o <strong>−</strong>.
            Las ventas del POS descontan disponibles solas.
          </p>
        </div>
      </details>

      <details className="accordion">
        <summary>📥 PRODUCCIÓN / ENTRADAS DE CATÁLOGO <span className="muted">productos de venta directa (no piezas de bandejas)</span></summary>
        <div className="accordion-body">
          <form
            onSubmit={guardarProduccion}
            style={{ display: "grid", gridTemplateColumns: "130px 1fr 90px auto", gap: ".5rem", margin: ".4rem 0 .9rem" }}
          >
            <input
              className="input-plano"
              type="date"
              value={nuevaProd.fecha}
              onChange={(e) => setNuevaProd((m) => ({ ...m, fecha: e.target.value }))}
            />
            <select
              className="input-amarillo"
              required
              value={nuevaProd.producto}
              onChange={(e) => setNuevaProd((m) => ({ ...m, producto: e.target.value }))}
            >
              <option value="">— producto —</option>
              {(productos ?? []).map((p) => (
                <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
              ))}
            </select>
            <input
              className="input-amarillo"
              type="number"
              min={1}
              value={nuevaProd.piezas}
              onChange={(e) => setNuevaProd((m) => ({ ...m, piezas: Number(e.target.value) }))}
            />
            <button className="btn-primario" type="submit">REGISTRAR</button>
          </form>
          <table className="grid">
            <thead>
              <tr><th>Fecha</th><th>Producto</th><th>Piezas</th></tr>
            </thead>
            <tbody>
              {(movProd ?? [])
                .filter((m) => Number(m.entrada) > 0)
                .slice(0, 25)
                .map((m) => (
                  <tr key={m.id}>
                    <td>{m.fecha}</td><td>{m.producto}</td><td>{m.entrada}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="accordion">
        <summary>🔁 MOVIMIENTOS DE MATERIAL <span className="muted">compras, consumos manuales</span></summary>
        <div className="accordion-body">
          <form
            onSubmit={guardarMovMaterial}
            style={{ display: "grid", gridTemplateColumns: "130px 1fr 90px 90px 1fr auto", gap: ".5rem", margin: ".4rem 0 .9rem" }}
          >
            <input
              className="input-plano"
              type="date"
              value={nuevoMov.fecha}
              onChange={(e) => setNuevoMov((m) => ({ ...m, fecha: e.target.value }))}
            />
            <select
              className="input-amarillo"
              required
              value={nuevoMov.material}
              onChange={(e) => setNuevoMov((m) => ({ ...m, material: e.target.value }))}
            >
              <option value="">— ítem —</option>
              {(materiales ?? []).map((m) => (
                <option key={m.nombre} value={m.nombre}>{m.nombre}</option>
              ))}
            </select>
            <input
              className="input-amarillo"
              type="number"
              step="0.01"
              placeholder="entrada"
              value={nuevoMov.entrada ?? ""}
              onChange={(e) => setNuevoMov((m) => ({ ...m, entrada: e.target.value }))}
            />
            <input
              className="input-amarillo"
              type="number"
              step="0.01"
              placeholder="salida"
              value={nuevoMov.salida ?? ""}
              onChange={(e) => setNuevoMov((m) => ({ ...m, salida: e.target.value }))}
            />
            <input
              className="input-plano"
              placeholder="nota"
              value={nuevoMov.nota}
              onChange={(e) => setNuevoMov((m) => ({ ...m, nota: e.target.value }))}
            />
            <button className="btn-primario" type="submit">AGREGAR</button>
          </form>
          <table className="grid">
            <thead>
              <tr><th>Fecha</th><th>Ítem</th><th>Entrada</th><th>Salida</th><th>Nota</th></tr>
            </thead>
            <tbody>
              {(movMat ?? []).slice(0, 25).map((m) => (
                <tr key={m.id}>
                  <td>{m.fecha}</td><td>{m.material}</td>
                  <td>{m.entrada}</td><td>{m.salida}</td><td>{m.nota}</td>
                </tr>
              ))}
              {movMat && movMat.length === 0 && (
                <tr><td colSpan={5} className="muted">Sin movimientos aún.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

      <details className="accordion">
        <summary>🧾 CONSUMO POR COTIZACIÓN <span className="muted">lo que ya descontó cada COT</span></summary>
        <div className="accordion-body">
          <table className="grid">
            <thead>
              <tr>
                <th>Folio</th><th>Producto</th><th>Resina (g)</th><th>PLA (g)</th>
                <th>IPA lavados</th><th>FEP provisión</th><th>Guantes</th>
              </tr>
            </thead>
            <tbody>
              {(consumo ?? []).map((c) => (
                <tr key={c.folio}>
                  <td><span className="chip-folio">{c.folio}</span></td>
                  <td>{c.producto}</td>
                  <td>{c.tipo === "Resina" ? Number(c.gramos) : ""}</td>
                  <td>{c.tipo === "PLA" ? Number(c.gramos) : ""}</td>
                  <td>{c.tipo === "Resina" ? c.bandejas : ""}</td>
                  <td>{c.tipo === "Resina" ? (c.bandejas / 40).toFixed(3) : ""}</td>
                  <td>{c.tipo === "Resina" ? Number(c.bandejas) + 1 : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function PiezaStockRow({ pieza: p, onGuardar }) {
  const [ajuste, setAjuste] = useState(1);
  const [busy, setBusy] = useState(false);
  const disp = Number(p.disponibles) || 0;
  const esConfirmada = p.estado === "Confirmada";

  async function ajustar(delta) {
    if (busy || !ajuste) return;
    setBusy(true);
    try {
      await onGuardar(p.id, { stockExtra: (Number(p.stock_extra) || 0) + delta });
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr key={p.id}>
      <td><span className="chip-folio">{p.folio}</span></td>
      <td>
        <strong>{p.nombre}</strong>
        {!esConfirmada && (
          <div className="muted" style={{ fontSize: ".7rem" }}>
            {p.estado === "Cancelada" ? "cancelada" : "pendiente de confirmar"}
          </div>
        )}
      </td>
      <td>{Number(p.vendidas)}</td>
      <td>
        <strong style={{ fontSize: "1.15rem", color: disp < 0 ? "var(--rojo-texto)" : "var(--verde-texto)" }}>
          {disp}
        </strong>
      </td>
      <td>
        <div style={{ display: "flex", gap: ".25rem", alignItems: "center", whiteSpace: "nowrap" }}>
          <input
            className="input-amarillo"
            type="number"
            min={1}
            step={1}
            style={{ width: 52, textAlign: "center", fontWeight: 800, padding: ".25rem .3rem" }}
            value={ajuste}
            onChange={(e) => setAjuste(Math.max(1, Number(e.target.value) || 1))}
            title="Cantidad a sumar o restar"
          />
          <button
            className="btn-mini"
            style={{ background: "var(--verde-claro)", color: "var(--verde-texto)", border: "1px solid #a5d6a7", fontWeight: 800 }}
            disabled={busy}
            title={`Sumar ${ajuste} piezas`}
            onClick={() => ajustar(ajuste)}
          >
            +
          </button>
          <button
            className="btn-mini"
            style={{ background: "var(--rojo)", color: "var(--rojo-texto)", border: "1px solid var(--rojo-borde)", fontWeight: 800 }}
            disabled={busy}
            title={`Restar ${ajuste} piezas`}
            onClick={() => ajustar(-ajuste)}
          >
            −
          </button>
        </div>
      </td>
      <td>
        <input
          className="input-amarillo"
          type="number"
          step={1}
          style={{ width: 66 }}
          defaultValue={Number(p.minimo) || 0}
          onBlur={(e) => onGuardar(p.id, { minimo: Number(e.target.value) || 0 })}
        />
      </td>
      <td>
        {esConfirmada && disp <= Number(p.minimo) && Number(p.minimo) > 0
          ? <span className="badge badge-reposicion">REPOSICIÓN</span>
          : <span className="muted">ok</span>}
      </td>
    </tr>
  );
}



