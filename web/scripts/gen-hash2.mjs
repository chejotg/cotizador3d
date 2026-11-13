import bcrypt from "bcryptjs";

const nueva = "cotizador2026";
console.log(bcrypt.hashSync(nueva, 10));
