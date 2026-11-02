// La lupa de Mis creaciones: busca en los esmaltes (Prodesco y Tecniglaze, los
// mismos que en los tableros) y en las pastas de pastas.json. Al tocar uno se
// abre su ficha. Los catálogos se cargan la primera vez que abres la lupa.

(() => {
  const $ = (sel) => document.querySelector(sel);
  const MAXIMO = 20; // por grupo; si hay más, que afine
  const sinAcentos = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  function h(etiqueta, props = {}, ...hijos) {
    const el = document.createElement(etiqueta);
    for (const [k, v] of Object.entries(props)) {
      if (v == null || v === false) continue;
      if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else if (k === "class") el.className = v;
      else el.setAttribute(k, v);
    }
    el.append(...hijos.flat().filter((x) => x != null && x !== false));
    return el;
  }

  // ---------- Catálogos ----------
  let catalogos = null;
  function cargar() {
    catalogos ??= Promise.all([cargarEsmaltes(), fetch("pastas.json").then((r) => r.json()).catch(() => [])])
      .then(([esmaltes, pastas]) => ({
        esmaltes: esmaltes.map((e) => ({ ...e, texto: sinAcentos(`${e.codigo} ${e.nombre} ${e.marca} ${e.serie}`) })),
        pastas: pastas.map((p) => ({ ...p, texto: sinAcentos(`${p.nombre} ${p.marca} ${p.tipo} ${p.descripcion}`) })),
      }));
    return catalogos;
  }
  // Los esmaltes, como en los tableros: lo guardado en el móvil y, por detrás, la lista nueva
  async function cargarEsmaltes() {
    let lista = null;
    try { lista = JSON.parse(localStorage.getItem("catalogoEsmaltes")); } catch {}
    const nueva = fetch("/api/esmaltes").then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((l) => { try { localStorage.setItem("catalogoEsmaltes", JSON.stringify(l)); } catch {} return l; });
    if (Array.isArray(lista) && lista.length) { nueva.catch(() => {}); return lista; }
    return nueva.catch(() => []);
  }

  // Todas las palabras tienen que estar; primero lo que empieza por lo que escribes
  function buscar(lista, consulta, campoNombre) {
    const palabras = sinAcentos(consulta).split(/\s+/).filter(Boolean);
    const primera = palabras[0];
    return lista
      .filter((x) => palabras.every((p) => x.texto.includes(p)))
      .map((x) => ({ x, puntos: sinAcentos(campoNombre(x)).startsWith(primera) ? 0 : sinAcentos(campoNombre(x)).includes(primera) ? 1 : 2 }))
      .sort((a, b) => a.puntos - b.puntos)
      .map(({ x }) => x);
  }

  // ---------- Resultados ----------
  async function pintar() {
    const consulta = $("#buscar-catalogo").value.trim();
    const estado = $("#estado-busqueda");
    const caja = $("#resultados-catalogo");
    if (consulta.length < 2) {
      caja.replaceChildren();
      estado.textContent = "Busca entre los esmaltes de Prodesco y Tecniglaze y las pastas de SIO-2, Vicar, La Bisbal…";
      return;
    }
    estado.textContent = "Buscando…";
    const { esmaltes, pastas } = await cargar();
    if (consulta !== $("#buscar-catalogo").value.trim()) return; // ya has escrito otra cosa
    const e = buscar(esmaltes, consulta, (x) => `${x.codigo} ${x.nombre}`);
    const p = buscar(pastas, consulta, (x) => x.nombre);
    estado.textContent = e.length || p.length ? "" : `No encuentro «${consulta}». Prueba con el código o una parte del nombre.`;
    const grupo = (titulo, lista, fila) => lista.length && h("section", { class: "grupo-resultados" },
      h("h2", {}, titulo, h("small", {}, ` ${lista.length}`)),
      h("ul", {}, lista.slice(0, MAXIMO).map(fila)),
      lista.length > MAXIMO && h("p", { class: "mas" }, `Y ${lista.length - MAXIMO} más: escribe algo más para afinar.`));
    caja.replaceChildren(...[
      grupo("Esmaltes", e, (x) => h("li", {}, h("button", { type: "button", class: "resultado", onclick: () => fichaEsmalte(x) },
        h("img", { src: x.miniatura || x.muestra, alt: "", loading: "lazy" }),
        h("span", {}, h("strong", {}, [x.codigo, x.nombre].filter(Boolean).join(" ")), h("small", {}, `${x.marca} · ${x.serie}`))))),
      grupo("Pastas", p, (x) => h("li", {}, h("button", { type: "button", class: "resultado", onclick: () => fichaPasta(x) },
        window.selloMarca ? window.selloMarca(x.marca) : null,
        h("span", {}, h("strong", {}, x.nombre), h("small", {}, [x.marca, x.tipo, x.coccion].filter(Boolean).join(" · ")))))),
    ].filter(Boolean));
  }

  // ---------- Fichas ----------
  const num = (n) => Number(n).toLocaleString("es-ES");
  const dato = (nombre, valor) => (valor || valor === 0 ? [h("dt", {}, nombre), h("dd", {}, String(valor))] : []);
  const enlaceTienda = (url, marca) => url && h("a", { class: "boton secundario", href: url, target: "_blank", rel: "noopener" }, `Ver en ${marca} ↗`);

  function abrirFicha(...contenido) {
    $("#contenido-catalogo").replaceChildren(...contenido.flat().filter(Boolean));
    $("#ficha-catalogo").showModal();
    $("#ficha-catalogo").scrollTop = 0;
  }

  function fichaEsmalte(e) {
    abrirFicha(
      h("img", { class: "muestra-ficha", src: e.muestra || e.miniatura, alt: `Muestra de ${e.nombre}` }),
      h("h2", { id: "titulo-ficha-catalogo" }, e.nombre),
      h("dl", { class: "datos-ficha" }, ...dato("Marca", e.marca), ...dato("Serie", e.serie), ...dato("Código", e.codigo)),
      e.plomo && h("p", { class: "nota-plomo" }, "Lleva plomo: no lo uses en piezas para comer o beber."),
      h("div", { class: "acciones-ficha" }, enlaceTienda(e.url, e.marca)));
  }

  function fichaPasta(p) {
    const contracciones = (p.cocciones ?? []).map((c) => `${num(c.contraccion)} % a ${c.temperatura} ºC`).join(" · ");
    const calcula = p.secado != null && p.cocciones?.length;
    abrirFicha(
      h("p", { class: "marca-ficha" }, window.selloMarca ? window.selloMarca(p.marca) : null, p.marca),
      h("h2", { id: "titulo-ficha-catalogo" }, p.nombre),
      p.descripcion && h("p", {}, p.descripcion),
      h("dl", { class: "datos-ficha" },
        ...dato("Tipo", p.tipo),
        ...dato("Cocción", p.coccion),
        ...dato("Chamota", p.chamota),
        ...dato("Contracción al secar", p.secado != null ? `${num(p.secado)} %` : null),
        ...dato("Contracción al cocer", contracciones),
        ...dato("Porosidad", p.porosidad != null ? `${num(p.porosidad)} %` : null),
        ...dato("Dónde comprarla", p.tienda && p.tienda !== p.marca ? p.tienda : null)),
      h("div", { class: "acciones-ficha" },
        calcula && h("a", { class: "boton", href: `medidas.html?pasta=${encodeURIComponent(p.id)}` }, "Calcular medidas con esta pasta"),
        enlaceTienda(p.url, p.tienda || p.marca)));
  }

  // ---------- Abrir y cerrar ----------
  function mostrar(abierto) {
    $("#buscador").hidden = !abierto;
    $("#abrir-buscador").setAttribute("aria-expanded", String(abierto));
    if (abierto) { $("#buscar-catalogo").focus(); cargar(); }
    else { $("#buscar-catalogo").value = ""; pintar(); $("#abrir-buscador").focus(); }
  }
  $("#abrir-buscador").addEventListener("click", () => mostrar($("#buscador").hidden));
  $("#cerrar-buscador").addEventListener("click", () => mostrar(false));
  let espera;
  $("#buscar-catalogo").addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(pintar, 150); });
  $("#buscar-catalogo").addEventListener("keydown", (ev) => { if (ev.key === "Escape" && !$("#buscar-catalogo").value) mostrar(false); });
  const ficha = $("#ficha-catalogo");
  ficha.querySelector(".cerrar-ficha").addEventListener("click", () => ficha.close());
  ficha.addEventListener("click", (ev) => ev.target === ficha && ficha.close());
})();
