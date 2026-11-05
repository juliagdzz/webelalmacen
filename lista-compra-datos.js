// La lista de la compra de Mis creaciones: se guarda en el móvil (localStorage
// «listaCompra») y, con cuenta, viaja con ella como los demás ajustes (nube.js).
// La usan compra.js y la lupa de Mis creaciones («Añadir a la lista de la compra»).
// Cada cosa: { id, nombre, tipo: "esmalte"|"pasta"|"herramienta"|"otro", marca, detalle,
//              url, miniatura, cantidad, nota, comprado, creado }

(() => {
  const CLAVE = "listaCompra";
  const leer = () => {
    try {
      const lista = JSON.parse(localStorage.getItem(CLAVE));
      return Array.isArray(lista) ? lista : [];
    } catch {
      return [];
    }
  };
  const guardar = (lista) => {
    try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch {}
  };
  const igual = (a, b) => a.nombre.toLowerCase() === b.nombre.toLowerCase() && (a.marca ?? "") === (b.marca ?? "");

  // Devuelve false si ya estaba por comprar (si estaba comprada, vuelve a la lista)
  function anadir(cosa) {
    const lista = leer();
    const ya = lista.find((x) => igual(x, cosa));
    if (ya && !ya.comprado) return false;
    if (ya) ya.comprado = false;
    else lista.unshift({ id: crypto.randomUUID?.() ?? String(Date.now()), tipo: "otro", cantidad: "", nota: "", comprado: false, creado: Date.now(), ...cosa });
    guardar(lista);
    return true;
  }

  window.listaCompra = { leer, guardar, anadir, pendientes: () => leer().filter((x) => !x.comprado).length };
})();
