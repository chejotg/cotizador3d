import bcrypt from "bcryptjs";

const nueva = "Chejo,2026$#";
const hash = bcrypt.hashSync(nueva, 10);
console.log(hash);
