import { useState } from "react";
import { useAuth } from "../auth.jsx";

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await signIn(email, password);
    setBusy(false);
    if (error) setError(`No se pudo entrar: ${error.message}`);
  }

  return (
    <div className="login-wrap">
      <form className="login-box" onSubmit={onSubmit}>
        <h2>COTIZADOR 3D</h2>
        <p className="muted">Acceso privado del propietario</p>
        <label>
          Email
          <input
            type="email"
            value={email}
            required
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            required
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error && <div className="alerta-roja">{error}</div>}
        <button className="btn-primario" disabled={busy} type="submit">
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}
