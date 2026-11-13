export { redondeo2 } from "./pricing.js";

export function formatQ(value) {
  const n = Number(value) || 0;
  return (
    "Q" +
    n.toLocaleString("es-GT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
}

export function hoyISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
