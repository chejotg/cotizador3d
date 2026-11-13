export default function MoneyInput({ label, value, onChange, step = 0.01, min = 0, placeholder }) {
  return (
    <label className="input-label">
      {label}
      <input
        className="input-amarillo"
        type="number"
        step={step}
        min={min}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        inputMode="decimal"
      />
    </label>
  );
}
