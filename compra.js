// Lista de la compra: lo que falta para el taller. Se busca en los catálogos
// (esmaltes de Prodesco y Tecniglaze, pastas) o se escribe a mano; se tacha al
// comprarlo. Los datos, en lista-compra-datos.js.

const $ = (sel) => document.querySelector(sel);
const sinAcentos = (t) => String(t ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function h(etiqueta, props = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "class") el.className = v;
    else if (k in el) el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  el.append(...hijos.flat().filter((x) => x != null && x !== false && x !== ""));
  return el;
}

let temporizadorAviso;
function avisar(texto, accion) {
  const el = $("#aviso");
  el.replaceChildren(texto);
  el.classList.toggle("con-accion", Boolean(accion));
  if (accion) el.append(h("button", { type: "button", onclick: () => { el.classList.remove("visible"); accion.alPulsar(); } }, accion.texto));
  el.classList.add("visible");
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => el.classList.remove("visible"), accion ? 5000 : 2500);
}

const TIPOS = {
  esmalte: { titulo: "Esmaltes", uno: "esmalte" },
  pasta: { titulo: "Pastas", uno: "pasta" },
  herramienta: { titulo: "Herramientas", uno: "herramienta" },
  otro: { titulo: "Otras cosas", uno: "cosa" },
};
const HERRAMIENTAS = ["Esponjas", "Pinceles", "Alambre de corte", "Vaciadores", "Estecas de madera", "Costillas de goma", "Agujas de cerámica",
  "Rodillo", "Pera de engobe", "Tamiz", "Calibre", "Bolsas para el barro", "Cera de reserva", "Lija fina", "Guantes", "Mascarillas FFP2"];
const RAPIDAS = ["Esponjas", "Bolsas para el barro", "Cera de reserva", "Pinceles", "Lija fina"];
const ICONOS = {
  herramienta: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 19.5 8.5-8.5"/><path d="M13 11c.6-3.4 2.8-5.6 6.5-6.5-.9 3.7-3.1 5.9-6.5 6.5z"/><path d="m6.5 14.5 3 3"/></svg>',
  otro: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8h12l-1 12H7z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></svg>',
};

// ---------- Catálogos para las sugerencias ----------
let esmaltes = window.catalogoEsmaltes.guardada() ?? [];
let pastas = [];
window.catalogoEsmaltes.pedir().then((l) => { esmaltes = l; sugerir(); }).catch(() => {});
fetch("pastas.json").then((r) => r.json()).then((l) => { pastas = l; sugerir(); }).catch(() => {});

const deEsmalte = (e) => ({ tipo: "esmalte", nombre: [e.codigo, e.nombre].filter(Boolean).join(" "), marca: e.marca, detalle: e.serie, url: e.url, miniatura: e.miniatura });
const dePasta = (p) => ({ tipo: "pasta", nombre: p.nombre, marca: p.marca ?? "SIO-2", detalle: [p.tipo, p.coccion].filter(Boolean).join(" · "), url: p.url });

function sugerir() {
  const caja = $("#sugerencias-compra");
  const texto = $("#nueva-cosa").value.trim();
  if (texto.length < 2) return caja.replaceChildren();
  const palabras = sinAcentos(texto).split(/\s+/);
  const encaja = (t) => palabras.every((p) => sinAcentos(t).includes(p));
  const opciones = [
    ...HERRAMIENTAS.filter(encaja).slice(0, 3).map((n) => ({ tipo: "herramienta", nombre: n })),
    ...esmaltes.filter((e) => encaja(`${e.codigo} ${e.nombre} ${e.marca} ${e.serie}`)).slice(0, 6).map(deEsmalte),
    ...pastas.filter((p) => encaja(`${p.nombre} ${p.marca} ${p.tipo}`)).slice(0, 4).map(dePasta),
  ];
  caja.replaceChildren(
    ...opciones.map((o) => h("li", {}, h("button", { type: "button", class: "sugerencia", onclick: () => anadir(o) },
      icono(o), h("span", {}, h("strong", {}, o.nombre), h("small", {}, [o.marca, o.detalle].filter(Boolean).join(" · ") || TIPOS[o.tipo].titulo))))),
    h("li", {}, h("button", { type: "button", class: "sugerencia propia", onclick: () => anadir({ tipo: "otro", nombre: texto }) },
      icono({ tipo: "otro" }), h("span", {}, h("strong", {}, `Añadir «${texto}»`), h("small", {}, "Tal cual lo has escrito")))));
}

function icono(x) {
  if (x.tipo === "esmalte" && x.miniatura) return h("img", { class: "icono-compra", src: x.miniatura, alt: "", loading: "lazy" });
  if (x.tipo === "pasta") return window.selloMarca(x.marca || "Propia");
  const el = h("span", { class: `icono-compra icono-${x.tipo}` });
  el.innerHTML = ICONOS[x.tipo] ?? ICONOS.otro;
  return el;
}

// ---------- Cambiar la lista ----------
const abiertas = new Set();
function anadir(cosa) {
  const nueva = window.listaCompra.anadir(cosa);
  $("#nueva-cosa").value = "";
  sugerir();
  pintar();
  avisar(nueva ? `${cosa.nombre}: apuntado` : `${cosa.nombre} ya estaba en la lista`);
}
function cambiar(id, cambios) {
  const lista = window.listaCompra.leer();
  const x = lista.find((y) => y.id === id);
  if (!x) return;
  Object.assign(x, cambios);
  window.listaCompra.guardar(lista);
  pintar();
}
function quitar(id) {
  const lista = window.listaCompra.leer();
  const i = lista.findIndex((y) => y.id === id);
  if (i < 0) return;
  const [x] = lista.splice(i, 1);
  window.listaCompra.guardar(lista);
  pintar();
  avisar(`${x.nombre}: quitado`, { texto: "Deshacer", alPulsar: () => { const l = window.listaCompra.leer(); l.splice(i, 0, x); window.listaCompra.guardar(l); pintar(); } });
}

$("#form-compra").addEventListener("submit", (e) => {
  e.preventDefault();
  const texto = $("#nueva-cosa").value.trim();
  if (!texto) return;
  // si lo escrito es justo una sugerencia, con sus datos; si no, tal cual
  const primera = $("#sugerencias-compra .sugerencia:not(.propia)");
  if (primera && sinAcentos(primera.querySelector("strong").textContent) === sinAcentos(texto)) primera.click();
  else anadir({ tipo: HERRAMIENTAS.some((n) => sinAcentos(n) === sinAcentos(texto)) ? "herramienta" : "otro", nombre: texto });
});
let espera;
$("#nueva-cosa").addEventListener("input", () => { clearTimeout(espera); espera = setTimeout(sugerir, 120); });

// ---------- Pintar ----------
function fila(x) {
  const abierta = abiertas.has(x.id);
  const li = h("li", { class: `cosa-compra${x.comprado ? " comprada" : ""}` },
    h("button", { type: "button", class: "marcar", role: "checkbox", "aria-checked": String(Boolean(x.comprado)),
      "aria-label": x.comprado ? `${x.nombre}: comprado. Tócalo para volver a la lista` : `Marcar ${x.nombre} como comprado`,
      onclick: () => cambiar(x.id, { comprado: !x.comprado }) }, h("span", { "aria-hidden": "true" }, "✓")),
    icono(x),
    h("button", { type: "button", class: "datos-compra", "aria-expanded": String(abierta), title: "Apuntar cuánto o una nota",
      onclick: () => { abierta ? abiertas.delete(x.id) : abiertas.add(x.id); pintar(); } },
      h("strong", {}, x.nombre, x.cantidad && h("span", { class: "cantidad" }, ` · ${x.cantidad}`)),
      h("small", {}, [x.marca, x.nota || x.detalle].filter(Boolean).join(" · ") || (x.comprado ? "" : "Toca para apuntar cuánto"))),
    x.url && h("a", { class: "tienda-compra", href: x.url, target: "_blank", rel: "noopener", "aria-label": `Ver ${x.nombre} en la tienda`, title: "Ver en la tienda" }, "↗"));
  if (abierta) {
    const cantidad = h("input", { type: "text", maxLength: 60, value: x.cantidad ?? "", placeholder: x.tipo === "pasta" ? "2 sacos de 12,5 kg" : x.tipo === "esmalte" ? "1 bote de 500 g" : "2" });
    const nota = h("input", { type: "text", maxLength: 200, value: x.nota ?? "", placeholder: "Para la taza de Marta, mirar si hay oferta…" });
    li.append(h("form", { class: "editor-compra", onsubmit: (e) => { e.preventDefault(); abiertas.delete(x.id); cambiar(x.id, { cantidad: cantidad.value.trim(), nota: nota.value.trim() }); } },
      h("label", {}, "Cuánto", cantidad), h("label", {}, "Nota", nota),
      h("div", { class: "botones-editor" }, h("button", { type: "submit", class: "boton" }, "Guardar"),
        h("button", { type: "button", class: "quitar-compra", onclick: () => { abiertas.delete(x.id); quitar(x.id); } }, "Quitar de la lista"))));
  }
  return li;
}

function pintar() {
  const lista = window.listaCompra.leer();
  const porComprar = lista.filter((x) => !x.comprado);
  const comprado = lista.filter((x) => x.comprado);
  $("#resumen-compra").textContent = !lista.length
    ? "La lista está vacía. Apunta arriba lo que te falte."
    : porComprar.length ? `${porComprar.length === 1 ? "Te falta 1 cosa" : `Te faltan ${porComprar.length} cosas`}${comprado.length ? ` · ${comprado.length} en el carro` : ""}` : "¡Lo tienes todo! Ya puedes quitar lo comprado.";
  $("#por-comprar").replaceChildren(...Object.entries(TIPOS).map(([tipo, t]) => {
    const suyas = porComprar.filter((x) => (TIPOS[x.tipo] ? x.tipo : "otro") === tipo);
    return suyas.length && h("section", { class: "grupo-compra" }, h("h2", {}, t.titulo, h("small", {}, ` ${suyas.length}`)), h("ul", { class: "lista-compra" }, suyas.map(fila)));
  }).filter(Boolean));
  $("#comprado").hidden = !comprado.length;
  $("#n-comprado").textContent = comprado.length ? String(comprado.length) : "";
  $("#lista-comprado").replaceChildren(...comprado.map(fila));
  $("#compartir-lista").hidden = !porComprar.length;
  const ya = new Set(porComprar.map((x) => sinAcentos(x.nombre)));
  $("#rapidas").replaceChildren(...RAPIDAS.filter((n) => !ya.has(sinAcentos(n))).map((n) =>
    h("button", { type: "button", onclick: () => anadir({ tipo: "herramienta", nombre: n }) }, `+ ${n}`)));
}

$("#quitar-comprados").addEventListener("click", () => {
  const antes = window.listaCompra.leer();
  const n = antes.filter((x) => x.comprado).length;
  window.listaCompra.guardar(antes.filter((x) => !x.comprado));
  pintar();
  avisar(n === 1 ? "Quitada 1 cosa" : `Quitadas ${n} cosas`, { texto: "Deshacer", alPulsar: () => { window.listaCompra.guardar(antes); pintar(); } });
});

$("#compartir-lista").addEventListener("click", () => {
  const porComprar = window.listaCompra.leer().filter((x) => !x.comprado);
  const lineas = Object.entries(TIPOS).flatMap(([tipo, t]) => {
    const suyas = porComprar.filter((x) => (TIPOS[x.tipo] ? x.tipo : "otro") === tipo);
    return suyas.length ? [`${t.titulo}:`, ...suyas.map((x) => `- ${x.nombre}${x.marca ? ` (${x.marca})` : ""}${x.cantidad ? `, ${x.cantidad}` : ""}${x.nota ? `. ${x.nota}` : ""}`), ""] : [];
  });
  compartir({ titulo: "Lista de la compra", texto: ["Lista de la compra · El Almacén", "", ...lineas].join("\n").trim(), avisar });
});

// Si la lista cambia en otra pestaña o llega de la cuenta (otro móvil), se repinta
window.addEventListener("storage", (e) => { if (e.key === "listaCompra") pintar(); });
window.addEventListener("nube:estado", () => pintar());
window.addEventListener("nube:actualizado", () => pintar());

pintar();
