import { formatQ } from "../format.js";

const FILAS = [
  ["material_q", "Material"],
  ["maquina_q", "Máquina"],
  ["mano_obra_q", "Mano de obra"],
  ["consumibles_q", "Consumibles"],
  ["acabado_q", "Acabado (pintado)"],
  ["embalaje_q", "Embalaje"],
  ["subtotal_q", "Subtotal"],
  ["margen_q", "Margen 40%"],
];

export default function CalcPanel({ r }) {
  if (!r) return <div className="calc-panel muted">Llena el formulario para ver el cálculo…</div>;
  return (
    <div className="calc-panel">
      <h3>RESULTADOS</h3>
      {FILAS.map(([k, label]) => (
        <div className="calc-fila" key={k}>
          <span>{label}</span>
          <strong>{formatQ(r[k])}</strong>
        </div>
      ))}
      <div className="calc-fila total destacada">
        <span>TOTAL sin IVA</span>
        <strong>{formatQ(r.total_sin_iva_q)}</strong>
      </div>
      <div className="calc-fila total destacada">
        <span>Con factura (IVA 12%)</span>
        <strong>{formatQ(r.con_factura_q)}</strong>
      </div>
      <div className="calc-fila total destacada">
        <span>TOTAL a cobrar (+ envío)</span>
        <strong>{formatQ(r.total_a_cobrar_q)}</strong>
      </div>
    </div>
  );
}
