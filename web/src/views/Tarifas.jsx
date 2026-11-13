import { useEffect, useState } from "react";
import { supabase } from "../services/supabase.js";
import { updateTarifa } from "../services/tarifas.js";

const GRUPOS = [
  {
    titulo: "🧱 MATERIALES",
    claves: ["resina_qg", "pla_qg", "desperdicio"],
    nota: "Precio por gramo + factor de desperdicio (fallo/soportes)",
  },
  {
    titulo: "🖨️ IMPRESORAS (Q/h)",
    claves: ["tarifa_saturn4", "tarifa_saturn3", "tarifa_creator5"],
    nota: "Luz + depreciación + repuestos",
  },
  {
    titulo: "🛠️ SERVICIOS",
    claves: ["mo_qh", "cons_bandeja", "cons_trabajo", "primer_qfig", "barniz_qfig", "pinturas_qfig",
      "embalaje_pequeña", "embalaje_mediana", "embalaje_grande"],
    nota: "Mano de obra, consumibles de resina, acabados y embalaje",
  },
  {
    titulo: "💵 MÁRGENES E IMPUESTOS",
    claves: ["margen", "iva"],
    nota: "40% sobre subtotal; IVA solo con factura",
  },
];

export default function Tarifas() {
  const [rows, setRows] = useState(null);
  const [productos, setProductos] = useState(null);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const cargar = async () => {
    try {
      const [t, p] = await Promise.all([
        supabase.from("tarifa").select("clave,valor,unidad,nota").order("clave"),
        supabase.from("producto").select("nombre,precio_sin_iva,nota").order("nombre"),
      ]);
      if (t.error) throw t.error;
      if (p.error) throw p.error;
      setRows(t.data ?? []);
      setProductos(p.data ?? []);
    } catch (e) {
      setError(String(e.message || e));
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  async function guardar(clave, valor) {
    try {
      await updateTarifa(clave, valor);
      setOk(`${clave} actualizado — la próxima cotización usa el valor nuevo`);
      setTimeout(() => setOk(""), 3000);
      cargar();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  async function guardarPrecio(nombre, valor) {
    try {
      const { error: err } = await supabase
        .from("producto")
        .update({ precio_sin_iva: Number(valor) })
        .eq("nombre", nombre);
      if (err) throw err;
      setOk(`${nombre} actualizado`);
      setTimeout(() => setOk(""), 3000);
      cargar();
    } catch (e) {
      setError(String(e.message || e));
    }
  }

  const porClave = Object.fromEntries((rows ?? []).map((r) => [r.clave, r]));

  return (
    <div>
      {error && <div className="alerta-roja" style={{ marginBottom: "1rem" }}>{error}</div>}
      {ok && <div className="aviso-info aviso-ok" style={{ marginBottom: "1rem" }}>✓ {ok}</div>}
      <div className="banner-cotiza">
        Cambiar una tarifa afecta las <strong>próximas</strong> cotizaciones; las históricas mantienen su
        snapshot y no se recalculan.
      </div>

      {GRUPOS.map((g) => (
        <details className="accordion" open={g.titulo.includes("MATERIALES")} key={g.titulo}>
          <summary>
            {g.titulo} <span className="muted">{g.nota}</span>
          </summary>
          <div className="accordion-body">
            <table className="grid">
              <thead>
                <tr><th>Concepto</th><th>Valor</th><th>Unidad</th><th>Glosa</th></tr>
              </thead>
              <tbody>
                {g.claves.map((clave) => {
                  const r = porClave[clave];
                  if (!r) return null;
                  return (
                    <tr key={r.clave}>
                      <td><strong>{r.clave}</strong></td>
                      <td>
                        <input
                          className="input-amarillo"
                          type="number"
                          step="0.0001"
                          style={{ width: 110 }}
                          defaultValue={Number(r.valor)}
                          onBlur={(e) => guardar(r.clave, e.target.value)}
                        />
                      </td>
                      <td>{r.unidad}</td>
                      <td className="muted">{r.nota}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      ))}

      <details className="accordion">
        <summary>🛒 CATÁLOGO DE VENTA <span className="muted">precios que muestra el punto de venta</span></summary>
        <div className="accordion-body">
          <table className="grid">
            <thead>
              <tr><th>Producto</th><th>Precio sin IVA</th><th>Con factura (×1.12)</th><th>Nota</th></tr>
            </thead>
            <tbody>
              {(productos ?? []).map((p) => (
                <tr key={p.nombre}>
                  <td><strong>{p.nombre}</strong></td>
                  <td>
                    <input
                      className="input-amarillo"
                      type="number"
                      step="0.01"
                      style={{ width: 110 }}
                      defaultValue={Number(p.precio_sin_iva)}
                      onBlur={(e) => guardarPrecio(p.nombre, e.target.value)}
                    />
                  </td>
                  <td>{(Number(p.precio_sin_iva) * 1.12).toFixed(2).replace(".", ",")}</td>
                  <td className="muted">{p.nota}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
