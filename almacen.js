// Almacén del almacén: las pestañas (pastas, herramientas y esmaltes) y las
// pastas y herramientas del taller (tabla almacen). Los esmaltes los lleva
// inventario.js; de ahí se usan h(), avisar() y sinAcentos().

(() => {
  const nube = window.nube;
  const TIPOS = {
    pasta: { seccion: "pastas", uno: "pasta", varios: "pastas", vacio: "Aún no has apuntado ninguna pasta. Búscala abajo en el catálogo o escribe la tuya." },
    herramienta: { seccion: "herramientas", uno: "herramienta", varios: "herramientas", vacio: "Aún no has apuntado ninguna herramienta. Toca las de abajo para añadirlas." },
  };
  // Las de casi cualquier taller, para añadirlas de un toque
  const HERRAMIENTAS = ["Torneta", "Alambre de corte", "Vaciadores", "Estecas de madera", "Costillas de metal", "Costillas de goma",
    "Esponjas", "Agujas de cerámica", "Rodillo", "Listones guía", "Calibre", "Pinceles", "Pera de engobe", "Tamiz", "Balanza",
    "Batidora de esmalte", "Aerógrafo", "Placas de horno", "Estiletes de horno", "Conos pirométricos", "Guantes de horno",
    "Mascarillas FFP2", "Bolsas para el barro"];
  const ESTADOS = { hay: "Hay", poco: "Poco", no: "No hay" };
  const ICONO_HERRAMIENTA = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 19.5 8.5-8.5"/><path d="M13 11c.6-3.4 2.8-5.6 6.5-6.5-.9 3.7-3.1 5.9-6.5 6.5z"/><path d="m6.5 14.5 3 3"/></svg>';

  let filas = [];
  let catalogoPastas = null;
  let faltaTabla = false;
  const filtros = { pasta: "todo", herramienta: "todo" };
  const abiertas = new Set(); // filas con el editor abierto

  const deTipo = (tipo) => filas.filter((x) => x.tipo === tipo).sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
  const cuantas = (n, tipo) => `${n} ${n === 1 ? TIPOS[tipo].uno : TIPOS[tipo].varios}`;

  // ---------- Pestañas ----------
  const SECCIONES = ["pastas", "herramientas", "esmaltes"];
  function abrirSeccion(seccion, { guardar = true } = {}) {
    if (!SECCIONES.includes(seccion)) seccion = "pastas";
    for (const s of SECCIONES) {
      document.getElementById(`seccion-${s}`).hidden = s !== seccion;
      document.getElementById(`pestana-${s}`).setAttribute("aria-selected", String(s === seccion));
    }
    if (guardar) {
      try { localStorage.setItem("seccionAlmacen", seccion); } catch {}
      history.replaceState(null, "", `#${seccion}`);
    }
  }
  document.querySelectorAll("[data-seccion]").forEach((b) => b.addEventListener("click", () => abrirSeccion(b.dataset.seccion)));
  let inicial = location.hash.slice(1);
  if (!SECCIONES.includes(inicial)) { try { inicial = localStorage.getItem("seccionAlmacen"); } catch {} }
  abrirSeccion(inicial, { guardar: false });

  // Cuántos hay de cada cosa, en las pestañas
  function pintarCuentas() {
    for (const tipo of Object.keys(TIPOS)) {
      const n = deTipo(tipo).filter((x) => x.estado !== "no").length;
      document.getElementById(`n-${TIPOS[tipo].seccion}`).textContent = n ? String(n) : "";
    }
    const esmaltes = typeof inventario !== "undefined" ? inventario.size : 0;
    document.getElementById("n-esmaltes").textContent = esmaltes ? String(esmaltes) : "";
  }
  // inventario.js repinta su resumen cada vez que cambia algo: se aprovecha para la cuenta de su pestaña
  const resumenEsmaltes = window.pintarResumen;
  window.pintarResumen = (...args) => { resumenEsmaltes(...args); pintarCuentas(); };

  // ---------- Pintar una sección ----------
  function pintar(tipo) {
    const caja = document.querySelector(`.seccion-almacen[data-tipo="${tipo}"]`);
    const todas = deTipo(tipo);
    const poco = todas.filter((x) => x.estado === "poco").length;
    const acabadas = todas.filter((x) => x.estado === "no").length;
    if (!["todo", "poco", "no"].includes(filtros[tipo]) || (filtros[tipo] === "poco" && !poco) || (filtros[tipo] === "no" && !acabadas)) filtros[tipo] = "todo";
    const lista = todas.filter((x) => filtros[tipo] === "todo" || x.estado === filtros[tipo]);

    const resumen = h("p", { class: `resumen-inventario${faltaTabla ? " aviso-falta" : ""}` }, faltaTabla
      ? "Para guardar pastas y herramientas falta un paso en Supabase: vuelve a ejecutar supabase/esquema.sql (SQL Editor → pegar entero → Run) y recarga esta página."
      : todas.length
        ? [cuantas(todas.length - acabadas, tipo), poco && `queda poco de ${poco}`, acabadas && `${acabadas === 1 ? "se acabó 1" : `se acabaron ${acabadas}`}`].filter(Boolean).join(" · ")
        : TIPOS[tipo].vacio);
    const filtro = (valor, texto, n) => h("button", { type: "button", role: "tab", "aria-selected": String(filtros[tipo] === valor),
      onclick: () => { filtros[tipo] = valor; pintar(tipo); } }, texto, n != null && ` ${n}`);
    const barra = poco + acabadas > 0 && h("div", { class: "filtros-inventario", role: "tablist" },
      filtro("todo", "Todo", todas.length), poco > 0 && filtro("poco", "Queda poco", poco), acabadas > 0 && filtro("no", "Se acabó", acabadas));

    caja.replaceChildren(resumen, barra || "", h("ul", { class: "lista-inventario lista-almacen" }, lista.map(fila)), tipo === "pasta" ? anadirPasta() : anadirHerramienta());
    pintarCuentas();
  }
  const pintarTodo = () => Object.keys(TIPOS).forEach(pintar);

  function fila(x) {
    const icono = x.tipo === "pasta"
      ? window.selloMarca(x.marca || "Propia")
      : h("span", { class: "icono-herramienta" });
    if (x.tipo === "herramienta") icono.innerHTML = ICONO_HERRAMIENTA;
    const boton = (valor) => h("button", { type: "button", class: `estado-${valor}`, "aria-pressed": String(x.estado === valor),
      onclick: () => guardar(x, { estado: valor }, `${x.nombre}: ${valor === "hay" ? "hay ✓" : valor === "poco" ? "queda poco" : "se acabó"}`) }, ESTADOS[valor]);
    const abierta = abiertas.has(x.id);
    const li = h("li", { class: `fila-inv fila-almacen estado-${x.estado}` },
      h("span", { class: "muestra-inv" }, icono),
      h("button", { type: "button", class: "datos-inv editar-almacen", "aria-expanded": String(abierta), title: "Cambiar cantidad o nota",
        onclick: () => { abierta ? abiertas.delete(x.id) : abiertas.add(x.id); pintar(x.tipo); } },
        h("strong", {}, x.nombre),
        h("small", {}, [x.tipo === "pasta" && x.marca, x.cantidad, x.nota].filter(Boolean).join(" · ") || "Toca para apuntar cuánto hay")),
      h("span", { class: "estados-inv", role: "group", "aria-label": `${x.nombre}: ¿cuánto queda?` }, boton("hay"), boton("poco"), boton("no")));
    if (abierta) li.append(editor(x));
    return li;
  }

  function editor(x) {
    const cantidad = h("input", { type: "text", maxLength: 60, value: x.cantidad ?? "", placeholder: x.tipo === "pasta" ? "3 sacos de 12,5 kg" : "6" });
    const nota = h("input", { type: "text", maxLength: 300, value: x.nota ?? "", placeholder: x.tipo === "pasta" ? "En la estantería de abajo, para torno…" : "Las de madera de boj, una rota…" });
    return h("form", { class: "editor-almacen", onsubmit: async (ev) => {
      ev.preventDefault();
      const ok = await guardar(x, { cantidad: cantidad.value.trim() || null, nota: nota.value.trim() || null }, `${x.nombre}: guardado ✓`);
      if (ok) { abiertas.delete(x.id); pintar(x.tipo); }
    } },
      h("label", {}, "Cuánto hay", cantidad),
      h("label", {}, "Nota", nota),
      h("div", { class: "botones-editor" },
        h("button", { type: "submit", class: "boton" }, "Guardar"),
        h("button", { type: "button", class: "quitar-almacen", onclick: () => quitar(x) }, `Quitar del almacén`)));
  }

  // ---------- Añadir ----------
  function anadirPasta() {
    const campo = h("input", { type: "search", class: "buscar-inventario", autocomplete: "off", placeholder: "Añadir una pasta: PRAI, Europa, gres blanco…", "aria-label": "Añadir una pasta" });
    const sugerencias = h("ul", { class: "sugerencias-almacen" });
    const pintarSugerencias = async () => {
      const texto = campo.value.trim();
      if (texto.length < 2) return sugerencias.replaceChildren();
      catalogoPastas ??= fetch("pastas.json").then((r) => r.json()).catch(() => []);
      const catalogo = await catalogoPastas;
      if (texto !== campo.value.trim()) return;
      const palabras = sinAcentos(texto).split(/\s+/);
      const yaEstan = new Set(deTipo("pasta").map((x) => x.ref).filter(Boolean));
      const encontradas = catalogo.filter((p) => !yaEstan.has(String(p.id)) && palabras.every((w) => sinAcentos(`${p.nombre} ${p.marca} ${p.tipo}`).includes(w))).slice(0, 8);
      sugerencias.replaceChildren(
        ...encontradas.map((p) => h("li", {}, h("button", { type: "button", onclick: () => anadir({ tipo: "pasta", nombre: p.nombre, marca: p.marca, ref: String(p.id) }) },
          window.selloMarca(p.marca), h("span", {}, h("strong", {}, p.nombre), h("small", {}, [p.marca, p.tipo, p.coccion].filter(Boolean).join(" · ")))))),
        h("li", {}, h("button", { type: "button", class: "propia", onclick: () => anadir({ tipo: "pasta", nombre: texto }) },
          window.selloMarca("Propia"), h("span", {}, h("strong", {}, `Añadir «${texto}»`), h("small", {}, encontradas.length ? "Otra que no está en el catálogo" : "No está en el catálogo: se apunta tal cual")))));
    };
    let espera;
    campo.addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(pintarSugerencias, 150); });
    return h("div", { class: "anadir-almacen" }, h("h2", {}, "Añadir una pasta"), campo, sugerencias);
  }

  function anadirHerramienta() {
    const yaEstan = new Set(deTipo("herramienta").map((x) => sinAcentos(x.nombre)));
    const faltan = HERRAMIENTAS.filter((n) => !yaEstan.has(sinAcentos(n)));
    const campo = h("input", { type: "text", class: "buscar-inventario", maxLength: 120, placeholder: "Otra: extrusora, sellos, pistola de engobe…", "aria-label": "Nombre de la herramienta", required: true });
    return h("div", { class: "anadir-almacen" },
      h("h2", {}, "Añadir herramientas"),
      faltan.length > 0 && h("p", { class: "ayuda" }, "Toca las que tengas:"),
      faltan.length > 0 && h("div", { class: "chips-almacen" }, faltan.map((n) => h("button", { type: "button", onclick: () => anadir({ tipo: "herramienta", nombre: n }) }, n))),
      h("form", { class: "otra-herramienta", onsubmit: (ev) => { ev.preventDefault(); const n = campo.value.trim(); if (n) anadir({ tipo: "herramienta", nombre: n }); } },
        campo, h("button", { type: "submit", class: "boton" }, "Añadir")));
  }

  // ---------- Guardar ----------
  const tabla = () => nube.cliente.from("almacen");
  const fallo = () => avisar(faltaTabla ? "Antes hay que ejecutar esquema.sql en Supabase" : "No se ha podido guardar");

  async function anadir(datos) {
    const nueva = { id: crypto.randomUUID(), marca: null, ref: null, cantidad: null, nota: null, estado: "hay", ...datos };
    const { error } = await tabla().insert(nueva);
    if (error) return fallo();
    filas.push(nueva);
    abiertas.clear();
    abiertas.add(nueva.id); // para apuntar enseguida cuánto hay
    pintar(nueva.tipo);
    avisar(`${nueva.nombre}: en el almacén ✓`);
    document.querySelector(`.seccion-almacen[data-tipo="${nueva.tipo}"] .editor-almacen input`)?.focus();
  }

  async function guardar(x, cambios, mensaje) {
    const { error } = await tabla().update(cambios).eq("id", x.id);
    if (error) { fallo(); return false; }
    Object.assign(x, cambios);
    pintar(x.tipo);
    avisar(mensaje);
    return true;
  }

  async function quitar(x) {
    if (!confirm(`¿Quitar «${x.nombre}» del almacén?`)) return;
    const { error } = await tabla().delete().eq("id", x.id);
    if (error) return fallo();
    filas = filas.filter((y) => y.id !== x.id);
    abiertas.delete(x.id);
    pintar(x.tipo);
    avisar(`${x.nombre}: quitado`);
  }

  // ---------- Arranque ----------
  (async () => {
    pintarTodo();
    await window.accesoTaller;
    const { data, error } = await tabla().select("*");
    if (error) faltaTabla = /almacen|PGRST205|does not exist|schema cache/i.test(`${error.code} ${error.message}`);
    filas = data ?? [];
    pintarTodo();
  })();
})();
