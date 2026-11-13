// Store transitorio de cotización en edición (comunica Historial → Cotizador sin almacenar en disco).
// mutate/importa el orden de eventos: Historial setea; Cotizador consume al montar o al recibir 'cot-edit-load'.
let pendiente = null; // { folio, datos }

export function setEditPendiente(p) {
  pendiente = p;
}

export function consumirEditPendiente() {
  const p = pendiente;
  pendiente = null;
  return p;
}

export function tieneEditPendiente() {
  return pendiente !== null;
}
