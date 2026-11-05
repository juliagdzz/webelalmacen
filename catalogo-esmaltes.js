// El catálogo de esmaltes (/api/esmaltes), el mismo en tableros, piezas, el
// almacén y la lupa. Se guarda en el móvil para que salga al momento. Si un día
// llega sin alguna marca (porque su tienda no respondió), no sustituye a la buena:
// se completa con los de esa marca que ya había en el móvil.

(() => {
  const MARCAS = ["Prodesco", "Tecniglaze"];
  // Por debajo de esto, la lista de esa marca llegó a medias (hoy son unos 540 y 208)
  const MINIMOS = { Prodesco: 400, Tecniglaze: 150 };
  const CLAVE = "catalogoEsmaltes";

  const cuantos = (lista, marca) => (Array.isArray(lista) ? lista.filter((e) => e.marca === marca).length : 0);
  const completo = (lista) => MARCAS.every((m) => cuantos(lista, m) >= MINIMOS[m]);
  function guardada() {
    try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; }
  }
  function juntar(nueva, vieja) {
    if (!Array.isArray(vieja)) return nueva;
    // de cada marca, la lista que traiga más (la nueva si está entera)
    return MARCAS.flatMap((m) => (cuantos(nueva, m) >= Math.min(MINIMOS[m], cuantos(vieja, m)) ? nueva : vieja).filter((e) => e.marca === m));
  }

  // La lista nueva, completada si hace falta; se guarda salvo que sea peor que la del móvil
  async function pedir() {
    const vieja = guardada();
    // sin usar lo que el navegador tenga guardado de antes; si aun así llega a medias,
    // otra vez con una dirección nueva (la función vuelve a preguntar a las tiendas)
    const traer = async (url) => {
      const r = await fetch(url, { cache: "no-cache" });
      if (!r.ok) throw new Error("sin catálogo");
      return r.json();
    };
    let nueva = await traer("/api/esmaltes");
    if (!completo(nueva)) nueva = await traer(`/api/esmaltes?r=${Date.now()}`).catch(() => nueva);
    const lista = juntar(nueva, vieja);
    if (completo(lista) || !completo(vieja)) {
      try { localStorage.setItem(CLAVE, JSON.stringify(lista)); } catch {}
    }
    return lista;
  }

  window.catalogoEsmaltes = { MARCAS, completo, guardada, pedir };
})();
