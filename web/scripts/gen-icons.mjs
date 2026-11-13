// Genera icon-192.png e icon-512.png con el nombre de la app
import { createCanvas } from "canvas";
import fs from "node:fs";

function generar(size, file) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext("2d");

  // fondo azul
  ctx.fillStyle = "#2f4358";
  ctx.fillRect(0, 0, size, size);

  // borde redondeado
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // texto
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `bold ${size * 0.18}px "Segoe UI", sans-serif`;
  ctx.fillText("COTIZADOR", size / 2, size * 0.38);
  ctx.font = `bold ${size * 0.22}px "Segoe UI", sans-serif`;
  ctx.fillText("3D", size / 2, size * 0.58);

  // impresora icono simple
  ctx.strokeStyle = "#8fa5b8";
  ctx.lineWidth = size * 0.02;
  const margin = size * 0.15;
  const w = size - margin * 2;
  // rectángulo impresora
  ctx.strokeRect(margin, size * 0.72, w, size * 0.12);
  // línea de impresión
  ctx.strokeRect(margin + w * 0.15, size * 0.87, w * 0.7, size * 0.06);

  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync(file, buf);
  console.log(`✓ ${file} (${size}x${size})`);
}

generar(192, "public/icon-192.png");
generar(512, "public/icon-512.png");
