// El catálogo de esmaltes (/api/esmaltes), el mismo en tableros, piezas, el
// almacén y la lupa. Se guarda en el móvil para que salga al momento. Si un día
// llega sin alguna marca (porque su tienda no respondió), no sustituye a la buena:
// se completa con los de esa marca que ya había en el móvil.

(() => {
  const MARCAS = ["Prodesco", "Tecniglaze"];
  const CLAVE = "catalogoEsmaltes";

  const completo = (lista) => Array.isArray(lista) && MARCAS.every((m) => lista.some((e) => e.marca === m));
  function guardada() {
    try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; }
  }
  function juntar(nueva, vieja) {
    if (!Array.isArray(vieja)) return nueva;
    const faltan = MARCAS.filter((m) => !nueva.some((e) => e.marca === m));
    return faltan.length ? [...nueva, ...vieja.filter((e) => faltan.includes(e.marca))] : nueva;
  }

  // La lista nueva, completada si hace falta; se guarda salvo que sea peor que la del móvil
  async function pedir() {
    const vieja = guardada();
    const r = await fetch("/api/esmaltes");
    if (!r.ok) throw new Error("sin catálogo");
    const lista = juntar(await r.json(), vieja);
    if (completo(lista) || !completo(vieja)) {
      try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch {}
    }
    return lista;
  }

  window.catalogoEsmaltes = { MARCAS, completo, guardada, pedir };
})();
