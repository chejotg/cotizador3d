-- Crear la plantilla del "Combo grinch" desde la venta VT-001 (3 piezas × 1, precio Q75)
insert into combo_guardado (owner_id, nombre, nota, lineas, precio)
select v.owner_id, 'Combo grinch', 'de la venta VT-001',
       (select jsonb_agg(jsonb_build_object('cot_folio', l.cot_folio,
                                            'pieza_id', l.pieza_id,
                                            'unidades', l.unidades))
          from venta_combo_linea l where l.folio_venta = 'VT-001'),
       v.total_q
  from venta v where v.folio = 'VT-001'
on conflict (owner_id, nombre) do update set lineas = excluded.lineas, precio = excluded.precio;
