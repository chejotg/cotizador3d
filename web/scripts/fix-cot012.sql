-- Restaurar COT-012 como bandeja vendida POR UNIDAD (12 árboles, Q12.13 c/u)
update cotizacion
   set es_bandeja = true,
       metodo_cobro = 'unidad',
       precio_venta_unidad = 12.13
 where folio = 'COT-012';

delete from cotizacion_pieza where folio = 'COT-012';
insert into cotizacion_pieza (owner_id, folio, nombre, cantidad)
select id, 'COT-012', 'Árbol navideño', 12 from auth.users order by created_at limit 1;
