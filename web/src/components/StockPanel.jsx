import { useEffect, useState } from "react";
import { fetchSaldosMaterial } from "../services/cotizaciones.js";

// Material descontable por tipo: PLA → material 'PLA'; Resina → 'Resina Sunlu'
const MATERIAL_POR_TIPO = { PLA: "PLA", Resina: "Resina Sunlu" };
const fmtCant = (n) =>
  (Number(n) || 0).toLocaleString("es-GT", { maximumFractionDigits: 2 });

export default function StockPanel({ tipo, gramos }) {
  const [saldos, setSaldos] = useState(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetchSaldosMaterial()
      .then(setSaldos)
      .catch(() => setErr(true));
  }, []);

  if (err || !saldos) return null;
  const mat = saldos.find((s) => s.nombre === MATERIAL_POR_TIPO[tipo]);
  if (!mat) return null;

  const saldo = Number(mat.saldo) || 0;
  const hayGramos = Number(gramos) > 0;
  const despues = saldo - (Number(gramos) || 0);
  const negativo = hayGramos && despues < 0;

  return (
    <div className="stock-panel">
      <h3 style={{ margin: "0 0 .4rem", color: "#2e7d32" }}>STOCK RESULTANTE (si imprimes esto)</h3>
      {hayGramos ? (
        <div className="calc-fila">
          <span>{mat.nombre} después</span>
          <strong className={negativo ? "stock-negativo" : ""}>
            {fmtCant(despues)} {mat.unidad}
          </strong>
        </div>
      ) : (
        <div className="calc-fila">
          <span>Saldo actual de {mat.nombre}</span>
          <strong>{fmtCant(saldo)} {mat.unidad}</strong>
        </div>
      )}
      {hayGramos && !negativo && (
        <div className="calc-fila muted">
          <span>Hoy tienes</span>
          <span>{fmtCant(saldo)} {mat.unidad}</span>
        </div>
      )}
      {negativo && (
        <div className="alerta-roja" style={{ marginTop: ".5rem" }}>
          La pieza excede el inventario de {mat.nombre} — actualiza el stock inicial en Inventario.
        </div>
      )}
    </div>
  );
}
