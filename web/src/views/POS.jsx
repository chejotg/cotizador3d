import { useEffect, useState } from "react";
import { supabase } from "../services/supabase.js";
import { formatQ, hoyISO } from "../format.js";
import { resumenVenta } from "../pricing.js";
import {
  fetchPiezasBandeja,
  venderUnidadBandeja,
  registrarCombo,
  fetchCombosGuardados,
  guardarComboPlantilla,
  eliminarComboGuardado,
} from "../services/bandejas.js";

// Componente interno: sección de piezas de bandejas + armado de combos
function BandejasyCombos({ fechaRef, recargarVentas }) {
  const [piezas, setPiezas] = useState(null);
  const [facturaZona, setFacturaZona] = useState(false);
  const [unitCliente, setUnitCliente] = useState("");
  const [unitDir, setUnitDir] = useState("");
  const [unitTel, setUnitTel] = useState("");
  const [qVendiendo, setQVendiendo] = useState(false);
  const [lineas, setLineas] = useState([]); // combo: {folio, piezaId, nombre, unidades, precioUnit}
  const [combosGuardados, setCombosGuardados] = useState(null);
  const [guardarComoPlantilla, setGuardarComoPlantilla] = useState(false);
  const [comboNombre, setComboNombre] = useState("");
  const [comboPrecio, setComboPrecio] = useState("");
  const [comboCliente, setComboCliente] = useState("");
  const [comboDireccion, setComboDireccion] = useState("");
  const [comboTelefono, setComboTelefono] = useState("");
  const [errZona, setErrZona] = useState("");
  const [okZona, setOkZona] = useState("");

  const cargarPiezas = async () => {
    try {
      setPiezas((await fetchPiezasBandeja()).filter((p) => p.estado === "Confirmada"));
      setCombosGuardados(await fetchCombosGuardados());
    } catch (e) {
      setErrZona(e.message);
    }
  };
  useEffect(() => {
    cargarPiezas();
  }, []);

  const piezaPorId = (id) => (piezas ?? []).find((p) => String(p.id) === String(id));

  async function venderPieza(p, unidades) {
    setErrZona("");
    setQVendiendo(true);
    try {
      const row = await venderUnidadBandeja({
        cotFolio: p.folio,
        piezaId: p.id,
        unidades,
        precioUnit: Number(p.precio_venta_unidad),
        factura: facturaZona,
        fecha: fechaRef(),
        cliente: unitCliente,
        direccion: unitDir,
        telefono: unitTel,
      });
      setOkZona(`Venta ${row?.folio ?? ""} registrada · ${formatQ(Number(row?.total_q))}`);
      setUnitCliente("");
      setUnitDir("");
      setUnitTel("");
      setTimeout(() => setOkZona(""), 3000);
      cargarPiezas();
      recargarVentas?.();
    } catch (e) {
      setErrZona(e.message || String(e));
    } finally {
      setQVendiendo(false);
    }
  }

  const enCombo = (pieza) => lineas.find((l) => String(l.piezaId) === String(pieza.id));

  function tocarParacombo(p) {
    if (enCombo(p)) {
      setLineas((ls) => ls.filter((l) => String(l.piezaId) !== String(p.id)));
    } else {
      setLineas((ls) => [
        ...ls,
        { folio: p.folio, piezaId: p.id, nombre: p.nombre, unidades: 1, precioUnit: Number(p.precio_venta_unidad) || 0 },
      ]);
    }
  }

  function ajustarUnidades(piezaId, delta) {
    setLineas((ls) =>
      ls.map((l) =>
        String(l.piezaId) === String(piezaId)
          ? { ...l, unidades: Math.max(1, l.unidades + delta) }
          : l
      )
    );
  }

  function ajustarPrecio(piezaId, v) {
    setLineas((ls) =>
      ls.map((l) => (String(l.piezaId) === String(piezaId)
        ? { ...l, precioUnit: v === "" ? 0 : Number(v) }
        : l))
    );
  }

  const totalComboAuto = lineas.reduce((s, l) => s + (Number(l.precioUnit) || 0) * l.unidades, 0);
  const comboTotal = comboPrecio === "" ? totalComboAuto : Number(comboPrecio) || 0;

  async function registrarComboVenta() {
    setErrZona("");
    if (!lineas.length) return setErrZona("El combo necesita piezas.");
    if (!comboNombre.trim()) return setErrZona("Ponle un nombre al combo.");
    try {
      const row = await registrarCombo({
        nombre: comboNombre.trim(),
        lineas: lineas.map((l) => ({
          folio: l.folio,
          piezaId: l.piezaId,
          unidades: l.unidades,
        })),
        precioUnit: comboPrecio === "" || comboPrecio === String(totalComboAuto) ? null : comboTotal,
        factura: facturaZona,
        fecha: fechaRef(),
        cliente: comboCliente,
      });
      setOkZona(`Combo ${row.folio} registrado · ${formatQ(Number(row.total_q))}`);
      setTimeout(() => setOkZona(""), 3000);
      if (guardarComoPlantilla) {
        try {
          await guardarComboPlantilla({
            nombre: comboNombre.trim(),
            lineas: lineas.map((l) => ({ folio: l.folio, piezaId: l.piezaId, unidades: l.unidades })),
            precio: comboPrecio === "" ? null : comboTotal,
          });
          setOkZona(`Combo ${row.folio} registrado Y guardado como plantilla 🚀`);
        } catch (e) {
          setErrZona(`La venta se registró, pero la plantilla falló: ${e.message}`);
        }
      }
      setLineas([]);
      setComboNombre("");
      setComboPrecio("");
      setComboCliente("");
      setGuardarComoPlantilla(false);
      cargarPiezas();
      recargarVentas?.();
    } catch (e) {
      setErrZona(e.message || String(e));
    }
  }

  async function guardarPlantilla() {
    setErrZona("");
    if (!lineas.length) return setErrZona("El combo necesita piezas antes de guardarse.");
    if (!comboNombre.trim()) return setErrZona("Ponle un nombre al combo para guardarlo.");
    try {
      await guardarComboPlantilla({
        nombre: comboNombre.trim(),
        lineas: lineas.map((l) => ({ folio: l.folio, piezaId: l.piezaId, unidades: l.unidades })),
        precio: comboPrecio === "" ? null : comboTotal,
      });
      setOkZona(`Combo "${comboNombre.trim()}" guardado — aparece en COMBOS GUARDADOS 🚀`);
      setTimeout(() => setOkZona(""), 3500);
      setLineas([]);
      setComboNombre("");
      setComboPrecio("");
      cargarPiezas();
    } catch (e) {
      setErrZona(e.message || String(e));
    }
  }

  async function venderComboGuardado(tpl, cant = 1) {
    setErrZona("");
    try {
      const row = await registrarCombo({
        nombre: cant > 1 ? `${tpl.nombre} ×${cant}` : tpl.nombre,
        lineas: (tpl.lineas ?? []).map((l) => ({
          folio: l.cot_folio,
          piezaId: l.pieza_id,
          unidades: (Number(l.unidades) || 1) * cant,
        })),
        precioUnit: tpl.precio != null ? Number(tpl.precio) * cant : null,
        factura: facturaZona,
        fecha: fechaRef(),
      });
      setOkZona(`Combo ${row.folio} registrado · ${formatQ(Number(row.total_q))}`);
      setTimeout(() => setOkZona(""), 3000);
      cargarPiezas();
      recargarVentas?.();
    } catch (e) {
      setErrZona(e.message || String(e));
    }
  }

  async function quitarPlantilla(id) {
    if (!confirm("¿Eliminar este combo guardado? (las ventas ya hechas no cambian)")) return;
    try {
      await eliminarComboGuardado(id);
      cargarPiezas();
    } catch (e) {
      setErrZona(e.message || String(e));
    }
  }

  // Agregar el combo actualmente armado a COMBOS GUARDADOS
  const tplPrecioAuto = (tpl) => {
    const total = (tpl.lineas ?? []).reduce((s, l) => {
      const p = piezaPorId(l.pieza_id);
      return s + (Number(p?.precio_venta_unidad) || 0) * (Number(l.unidades) || 1);
    }, 0);
    return tpl.precio != null ? Number(tpl.precio) : total;
  };

  return (
    <section className="bloque">
      <h2 className="seccion" style={{ marginBottom: ".4rem" }}>PIEZAS DE BANDEJAS Y COMBOS</h2>
      <div style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap", margin: ".5rem 0" }}>
        {errZona && <div className="alerta-roja">{errZona}</div>}
        {okZona && <div className="aviso-info aviso-ok">✓ {okZona}</div>}
        <label style={{ display: "flex", gap: ".35rem", alignItems: "center", fontWeight: 700 }}>
          <input type="checkbox" checked={facturaZona} onChange={(e) => setFacturaZona(e.target.checked)} />
          ¿Con factura esta zona?
        </label>
      </div>

      {(combosGuardados ?? []).length > 0 && (
        <details className="accordion" open>
          <summary>
            🚀 COMBOS GUARDADOS (venta rápida){" "}
            <span className="muted">un toque y se registran con su líneas guardadas — usa ×N para vender varios</span>
          </summary>
          <div className="accordion-body">
            <div className="pos-prod-grid">
              {(combosGuardados ?? []).map((tpl) => (
                <div key={tpl.id} className="pos-prod-btn" style={{ cursor: "default" }}>
                  <span>{tpl.nombre}</span>
                  <span className="precio">{formatQ(tplPrecioAuto(tpl))}</span>
                  {tpl.precio != null && <span className="nota">precio fijo</span>}
                  {(tpl.lineas ?? []).some((l) => {
                    const pz = piezaPorId(l.pieza_id);
                    return !pz || pz.disponibles < (Number(l.unidades) || 1);
                  }) && (
                    <span className="nota" style={{ color: "var(--rojo-texto)" }}>
                      ⚠ sin suficiente stock de piezas
                    </span>
                  )}
                  <div style={{ display: "flex", gap: ".3rem", alignItems: "center", marginTop: ".3rem" }}>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={tpl._cant ?? 1}
                      onChange={(e) =>
                        setCombosGuardados((cs) =>
                          (cs ?? []).map((c2) =>
                            c2.id === tpl.id ? { ...c2, _cant: Number(e.target.value) } : c2
                          )
                        )
                      }
                      style={{ width: 48, textAlign: "center", fontWeight: 800, fontSize: ".85rem", padding: ".25rem" }}
                      title="¿Cuántos packs?"
                    />
                    <button
                      className="btn-primario"
                      style={{ padding: ".3rem .7rem", fontSize: ".8rem", flex: 1 }}
                      onClick={() => venderComboGuardado(tpl, tpl._cant ?? 1)}
                    >
                      🛒 Vender{tpl._cant > 1 ? ` ×${tpl._cant}` : ""}
                    </button>
                    <button
                      className="btn-peligro"
                      style={{ padding: ".3rem .5rem", fontSize: ".75rem" }}
                      onClick={() => quitarPlantilla(tpl.id)}
                    >
                      🗑
                    </button>
                  </div>
                  {tpl._cant > 1 && (
                    <span className="nota" style={{ fontWeight: 800, color: "var(--verde-texto)" }}>
                      TOTAL: {formatQ(tplPrecioAuto(tpl) * tpl._cant)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </details>
      )}

      <details className="accordion" open>
        <summary>
          🧩 VENTA POR UNIDAD <span className="muted">piezas de bandejas cotizadas por unidad</span>
        </summary>
        <div className="accordion-body">
          <div className="input-dos" style={{ marginBottom: ".5rem" }}>
            <input
              className="input-amarillo"
              placeholder="Cliente (opcional)"
              value={unitCliente}
              onChange={(e) => setUnitCliente(e.target.value)}
            />
            <input
              className="input-amarillo"
              placeholder="Dirección del cliente (opcional)"
              value={unitDir}
              onChange={(e) => setUnitDir(e.target.value)}
            />
            <input
              className="input-amarillo"
              placeholder="Teléfono del cliente (opcional)"
              value={unitTel}
              onChange={(e) => setUnitTel(e.target.value)}
            />
          </div>
          <table className="grid">
            <thead>
              <tr>
                <th>Folio</th><th>Pieza</th><th>Disponibles</th><th>Precio unidad</th><th>Cant</th><th></th>
              </tr>
            </thead>
            <tbody>
              {(piezas ?? []).map((p) => (
                <PiezaFila key={p.id} pieza={qVendiendo ? null : p} p={p} enCombo={enCombo(p)} onVender={venderPieza} onCombo={tocarParacombo} />
              ))}
              {piezas && piezas.length === 0 && (
                <tr><td colSpan={6} className="muted">Sin piezas por unidad. Cota una bandeja con "Se vende POR UNIDAD" en el Cotizador.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </details>

      <details className="accordion" open>
        <summary>🎁 ARMAR COMBO <span className="muted">mezcla piezas de distintas bandejas con su valor</span></summary>
        <div className="accordion-body">
          <div className="input-dos" style={{ marginBottom: ".6rem" }}>
            <input
              className="input-amarillo"
              placeholder="Nombre del combo (p. ej. Pack Navideño)"
              value={comboNombre}
              onChange={(e) => setComboNombre(e.target.value)}
            />
            <input
              className="input-amarillo"
              placeholder="Cliente (opcional)"
              value={comboCliente}
              onChange={(e) => setComboCliente(e.target.value)}
            />
          </div>
          <div className="input-dos" style={{ marginBottom: ".6rem" }}>
            <input
              className="input-amarillo"
              placeholder="Dirección del cliente (opcional)"
              value={comboDireccion ?? ""}
              onChange={(e) => setComboDireccion(e.target.value)}
            />
            <input
              className="input-amarillo"
              placeholder="Teléfono del cliente (opcional)"
              value={comboTelefono ?? ""}
              onChange={(e) => setComboTelefono(e.target.value)}
            />
          </div>
          {lineas.length === 0 && (
            <div className="muted" style={{ marginBottom: ".6rem" }}>
              Toca las piezas de la tabla de arriba para agregarlas al combo.
            </div>
          )}
          {lineas.map((l) => (
            <div
              key={l.piezaId}
              style={{ display: "grid", gridTemplateColumns: "1.4fr 110px 110px auto", gap: ".5rem", alignItems: "center", marginBottom: ".4rem" }}
            >
              <div style={{ fontWeight: 700 }}>
                {l.nombre} <span className="muted">({l.folio})</span>
              </div>
              <div style={{ display: "flex", gap: ".25rem", alignItems: "center" }}>
                <button type="button" className="btn-mini" onClick={() => ajustarUnidades(l.piezaId, -1)}>−</button>
                <strong>{l.unidades}</strong>
                <button type="button" className="btn-mini" onClick={() => ajustarUnidades(l.piezaId, +1)}>+</button>
              </div>
              <input
                className="input-amarillo"
                type="number"
                step="0.01"
                min={0}
                value={l.precioUnit}
                onChange={(e) => ajustarPrecio(l.piezaId, e.target.value)}
              />
              <button type="button" className="btn-peligro" onClick={() => tocarParacombo({ id: l.piezaId })}>
                quitar
              </button>
            </div>
          ))}
          {lineas.length > 0 && (
            <div className="calc-fila total destacada" style={{ background: "var(--verde-claro)", borderRadius: 8, padding: ".4rem .6rem" }}>
              <span>TOTAL del combo</span>
              <strong className="total-grande">{formatQ(comboTotal)}</strong>
            </div>
          )}
          <label style={{ display: "flex", gap: ".4rem", alignItems: "center", fontWeight: 700, fontSize: ".85rem", margin: ".5rem 0" }}>
            <input
              type="checkbox"
              checked={guardarComoPlantilla}
              onChange={(e) => setGuardarComoPlantilla(e.target.checked)}
            />
            💾 Guardar también como plantilla (quedará en COMBOS GUARDADOS para venta rápida)
          </label>
          <div className="input-dos" style={{ marginTop: ".4rem" }}>
            <input
              className="input-amarillo"
              type="number"
              step="0.01"
              min={0}
              placeholder={`Precio total del combo (${comboPrecio === "" ? formatQ(totalComboAuto) : "editado"})`}
              value={comboPrecio}
              onChange={(e) => setComboPrecio(e.target.value)}
            />
            <button
              className="btn-secundario"
              type="button"
              disabled={lineas.length === 0 || !comboNombre.trim()}
              onClick={guardarPlantilla}
              title="Salvar las líneas y precio como plantilla de venta rápida"
            >
              💾 GUARDAR COMBO (plantilla)
            </button>
          </div>
          <div style={{ marginTop: ".6rem" }}>
            <button
              className="btn-primario"
              type="button"
              disabled={lineas.length === 0 || !comboNombre.trim()}
              type="button"
              disabled={lineas.length === 0 || !comboNombre.trim()}
              onClick={registrarComboVenta}
            >
              🎁 REGISTRAR COMBO
            </button>
          </div>
        </div>
      </details>
    </section>
  );
}

function PiezaFila({ pieza: _liveP, p, enCombo = false, onVender, onCombo }) {
  const [cant, setCant] = useState(1);
  const disponibles = Math.max(0, Number(p.disponibles) || 0);
  return (
    <tr key={p.id}>
      <td><span className="chip-folio">{p.folio}</span></td>
      <td><strong>{p.nombre}</strong></td>
      <td className={disponibles === 0 ? "saldo-neg" : ""}>{disponibles}</td>
      <td>{formatQ(Number(p.precio_venta_unidad) || 0)}</td>
      <td>
        <input
          className="input-amarillo"
          type="number"
          min={1}
          max={disponibles || 1}
          step={1}
          style={{ width: 70 }}
          value={cant}
          onChange={(e) => setCant(Number(e.target.value))}
        />
      </td>
      <td style={{ whiteSpace: "nowrap" }}>
        <div style={{ display: "flex", gap: ".3rem" }}>
          <button
            className="btn-primario"
            style={{ padding: ".3rem .65rem", fontSize: ".8rem" }}
            disabled={disponibles < 1 || cant > disponibles}
            onClick={() => onVender(p, Math.max(1, cant))}
          >
            Vender
          </button>
          <button
            className={`btn-mini ${enCombo ? "" : ""}`}
            style={enCombo ? { background: "var(--verde-claro)", color: "var(--verde-texto)" } : {}}
            onClick={() => onCombo(p)}
          >
            {enCombo ? "✓ en combo" : "+ combo"}
          </button>
        </div>
      </td>
    </tr>
  );
}

// Punto de venta: venta rápida (toca producto → ajusta cantidad → registra) + resumen por fecha.
export default function POS() {
  const [productos, setProductos] = useState([]);
  const [cots, setCots] = useState([]); // snapshots vivos de cotizacion (fuente de precio/nombre)
  const [form, setForm] = useState({
    fecha: hoyISO(),
    cliente: "",
    producto: "",
    cantidad: 1,
    precio_unit: null,
    factura: false,
  });
  const [fechaResumen, setFechaResumen] = useState(hoyISO());
  const [ventas, setVentas] = useState(null);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [toast, setToast] = useState("");

  const cargarProductos = async () => {
    const [prods, cotRows] = await Promise.all([
      supabase
        .from("producto")
        .select("nombre,precio_sin_iva,nota")
        .order("nombre"),
      supabase.from("cotizacion").select(
        "folio,producto,estado,metodo_cobro,precio_venta_unidad,precio_venta_final,factura,total_sin_iva_q,con_factura_q"
      ),
    ]);
    if (prods.error) {
      setError(`No se pudo cargar el catálogo: ${prods.error.message}`);
      return;
    }
    if (cotRows.error) {
      setError(`No se pudieron leer las cotizaciones: ${cotRows.error.message}`);
      return;
    }
    setProductos(prods.data ?? []);
    setCots(cotRows.data ?? []);
  };

  // Los productos referenciados a una cotización OBTIENEN SIEMPRE nombre/precio
  // del snapshot guardado en DB (nunca la copia sembrada del catálogo).
  // Regla del propietario: solo Confirmadas aparecen; las bandejas por unidad se
  // venden en la zona PIEZAS (se descartan del grid para evitar duplicados viejos).
  const productosVisibles = productos
    .map((p) => {
      const m = String(p.nota || "").trim().match(/^COT-\d+$/i);
      if (!m) return p; // manual: catálogo tal cual
      const cot = cots.find((c) => c.folio === m[0].toUpperCase());
      if (!cot || cot.estado !== "Confirmada") return null;
      if (cot.metodo_cobro === "unidad") return null; // → zona PIEZAS DE BANDEJAS
      const baseCobro = cot.factura ? Number(cot.con_factura_q) : Number(cot.total_sin_iva_q);
      return {
        ...p,
        nombre: cot.producto, // nombre vigente en DB
        precio_sin_iva:
          cot.precio_venta_final != null ? Number(cot.precio_venta_final) : baseCobro,
        nota: cot.folio,
      };
    })
    .filter((p) => p !== null);

  const cargarVentas = (fecha) =>
    supabase
      .from("venta")
      .select("*")
      .eq("fecha", fecha)
      .order("folio")
      .then(({ data, error }) => {
        if (error) setError(`No se pudo cargar las ventas: ${error.message}`);
        else setVentas(data ?? []);
      });

  useEffect(() => {
    cargarProductos();
  }, []);
  useEffect(() => {
    cargarVentas(fechaResumen);
  }, [fechaResumen]);

  const resumen = resumenVenta(
    form.cantidad,
    form.precio_unit ?? 0,
    form.factura,
    0.12
  );

  function set(k, v) {
    setForm((f) => {
      if (k === "producto") {
        const p = productosVisibles.find((p2) => p2.nombre === v);
        return { ...f, producto: v, precio_unit: p ? Number(p.precio_sin_iva) : f.precio_unit };
      }
      return { ...f, [k]: v };
    });
  }

  // venta rápida: tocas producto (sumar si ya estaba) → ajusta cantidad automática
  function tocarProducto(nombre) {
    setForm((f) => {
      if (f.producto === nombre) return { ...f, cantidad: f.cantidad + 1 };
      const p = productosVisibles.find((p2) => p2.nombre === nombre);
      return { ...f, producto: nombre, precio_unit: p ? Number(p.precio_sin_iva) : f.precio_unit, cantidad: 1 };
    });
  }

  async function registrar(e) {
    e.preventDefault();
    setError("");
    if (!form.producto) return;
    setGuardando(true);
    try {
      const args = {
        p_fecha: form.fecha,
        p_cliente: form.cliente,
        p_cliente_direccion: form.direccion,
        p_cliente_telefono: form.telefono,
        p_producto: form.producto,
        p_cantidad: form.cantidad,
        p_precio_unit: form.precio_unit,
        p_factura: form.factura,
      };
      const { data: row, error: err } = await supabase.rpc("registrar_venta", args);
      if (err) throw new Error(err.message);
      setToast(`Venta ${row.folio} registrada · total ${formatQ(Number(row.total_q))}`);
      setForm((f) => ({ ...f, cliente: "", direccion: "", telefono: "", producto: "", cantidad: 1, precio_unit: null }));
      cargarVentas(fechaResumen);
    } catch (err2) {
      setError(String(err2.message || err2));
    } finally {
      setGuardando(false);
    }
  }

  async function anular(folio) {
    if (!confirm(`¿Anular ${folio}? Las piezas vuelven al inventario.`)) return;
    const { error: err } = await supabase.rpc("anular_venta", { p_folio: folio });
    if (err) setError(err.message);
    else cargarVentas(fechaResumen);
  }

  const activas = (ventas ?? []).filter((v) => !v.anulada);
  const totalSin = activas.filter((v) => !v.factura).reduce((s, v) => s + Number(v.total_q), 0);
  const totalCon = activas.filter((v) => v.factura).reduce((s, v) => s + Number(v.total_q), 0);
  
  return (
    <div>
      {toast && (
        <div className="aviso-info toast-envio aviso-ok" style={{ left: "50%",
minWidth: 260, justifyContent: "center" }}>
          ✅ {toast}
        </div>
      )}
      {error && <div className="alerta-roja" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="pos-grid">
        <div>
          <form onSubmit={registrar}>
            <fieldset className="inputs">
              <legend>NUEVA VENTA</legend>
              <div className="inner">
                <div className="input-dos">
                  <label className="input-label">
                    Fecha
                    <input
                      className="input-amarillo"
                      type="date"
                      value={form.fecha}
                      onChange={(e) => set("fecha", e.target.value)}
                    />
                  </label>
                <label className="input-label">
                  Cliente
                  <input
                    className="input-amarillo"
                    value={form.cliente}
                    placeholder="(mostrador)"
                    onChange={(e) => set("cliente", e.target.value)}
                  />
                </label>
                <label className="input-label">
                  Dirección (opcional)
                  <input
                    className="input-amarillo"
                    value={form.direccion ?? ""}
                    placeholder="para envíos"
                    onChange={(e) => set("direccion", e.target.value)}
                  />
                </label>
                <label className="input-label">
                  Teléfono (opcional)
                  <input
                    className="input-amarillo"
                    value={form.telefono ?? ""}
                    placeholder="p. ej. 5555-1234"
                    onChange={(e) => set("telefono", e.target.value)}
                  />
                </label>
                </div>
                <label className="input-label">
                  Producto
                  <select
                    className="input-amarillo"
                    required
                    value={form.producto}
                    onChange={(e) => set("producto", e.target.value)}
                  >
                    <option value="">— elegir —</option>
                    {productosVisibles.map((p) => (
                      <option key={p.nombre} value={p.nombre}>{p.nombre}</option>
                    ))}
                  </select>
                </label>
                <div className="input-dos">
                  <label className="input-label">
                    Cantidad
                    <input
                      className="input-amarillo"
                      type="number"
                      min={1}
                      step={1}
                      value={form.cantidad}
                      onChange={(e) => set("cantidad", Number(e.target.value))}
                    />
                  </label>
                  <label className="input-label">
                    Precio unitario (sin IVA)
                    <input
                      className="input-amarillo"
                      type="number"
                      step="0.01"
                      min={0}
                      value={form.precio_unit ?? ""}
                      onChange={(e) =>
                        set("precio_unit", e.target.value === "" ? null : Number(e.target.value))
                      }
                    />
                  </label>
                </div>
                <div className="input-dos">
                  <label className="input-label">
                    Factura
                    <select
                      className="input-amarillo"
                      value={form.factura ? "Sí" : "No"}
                      onChange={(e) => set("factura", e.target.value === "Sí")}
                    >
                      <option value="No">No</option>
                      <option value="Sí">Sí (IVA 12%)</option>
                    </select>
                  </label>
                  <div className="calc-fila" style={{ alignItems: "center" }}>
                    <span>TOTAL</span>
                    <strong className="total-grande">{formatQ(resumen.total_q)}</strong>
                  </div>
                </div>
                <button className="btn-primario" type="submit" disabled={guardando || !form.producto}>
                  {guardando ? "Registrando…" : "REGISTRAR VENTA"}
                </button>
              </div>
            </fieldset>
          </form>
        </div>

        <div>
          {/* venta rápida: grid de productos (solo referencias Confirmadas) */}
          <fieldset className="inputs" style={{ marginBottom: "1rem" }}>
            <legend>VENTA RÁPIDA — toca el producto (solo cotizaciones Confirmadas)</legend>
            <div className="pos-prod-grid">
              {productosVisibles.map((p) => (
                <button
                  type="button"
                  key={p.nombre}
                  className={`pos-prod-btn ${form.producto === p.nombre ? "seleccionado" : ""}`}
                  onClick={() => tocarProducto(p.nombre)}
                >
                  <span>{p.nombre}</span>
                  <span className="precio">{formatQ(Number(p.precio_sin_iva))}</span>
                  {p.nota && <span className="nota">{p.nota}</span>}
                </button>
              ))}
              {productosVisibles.length === 0 && (
                <span className="muted">
                  Sin productos a la venta: confirma en “Cotizaciones” la cotización
                  correspondiente para verlos aquí (las Emitidas/Canceladas no aparecen).
                </span>
              )}
            </div>
          </fieldset>

          <section className="bloque">
            <h2 className="seccion" style={{ marginBottom: ".4rem" }}>RESUMEN</h2>
            <div className="resumen-fila" style={{ margin: ".5rem 0" }}>
              <input
                className="input-amarillo"
                type="date"
                value={fechaResumen}
                onChange={(e) => setFechaResumen(e.target.value)}
              />
              <div className="resumen-hoy">{fechaResumen === hoyISO() ? "HOY" : fechaResumen}</div>
              <div><div className="muted">Ventas</div><strong style={{ fontSize: "1.1rem" }}>{activas.length}</strong></div>
            </div>
            <div className="calc-fila"><span>Total sin factura</span><strong>{formatQ(totalSin)}</strong></div>
            <div className="calc-fila"><span>Total con factura</span><strong>{formatQ(totalCon)}</strong></div>
            <div className="calc-fila total destacada">
              <span>TOTAL DEL DÍA</span>
              <strong className="total-grande">{formatQ(totalSin + totalCon)}</strong>
            </div>

            <table className="grid" style={{ marginTop: "1rem" }}>
              <thead>
                <tr>
                  <th>Nº</th><th>Cliente</th><th>Producto</th><th>Cant</th>
                  <th>Precio u</th><th>Subtotal</th><th>IVA</th><th>TOTAL</th><th></th>
                </tr>
              </thead>
              <tbody>
                {(ventas ?? []).map((v) => (
                  <tr
                    key={v.folio}
                    style={v.anulada
                      ? { opacity: 0.45, textDecoration: "line-through" }
                      : {}}
                  >
                    <td><span className="chip-folio">{v.folio}</span></td>
                    <td>{v.cliente}</td>
                    <td>{v.producto}</td>
                    <td>{v.cantidad}</td>
                    <td>{formatQ(v.precio_unit)}</td>
                    <td>{formatQ(v.subtotal_q)}</td>
                    <td>{formatQ(v.iva_q)}</td>
                    <td><strong>{formatQ(v.total_q)}</strong></td>
                    <td>
                      {!v.anulada && (
                        <button className="btn-peligro" style={{ padding: ".25rem .6rem", fontSize: ".75rem" }} onClick={() => anular(v.folio)}>
                          Anular
                        </button>
                      )}
                      {v.anulada && <span className="badge badge-cancelada">Anulada</span>}
                    </td>
                  </tr>
                ))}
                {ventas && ventas.length === 0 && (
                  <tr><td colSpan={9} className="muted">Sin ventas para esta fecha.</td></tr>
                )}
              </tbody>
            </table>
          </section>
        </div>
      </div>

      <BandejasyCombos
        fechaRef={() => fechaResumen}
        recargarVentas={() => cargarVentas(fechaResumen)}
      />
    </div>
  );
}










