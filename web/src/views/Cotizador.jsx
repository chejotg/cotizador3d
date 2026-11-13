import { useEffect, useMemo, useState } from "react";
import { supabase } from "../services/supabase.js";
import { fetchTarifas } from "../services/tarifas.js";
import { guardarCotizacion, editarCotizacion, cargarCotizacionPorFolio } from "../services/cotizaciones.js";
import { fetchPiezasPorFolio } from "../services/bandejas.js";
import { fetchMaterialesDisponibles } from "../services/materiales.js";
import { cotizar, sumarBandejas, redondeo2 } from "../pricing.js";
import { formatQ, hoyISO } from "../format.js";
import CalcPanel from "../components/CalcPanel.jsx";
import MoneyInput from "../components/MoneyInput.jsx";
import StockPanel from "../components/StockPanel.jsx";

const IMPRESORAS_POR_TIPO = {
  Resina: ["Saturn 4", "Saturn 3"],
  PLA: ["Creator 5"],
};

const DEFAULTS = {
  fecha: hoyISO(),
  cliente: "",
  producto: "",
  tipo: "PLA",
  material_usado: "PLA",
  impresora: "Creator 5",
  bandejas: 1,
  gramos: null,
  horas_impresion: null,
  horas_mo: 0.25,
  horas_pintura: 0,
  pintado: false,
  embalaje: "Ninguno",
  factura: false,
  envio_q: 0,
};

export default function Cotizador() {
  const [tarifas, setTarifas] = useState(null);
  const [materiales, setMateriales] = useState([]);
  const [form, setForm] = useState(DEFAULTS);
  const [editando, setEditando] = useState(null);
  const [esBandeja, setEsBandeja] = useState(false);
  const [metodoCobro, setMetodoCobro] = useState("total"); // 'total' | 'unidad'
  const [piezas, setPiezas] = useState([]); // [{nombre, cantidad}]
  const [usarDesglose, setUsarDesglose] = useState(true); // desglose por bandeja
  const [bandejasDetalle, setBandejasDetalle] = useState([
    { n: 1, gramos: null, horas_impresion: null, horas_mo: 0.25, horas_pintura: 0 },
  ]);
  const [precioUnidadInput, setPrecioUnidadInput] = useState("");
  const [matsUsados, setMatsUsados] = useState([{ material: "", gramos: null }]); // vacío = sugerido automático
  const [guardando, setGuardando] = useState(false);
  const [folioGuardado, setFolioGuardado] = useState("");
  const [unidadGuardada, setUnidadGuardada] = useState(null);
  const [avisoTanda, setAvisoTanda] = useState("");
  const [error, setError] = useState("");
  const [errConfig, setErrConfig] = useState(false);

  useEffect(() => {
    Promise.all([fetchTarifas(), fetchMaterialesDisponibles()])
      .then(([t, m]) => { setTarifas(t); setMateriales(m); })
      .catch((e) => setErrConfig(e.message || true));
  }, []);

  // modo edición POR URL: '#/cotizador?edit=COT-019'
  // los datos SIEMPRE se leen de la base (nunca de una copia transitada entre pantallas)
  const aplicarEditDesdeURL = () => {
    const m = (window.location.hash || "").match(/[?&]edit=(COT-\d+)/i);
    if (!m) return null;
    const folio = m[1].toUpperCase();
    setEditando({ folio });
    cargarCotizacionPorFolio(folio)
      .then((row) => {
        const datos = {
          fecha: row.fecha,
          cliente: row.cliente,
          producto: row.producto,
          tipo: row.tipo,
          impresora: row.impresora,
          bandejas: row.bandejas,
          gramos: Number(row.gramos),
          horas_impresion: Number(row.horas_impresion),
          horas_mo: Number(row.horas_mo),
          horas_pintura: Number(row.horas_pintura),
          pintado: row.pintado,
          embalaje: row.embalaje,
          factura: row.factura,
          envio_q: Number(row.envio_q),
          estado: row.estado,
          notas: row.notas,
          es_bandeja: row.es_bandeja,
          metodo_cobro: row.metodo_cobro,
          precio_venta_unidad: row.precio_venta_unidad != null ? Number(row.precio_venta_unidad) : null,
          bandejas_detalle: Array.isArray(row.bandejas_detalle) ? row.bandejas_detalle : null,
        };
        setForm({ ...DEFAULTS, ...datos, fecha: datos.fecha ?? hoyISO() });
        setEsBandeja(!!datos.es_bandeja);
        setMetodoCobro(datos.metodo_cobro || "total");
        setPrecioUnidadInput(
          datos.precio_venta_unidad != null ? String(datos.precio_venta_unidad) : ""
        );
        if (Array.isArray(datos.bandejas_detalle) && datos.bandejas_detalle.length) {
          setUsarDesglose(true);
          setBandejasDetalle(
            datos.bandejas_detalle.map((r) => ({
              n: Math.max(1, Number(r.n) || 1),
              gramos: r.gramos != null ? Number(r.gramos) : null,
              horas_impresion: r.horas_impresion != null ? Number(r.horas_impresion) : null,
              horas_mo: r.horas_mo != null ? Number(r.horas_mo) : 0,
              horas_pintura: r.horas_pintura != null ? Number(r.horas_pintura) : 0,
            }))
          );
        } else {
          setUsarDesglose(false);
        }
        // limpiar el parámetro de la URL sin recargar (evita recargar al guardar)
        window.history.replaceState(null, "", `${location.pathname}#/cotizador`);
        // precargar materiales usados
        supabase
          .from("cotizacion_material")
          .select("material,gramos")
          .eq("folio", folio)
          .then(({ data: mts }) => {
            if (mts && mts.length > 0) {
              setMatsUsados(mts.map((mt) => ({ material: mt.material, gramos: Number(mt.gramos) })));
            }
          });
        return fetchPiezasPorFolio(folio).then((pzs) =>
          setPiezas(
            pzs.map((p) => ({ id: p.id, nombre: p.nombre, cantidad: p.cantidad, vendidas: p.vendidas }))
          )
        );
      })
      .catch((e) => setError(e.message || String(e)));
  };
  useEffect(() => {
    aplicarEditDesdeURL();
    const onHash = () => aplicarEditDesdeURL();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const sumaBand = useMemo(
    () => (usarDesglose ? sumarBandejas(bandejasDetalle) : null),
    [usarDesglose, bandejasDetalle]
  );

  const resultado = useMemo(() => {
    if (!tarifas || !String(form.producto ?? "").trim()) return null;
    try {
      // override del costo de material si el form tiene material_usado
      const mat = materiales.find((m) => m.nombre === form.material_usado);
      const t = mat ? { ...tarifas, mat_costo: Number(mat.costo_qg) } : tarifas;
      return cotizar(t, usarDesglose ? { ...form, ...sumaBand } : form);
    } catch {
      return null;
    }
  }, [tarifas, materiales, form, usarDesglose, sumaBand]);

  function set(k, v) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "material_usado") {
        const mat = materiales.find((m) => m.nombre === v);
        if (mat) {
          next.tipo = mat.descontable_por === "resina" ? "Resina" : "PLA";
          next.impresora = next.tipo === "Resina" ? "Saturn 4" : "Creator 5";
        }
      }
      if (k === "tipo") next.impresora = IMPRESORAS_POR_TIPO[v][0];
      return next;
    });
    if (k === "producto") setAvisoTanda("");
  }

  // Tanda rápida: al salir del campo producto, precarga los datos de la última
  // cotización con ese producto (solo cuando están vacíos o sin tocar).
  async function autocompletarProducto(nombre) {
    const nombre2 = String(nombre ?? "").trim();
    if (!nombre2 || tarifas === null) return;
    const { data, error: e } = await supabase
      .from("cotizacion")
      .select("tipo,impresora,bandejas,gramos,horas_impresion,horas_mo,pintado,factura")
      .eq("producto", nombre2)
      .order("created_at", { ascending: false })
      .limit(1);
    if (e || !data?.length) return;
    const u = data[0];
    setForm((f) => ({
      ...f,
      tipo: f.tipo === DEFAULTS.tipo && !f.gramos ? u.tipo : f.tipo,
      impresora: !f.gramos ? u.impresora : f.impresora,
      bandejas: u.bandejas ?? f.bandejas,
      gramos: f.gramos == null ? Number(u.gramos) : f.gramos,
      horas_impresion: f.horas_impresion == null ? Number(u.horas_impresion) : f.horas_impresion,
      horas_mo: f.horas_mo === DEFAULTS.horas_mo ? Number(u.horas_mo) : f.horas_mo,
      pintado: f.pintado === false ? u.pintado : f.pintado,
      factura: f.factura === false ? u.factura : f.factura,
    }));
    // repartir los totales entre bandejas (parámetros idénticos por corrida)
    const nb = Math.max(1, Number(u.bandejas) || 1);
    setUsarDesglose(true);
    setBandejasDetalle([
      {
        n: nb,
        gramos: Number(u.gramos) / nb,
        horas_impresion: Number(u.horas_impresion) / nb,
        horas_mo: Number(u.horas_mo) / nb,
        horas_pintura: Number(u.horas_pintura) / nb,
      },
    ]);
      setAvisoTanda(`Datos precargados de la última cotización de "${nombre2}"`);
  }

  async function onGuardar(e) {
    e.preventDefault();
    setError("");
    if (usarDesglose) {
      if (bandejasDetalle.length === 0) {
        setError("Agrega al menos una bandeja.");
        return;
      }
      if (
        bandejasDetalle.some(
          (b) =>
            Number(b.gramos ?? 0) < 0 ||
            Number(b.horas_impresion ?? 0) < 0 ||
            Number(b.horas_mo ?? 0) < 0 ||
            Number(b.horas_pintura ?? 0) < 0
        )
      ) {
        setError("Ningún valor de la bandeja puede ser negativo.");
        return;
      }
    }
    if (esBandeja) {
      if (piezas.length === 0) {
        setError("La bandeja necesita al menos una pieza.");
        return;
      }
      if (piezas.some((p) => !String(p.nombre ?? "").trim())) {
        setError("Todas las piezas de la bandeja necesitan nombre.");
        return;
      }
    }
    setGuardando(true);
    try {
      const guardarArgs = { ...form };
      if (form.material_usado) guardarArgs.material_usado = form.material_usado;
      if (matsUsados.length > 0 && matsUsados.some((m) => m.material && Number(m.gramos) > 0)) {
        guardarArgs.materiales = matsUsados
          .filter((m) => m.material && Number(m.gramos) > 0)
          .map((m) => ({ material: m.material, gramos: Number(m.gramos) || 0 }));
      }
      let row;
      if (esBandeja) {
        guardarArgs.es_bandeja = true;
        guardarArgs.metodo_cobro = metodoCobro;
        guardarArgs.piezas = piezas.map((p) => ({
          ...(p.id ? { pieza_id: p.id } : {}),
          nombre: String(p.nombre).trim(),
          cantidad: Math.max(1, Number(p.cantidad) || 1),
        }));
        if (metodoCobro === "unidad" && precioUnidadInput !== "") {
          guardarArgs.precio_venta_unidad = Number(precioUnidadInput);
        }
      }
      if (usarDesglose) {
        const s = sumarBandejas(bandejasDetalle);
        guardarArgs.bandejas = s.bandejas;
        guardarArgs.gramos = s.gramos;
        guardarArgs.horas_impresion = s.horas_impresion;
        guardarArgs.horas_mo = s.horas_mo;
        guardarArgs.horas_pintura = s.horas_pintura;
        guardarArgs.bandejas_detalle = bandejasDetalle.map((b) => ({
          n: Math.max(1, Number(b.n) || 1),
          gramos: Number(b.gramos) || 0,
          horas_impresion: Number(b.horas_impresion) || 0,
          horas_mo: Number(b.horas_mo) || 0,
          horas_pintura: Number(b.horas_pintura) || 0,
        }));
      }
      if (editando) {
        const row = await editarCotizacion(editando.folio, guardarArgs);
        setFolioGuardado(row.folio);
        setUnidadGuardada(row.precio_venta_unidad);
        setEditando(null);
      } else {
        const row = await guardarCotizacion(guardarArgs);
        setFolioGuardado(row.folio);
        setUnidadGuardada(row.precio_venta_unidad);
      }
      setForm(DEFAULTS);
      setEsBandeja(false);
      setMetodoCobro("total");
      setPiezas([]);
      setPrecioUnidadInput("");
      setUsarDesglose(true);
      setMatsUsados([{ material: "PLA", gramos: null }]);
      setBandejasDetalle([
        { n: 1, gramos: null, horas_impresion: null, horas_mo: 0.25, horas_pintura: 0 },
      ]);
      setAvisoTanda("");
    } catch (err) {
      setError(err.message || String(err));
    } finally {
      setGuardando(false);
    }
  }

  function goHistorial() {
    setFolioGuardado("");
    window.location.hash = "#/historial";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  }

  const field = (label, key, comp) => (
    <label className="input-label">
      {label}
      {comp(() => form[key], (v) => set(key, v))}
    </label>
  );

  return (
    <div>
      {editando && (
        <div className="aviso-info" style={{ marginBottom: "1rem" }}>
          Editando {editando.folio} — al guardar se recalcula el snapshot y queda el "Historial"
        </div>
      )}
      {folioGuardado && (
        <div className="aviso-info" style={{ marginBottom: "1rem" }}>
          {editando?.folio ? "Actualizada" : "Guardado como"}{" "}
          <span className="chip-folio">{folioGuardado}</span>
          {unidadGuardada != null && (
            <span>
              · precio por unidad: <strong>{formatQ(unidadGuardada)}</strong> (disponibles en el
              punto de venta)
            </span>
          )}
          <button className="btn-mini" onClick={goHistorial}>
            📋 Ver en Cotizaciones
          </button>
        </div>
      )}
      {avisoTanda && (
        <div className="banner-cotiza">{avisoTanda}</div>
      )}
      {errConfig && (
        <div className="alerta-roja" style={{ marginBottom: "1rem" }}>
          No se conectó a Supabase: revisa URL/anon key y tu red. {String(errConfig)}
        </div>
      )}
      {error && <div className="alerta-roja" style={{ marginBottom: "1rem" }}>{error}</div>}

      <div className="cotizador-grid">
      <form className="cotizador-form" onSubmit={onGuardar}>
          <fieldset className="inputs">
            <legend>1 · PEDIDO</legend>
            <div className="inner">
              <label className="input-label">
                Fecha
                <input
                  className="input-amarillo"
                  type="date"
                  value={form.fecha ?? ""}
                  onChange={(e) => set("fecha", e.target.value)}
                />
              </label>
              <label className="input-label">
                Cliente
                <input
                  className="input-amarillo"
                  value={form.cliente ?? ""}
                  placeholder="(por definir)"
                  onChange={(e) => set("cliente", e.target.value)}
                />
              </label>
              <label className="input-label">
                Producto
                <input
                  className="input-amarillo"
                  required
                  value={form.producto ?? ""}
                  placeholder="p. ej. Espada Maestra"
                  onChange={(e) => set("producto", e.target.value)}
                  onBlur={(e) => autocompletarProducto(e.target.value)}
                />
              </label>
            </div>
          </fieldset>

          <fieldset className="inputs">
            <legend>2 · IMPRESIÓN</legend>
            <div className="inner">
              <div className="input-dos">
                <label className="input-label">
                  Material
                  <select
                    className="input-amarillo"
                    value={form.material_usado || ""}
                    onChange={(e) => set("material_usado", e.target.value)}
                  >
                    {(materiales ?? []).map((m) => (
                      <option key={m.nombre} value={m.nombre}>
                        {m.nombre} · {formatQ(m.costo_qg)}/g
                      </option>
                    ))}
                  </select>
                </label>
                <label className="input-label">
                  Impresora
                  <select
                    className="input-amarillo"
                    value={form.impresora}
                    onChange={(e) => set("impresora", e.target.value)}
                  >
                    {IMPRESORAS_POR_TIPO[form.tipo].map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="input-dos">
                {usarDesglose && sumaBand ? (
                  <>
                    <label className="input-label">
                      <span>Bandejas</span>
                      <input className="input-plano" value={sumaBand.bandejas} disabled readOnly />
                    </label>
                    <label className="input-label">
                      <span>Gramos (total)</span>
                      <input
                        className="input-plano"
                        value={sumaBand.gramos}
                        disabled
                        readOnly
                      />
                    </label>
                  </>
                ) : (
                  <>
                    <MoneyInput
                      label="Bandejas/camas"
                      value={form.bandejas}
                      step={1}
                      min={1}
                      onChange={(v) => set("bandejas", v)}
                    />
                    <MoneyInput
                      label="Gramos (total)"
                      value={form.gramos}
                      onChange={(v) => set("gramos", v)}
                    />
                  </>
                )}
              </div>

              {usarDesglose ? (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table className="grid">
                      <thead>
                        <tr>
                          <th>Bandeja</th><th style={{ width: 90 }}>Gramos</th>
                          <th style={{ width: 96 }}>H imp</th>
                          <th style={{ width: 88 }}>H MO</th>
                          <th style={{ width: 88 }}>H pintura</th>
                          <th style={{ width: 60 }}>×N</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {bandejasDetalle.map((b, i) => (
                          <tr key={i}>
                            <td className="muted" style={{ fontWeight: 700 }}>
                              #{i + 1}
                              {Number(b.n) > 1 ? <span> (×{b.n})</span> : null}
                            </td>
                            <td>
                              <input
                                className="input-amarillo"
                                type="number"
                                step="0.01"
                                min={0}
                                style={{ width: 90 }}
                                value={b.gramos ?? ""}
                                onChange={(e) =>
                                  setBandejasDetalle((bs) =>
                                    bs.map((b2, j) =>
                                      j === i ? { ...b2, gramos: e.target.value === "" ? null : Number(e.target.value) } : b2
                                    )
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input-amarillo"
                                type="number"
                                step="0.01"
                                min={0}
                                style={{ width: 94 }}
                                value={b.horas_impresion ?? ""}
                                onChange={(e) =>
                                  setBandejasDetalle((bs) =>
                                    bs.map((b2, j) =>
                                      j === i ? { ...b2, horas_impresion: e.target.value === "" ? null : Number(e.target.value) } : b2
                                    )
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input-amarillo"
                                type="number"
                                step="0.01"
                                min={0}
                                style={{ width: 84 }}
                                value={b.horas_mo ?? 0}
                                onChange={(e) =>
                                  setBandejasDetalle((bs) =>
                                    bs.map((b2, j) =>
                                      j === i ? { ...b2, horas_mo: e.target.value === "" ? 0 : Number(e.target.value) } : b2
                                    )
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input-amarillo"
                                type="number"
                                step="0.01"
                                min={0}
                                style={{ width: 84 }}
                                value={b.horas_pintura ?? 0}
                                onChange={(e) =>
                                  setBandejasDetalle((bs) =>
                                    bs.map((b2, j) =>
                                      j === i ? { ...b2, horas_pintura: e.target.value === "" ? 0 : Number(e.target.value) } : b2
                                    )
                                  )
                                }
                              />
                            </td>
                            <td>
                              <input
                                className="input-amarillo"
                                type="number"
                                min={1}
                                step={1}
                                style={{ width: 56 }}
                                value={b.n ?? 1}
                                title="N impresiones idénticas con estos parámetros"
                                onChange={(e) =>
                                  setBandejasDetalle((bs) =>
                                    bs.map((b2, j) =>
                                      j === i ? { ...b2, n: Number(e.target.value) } : b2
                                    )
                                  )
                                }
                              />
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn-peligro"
                                style={{ padding: ".25rem .55rem", fontSize: ".8rem" }}
                                onClick={() =>
                                  setBandejasDetalle((bs) => bs.filter((_, j) => j !== i))
                                }
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
                    <button
                      type="button"
                      className="btn-mini"
                      onClick={() =>
                        setBandejasDetalle((bs) => [
                          ...bs,
                          { n: 1, gramos: null, horas_impresion: null, horas_mo: 0.25, horas_pintura: 0 },
                        ])
                      }
                    >
                      + Agregar bandeja
                    </button>
                    <button type="button" className="btn-mini" onClick={() => setUsarDesglose(false)}>
                      Modo simple (totales)
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="input-dos">
                    <MoneyInput
                      label="Horas impresión (total)"
                      value={form.horas_impresion}
                      onChange={(v) => set("horas_impresion", v)}
                    />
                    <MoneyInput
                      label="Horas mano de obra (total)"
                      value={form.horas_mo}
                      onChange={(v) => set("horas_mo", v)}
                    />
                  </div>
                  <div className="input-dos">
                    <MoneyInput
                      label="Horas pintura (total)"
                      value={form.horas_pintura}
                      onChange={(v) => set("horas_pintura", v)}
                    />
                    <label className="input-label">
                      <span style={{ visibility: "hidden" }}>.</span>
                      <button type="button" className="btn-mini" onClick={() => {
                        setUsarDesglose(true);
                        setBandejasDetalle((bs) =>
                          bs.length
                            ? bs
                            : [{ n: Math.max(1, Number(form.bandejas) || 1), gramos: form.gramos, horas_impresion: form.horas_impresion, horas_mo: form.horas_mo, horas_pintura: form.horas_pintura }]
                        );
                      }}>
                        Desglosar en bandejas
                      </button>
                    </label>
                  </div>
                </>
              )}
              <div className="input-dos">
                <label className="input-label">
                  Pintado
                  <select
                    className="input-amarillo"
                    value={form.pintado ? "Sí" : "No"}
                    onChange={(e) => set("pintado", e.target.value === "Sí")}
                  >
                    <option value="No">No</option>
                    <option value="Sí">Sí</option>
                  </select>
                </label>
              </div>

              <div style={{ overflowX: "auto", marginTop: ".3rem" }}>
                <table className="grid">
                  <thead>
                    <tr>
                      <th>Material</th><th style={{ width: 95 }}>Gramos</th>
                      <th style={{ width: 80 }}>Q/g</th><th>Costo</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {matsUsados.map((mu, i) => {
                      const mat = materiales.find((m) => m.nombre === mu.material);
                      const cgs = mat ? Number(mat.costo_qg) : 0;
                      const gs = Number(mu.gramos) || 0;
                      return (
                        <tr key={i}>
                          <td>
                            <select
                              className="input-amarillo"
                              value={mu.material}
                              onChange={(e) =>
                                setMatsUsados((ms) => ms.map((m2, j) => (j === i ? { ...m2, material: e.target.value } : m2)))
                              }
                            >
                              {(materiales ?? []).map((m) => (
                                <option key={m.nombre} value={m.nombre}>
                                  {m.nombre}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <input
                              className="input-amarillo"
                              type="number"
                              step="0.01"
                              min={0}
                              style={{ width: 90 }}
                              value={mu.gramos ?? ""}
                              onChange={(e) =>
                                setMatsUsados((ms) => ms.map((m2, j) => (j === i ? { ...m2, gramos: e.target.value === "" ? null : Number(e.target.value) } : m2)))
                              }
                            />
                          </td>
                          <td className="muted">{formatQ(cgs)}</td>
                          <td><strong>{formatQ(redondeo2(cgs * gs))}</strong></td>
                          <td>
                            <button
                              type="button"
                              className="btn-peligro"
                              style={{ padding: ".25rem .55rem", fontSize: ".8rem" }}
                              onClick={() => setMatsUsados((ms) => ms.filter((_, j) => j !== i))}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn-mini"
                  onClick={() =>
                    setMatsUsados((ms) => [
                      ...ms,
                      { material: (materiales ?? [])[ms.length]?.nombre || "PLA", gramos: null },
                    ])
                  }
                >
                  + Agregar material
                </button>
                {matsUsados.length > 1 && (
                  <span className="muted" style={{ alignSelf: "center", fontWeight: 700 }}>
                    Σ gramos: {formatQ(matsUsados.reduce((s, m) => s + (Number(m.gramos) || 0), 0))} g
                    · Σ costo: {formatQ(redondeo2(matsUsados.reduce((s, m) => {
                      const mat = materiales.find((mm) => mm.nombre === m.material);
                      return s + (Number(mat?.costo_qg) || 0) * (Number(m.gramos) || 0);
                    }, 0)))}
                  </span>
                )}
              </div>

              <label style={{ display: "flex", gap: ".45rem", alignItems: "center", fontWeight: 700, fontSize: ".85rem" }}>
                <input
                  type="checkbox"
                  checked={esBandeja}
                  onChange={(e) => {
                    setEsBandeja(e.target.checked);
                    if (!e.target.checked) { setMetodoCobro("total"); }
                    else if (piezas.length === 0) setPiezas([{ nombre: "", cantidad: 1 }]);
                  }}
                />
                Es una bandeja de impresión con múltiples piezas
              </label>

              {esBandeja && (
                <>
                  <div style={{ display: "flex", gap: ".5rem" }}>
                    {[
                      ["total", "Se vende el TOTAL de la bandeja"],
                      ["unidad", "Se vende POR UNIDAD (piezas)"],
                    ].map(([v, l]) => (
                      <label
                        key={v}
                        style={{
                          flex: 1, display: "flex", gap: ".35rem", alignItems: "center",
                          border: `1.5px solid ${metodoCobro === v ? "var(--verde)" : "var(--borde)"}`,
                          background: metodoCobro === v ? "var(--verde-claro)" : "#fff",
                          borderRadius: 8, padding: ".45rem .55rem", cursor: "pointer",
                          fontSize: ".8rem", fontWeight: 700,
                        }}
                      >
                        <input
                          type="radio"
                          name="metodo"
                          checked={metodoCobro === v}
                          onChange={() => setMetodoCobro(v)}
                        />
                        {l}
                      </label>
                    ))}
                  </div>
                  <div style={{ overflowX: "auto" }}>
                  <table className="grid">
                    <thead>
                      <tr><th>Pieza</th><th style={{ width: 84 }}>Cantidad</th><th></th></tr>
                    </thead>
                    <tbody>
                      {piezas.map((p, i) => (
                        <tr key={i}>
                          <td>
                            <input
                              className="input-amarillo"
                              style={{ minWidth: 150 }}
                              value={p.nombre ?? ""}
                              placeholder="nombre de la pieza"
                              onChange={(e) =>
                                setPiezas((ps) => ps.map((p2, j) => (j === i ? { ...p2, nombre: e.target.value } : p2)))
                              }
                            />
                          </td>
                          <td>
                            <input
                              className="input-amarillo"
                              type="number"
                              min={1}
                              step={1}
                              style={{ width: 64 }}
                              value={p.cantidad ?? 1}
                              onChange={(e) =>
                                setPiezas((ps) => ps.map((p2, j) => (j === i ? { ...p2, cantidad: Number(e.target.value) } : p2)))
                              }
                            />
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn-peligro"
                              style={{ padding: ".25rem .55rem", fontSize: ".8rem" }}
                              onClick={() => setPiezas((ps) => ps.filter((_, j) => j !== i))}
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                  <button
                    type="button"
                    className="btn-mini"
                    onClick={() => setPiezas((ps) => [...ps, { nombre: "", cantidad: 1 }])}
                  >
                    + Agregar pieza
                  </button>
                </>
              )}
            </div>
          </fieldset>

          <fieldset className="inputs">
            <legend>3 · SERVICIOS</legend>
            <div className="inner">
              <div className="input-dos">
                <label className="input-label">
                  Embalaje
                  <select
                    className="input-amarillo"
                    value={form.embalaje}
                    onChange={(e) => set("embalaje", e.target.value)}
                  >
                    <option value="Ninguno">Ninguno (entrega en mano)</option>
                    <option value="Pequeña">Pequeña ≤5 cm</option>
                    <option value="Mediana">Mediana 5–15 cm</option>
                    <option value="Grande">Grande &gt;15 cm</option>
                  </select>
                </label>
                <label className="input-label">
                  Factura
                  <select
                    className="input-amarillo"
                    value={form.factura ? "Sí" : "No"}
                    onChange={(e) => set("factura", e.target.value === "Sí")}
                  >
                    <option value="No">No</option>
                    <option value="Sí">Sí (agrega IVA 12%)</option>
                  </select>
                </label>
              </div>
              <MoneyInput
                label="Envío (costo real Q)"
                value={form.envio_q}
                onChange={(v) => set("envio_q", v)}
              />
            </div>
          </fieldset>

          <div className="accion-fija">
            <button
              className="btn-primario"
              style={{ width: "100%", padding: ".8rem" }}
              type="submit"
              disabled={guardando || !resultado}
            >
              {guardando
                ? "Guardando…"
                : editando
                  ? `GUARDAR EDICIÓN (${editando.folio})`
                  : "GUARDAR COTIZACIÓN"}
            </button>
          </div>
        </form>

        <div className="form-col-sticky">
          <CalcPanel r={resultado} />
          {esBandeja && metodoCobro === "unidad" && resultado && (
              <div className="calc-panel" style={{ background: "var(--morado-claro)", borderColor: "#d7bff5" }}>
              <h3 style={{ color: "var(--morado)" }}>VENTA POR UNIDAD</h3>
              <div className="calc-fila">
                <span style={{ color: "#4a148c" }}>Unidades totales</span>
                <strong>
                  {piezas.reduce((s, p) => s + (Math.max(1, Number(p.cantidad) || 1)), 0)}
                </strong>
              </div>
              <div className="calc-fila">
                <span style={{ color: "#4a148c" }}>Precio sugerido (total ÷ unidades)</span>
                <strong style={{ color: "#4a148c" }}>
                  {formatQ(
                    resultado.total_a_cobrar_q /
                      Math.max(1, piezas.reduce((s, p) => s + Math.max(1, Number(p.cantidad) || 1), 0))
                  )}
                </strong>
              </div>
              <label className="input-label" style={{ marginTop: ".4rem" }}>
                Precio por unidad (déjalo vacío para usar el sugerido)
                <input
                  className="input-amarillo"
                  type="number"
                  step="0.01"
                  min={0}
                  placeholder="automático"
                  value={precioUnidadInput}
                  onChange={(e) => setPrecioUnidadInput(e.target.value)}
                />
              </label>
              <div className="calc-fila muted">
                <span>
                  {precioUnidadInput !== ""
                    ? `Se venderá a ${formatQ(Number(precioUnidadInput))}`
                    : "Se venderá al precio sugerido"}
                </span>
              </div>
            </div>
          )}
          <StockPanel tipo={form.tipo} gramos={form.gramos} />
        </div>
      </div>
    </div>
  );
}









