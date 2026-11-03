// Panel del taller: los encargos que llegan desde encargos.html.
// Solo lo ven los correos de la tabla admins (lo comprueban las reglas de Supabase).

const $ = (sel) => document.querySelector(sel);
const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

const ESTADOS = {
  nuevo: "Nuevo",
  presupuestado: "Presupuestado",
  aceptado: "Aceptado",
  "en-proceso": "En proceso",
  terminado: "Terminado",
  entregado: "Entregado",
  descartado: "Descartado",
};
const FILTROS = { pendientes: "Pendientes", ...ESTADOS, todos: "Todos" };
const CERRADOS = ["entregado", "descartado"];

let encargos = [];
let urls = [];

let temporizadorAviso;
// avisar("Hecho", { texto: "Deshacer", alPulsar }) pone un botón en el aviso
function avisar(texto, accion) {
  const el = $("#aviso");
  el.replaceChildren(texto);
  el.classList.toggle("con-accion", Boolean(accion));
  if (accion) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = accion.texto;
    b.addEventListener("click", () => { el.classList.remove("visible"); accion.alPulsar(); });
    el.append(b);
  }
  el.classList.add("visible");
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => el.classList.remove("visible"), accion ? 5000 : 2500);
}

// Crea un elemento: h("button", { class: "x", onclick }, "texto", hijo…)
function h(etiqueta, props = {}, ...hijos) {
  const el = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props)) {
    if (valor == null || valor === false) continue;
    if (clave.startsWith("on")) el.addEventListener(clave.slice(2), valor);
    else if (clave === "class") el.className = valor;
    else if (clave in el) el[clave] = valor;
    else el.setAttribute(clave, valor === true ? "" : valor);
  }
  el.append(...hijos.flat().filter((x) => x != null && x !== false && x !== ""));
  return el;
}

const fecha = (iso, opciones = { day: "numeric", month: "short" }) => new Date(iso).toLocaleDateString("es-ES", opciones);
function haceCuanto(iso) {
  const dias = Math.floor((Date.now() - new Date(iso)) / 86_400_000);
  if (dias <= 0) return "hoy";
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  return fecha(iso);
}

// Cómo prefiere que le contesten, con su icono: «Prefiere WhatsApp» / «Prefiere correo»
const ICONOS_CONTACTO = {
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 19.5l1.2-3.6A7.8 7.8 0 1 1 8.6 18.4z"/><path d="M9.3 9.2c.2 1.9 1.8 3.7 3.8 4.4l1.1-1.1 1.7.8-.4 1.4c-3.4.2-6.6-2.9-6.6-6.3l1.4-.4.8 1.7z"/></svg>',
  correo: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5.5" width="17" height="13" rx="2"/><path d="m4 7 8 6 8-6"/></svg>',
};
function preferencia(x, grande = false) {
  const via = x.contestar_por === "whatsapp" ? "whatsapp" : "correo";
  const el = h("span", { class: `prefiere prefiere-${via}${grande ? " grande" : ""}` });
  el.innerHTML = ICONOS_CONTACTO[via];
  el.append(grande ? `Prefiere que le contestes por ${via === "whatsapp" ? "WhatsApp" : "correo"}` : `Prefiere ${via === "whatsapp" ? "WhatsApp" : "correo"}`);
  return el;
}

// ---------- Tablero (kanban): una columna por estado ----------

const FLECHA = (d) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
const IZQUIERDA = FLECHA("M14.5 6 8.5 12l6 6");
const DERECHA = FLECHA("m9.5 6 6 6-6 6");
const COLUMNAS = Object.keys(ESTADOS);

function pintar() {
  const tablero = $("#tablero-encargos");
  const scroll = tablero.scrollLeft;
  $("#columnas-mapa").replaceChildren(...COLUMNAS.map((estado) =>
    h("button", { type: "button", class: "filtro", onclick: () => $(`.columna-encargos[data-estado="${estado}"]`).scrollIntoView({ inline: "start", block: "nearest", behavior: "smooth" }) },
      `${ESTADOS[estado]} `, h("span", { class: "cuantos" }, String(encargos.filter((e) => e.estado === estado).length)))));
  tablero.replaceChildren(...COLUMNAS.map((estado) => {
    const suyos = encargos.filter((e) => e.estado === estado);
    return h("section", { class: `columna-encargos estado-${estado}${CERRADOS.includes(estado) ? " cerrada" : ""}`, "data-estado": estado, "aria-label": ESTADOS[estado] },
      h("header", {}, h("h2", {}, ESTADOS[estado]), h("span", { class: "cuantos" }, String(suyos.length))),
      h("div", { class: "lista-columna" }, suyos.length ? suyos.map(tarjeta) : h("p", { class: "vacio-columna" }, "Suelta aquí una tarjeta")));
  }));
  tablero.scrollLeft = scroll;
}

function tarjeta(e) {
  const i = COLUMNAS.indexOf(e.estado);
  const flecha = (destino) => destino && h("button", { type: "button", class: "mover-tarjeta", "aria-label": `Mover a ${ESTADOS[destino]}`, title: `Mover a ${ESTADOS[destino]}`,
    onclick: () => mover(e, destino) });
  const izquierda = flecha(COLUMNAS[i - 1]);
  const derecha = flecha(COLUMNAS[i + 1]);
  if (izquierda) izquierda.innerHTML = IZQUIERDA;
  if (derecha) derecha.innerHTML = DERECHA;
  const el = h("article", { class: `tarjeta-kanban${sinVer(e) ? " sin-ver" : ""}`, "data-id": e.id },
    h("button", { type: "button", class: `tarjeta-encargo estado-${e.estado}`, onclick: () => { if (!acabaDeArrastrar) abrir(e); } },
      h("span", { class: "linea-1" },
        h("strong", {}, sinVer(e) && h("span", { class: "punto-sin-ver", title: "Sin abrir" }), `${e.tipo || "Pieza"}${e.cantidad > 1 ? ` × ${e.cantidad}` : ""}`)),
      h("span", { class: "linea-2" }, `${e.nombre} · ${haceCuanto(e.creado)}`, e.fotos?.length || e.tablero ? " · con adjuntos" : ""),
      preferencia(e),
      h("span", { class: "idea-corta" }, e.idea),
      e.precio != null && h("span", { class: "linea-3" }, `${euros.format(e.precio)}${e.plazo ? ` · ${e.plazo}` : ""}`)),
    h("div", { class: "pie-tarjeta" }, izquierda || h("span"), derecha || h("span")));
  prepararArrastre(el, e);
  return el;
}

// Cambia de columna: se ve al momento y se guarda; si falla, vuelve a la suya
async function mover(e, estado) {
  const antes = e.estado;
  if (antes === estado) return;
  e.estado = estado;
  pintar();
  const cambios = { estado };
  const { error } = await window.nube.cliente.from("encargos").update(cambios).eq("id", e.id);
  if (error) {
    e.estado = antes;
    pintar();
    return avisar("No se ha podido mover");
  }
  marcarVisto(e);
  window.dispatchEvent(new Event("panel-cambiado"));
  avisar(`${e.tipo || "Pieza"} de ${e.nombre}: ${ESTADOS[estado]}`, { texto: "Deshacer", alPulsar: () => mover(e, antes) });
}

// ---------- Arrastrar ----------
// Con el ratón, en cuanto se mueve; con el dedo, tras dejarlo quieto un momento
// (si se mueve antes, es que estás desplazándote por la página)
let arrastre = null;
let acabaDeArrastrar = false;

function prepararArrastre(el, e) {
  el.addEventListener("contextmenu", (ev) => ev.pointerType !== "mouse" && ev.preventDefault());
  el.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0 || ev.target.closest(".mover-tarjeta") || arrastre) return;
    const inicio = { x: ev.clientX, y: ev.clientY };
    const tactil = ev.pointerType !== "mouse";
    let ultimo = ev;
    const espera = tactil && setTimeout(() => empezar(), 300);
    function empezar() {
      clearTimeout(espera);
      arrastre = crearArrastre(el, e, ultimo);
      navigator.vibrate?.(15);
    }
    function moverPuntero(m) {
      ultimo = m;
      if (!arrastre) {
        const d = Math.hypot(m.clientX - inicio.x, m.clientY - inicio.y);
        if (tactil) { if (d > 10) acabar(); return; }
        if (d < 6) return;
        empezar();
      }
      arrastre.seguir(m);
    }
    function soltar() {
      const a = arrastre;
      acabar();
      if (!a) return;
      acabaDeArrastrar = true;
      setTimeout(() => { acabaDeArrastrar = false; }, 50);
      const destino = a.columna?.dataset.estado;
      if (destino && destino !== e.estado) mover(e, destino);
    }
    function acabar() {
      clearTimeout(espera);
      arrastre?.quitar();
      arrastre = null;
      window.removeEventListener("pointermove", moverPuntero);
      window.removeEventListener("pointerup", soltar);
      window.removeEventListener("pointercancel", acabar);
    }
    window.addEventListener("pointermove", moverPuntero);
    window.addEventListener("pointerup", soltar);
    window.addEventListener("pointercancel", acabar);
  });
}

// Mientras arrastras con el dedo, la página no se desplaza
document.addEventListener("touchmove", (ev) => { if (arrastre) ev.preventDefault(); }, { passive: false });

function crearArrastre(el, e, ev) {
  const tablero = $("#tablero-encargos");
  const caja = el.getBoundingClientRect();
  const desfase = { x: ev.clientX - caja.left, y: ev.clientY - caja.top };
  const fantasma = el.cloneNode(true);
  fantasma.classList.add("fantasma");
  fantasma.style.width = `${caja.width}px`;
  document.body.append(fantasma);
  el.classList.add("arrastrando");
  tablero.classList.add("con-arrastre");
  let punto = { x: ev.clientX, y: ev.clientY };
  const a = { columna: null };
  const colocar = () => {
    fantasma.style.transform = `translate(${punto.x - desfase.x}px, ${punto.y - desfase.y}px) rotate(2deg)`;
    const columna = document.elementFromPoint(punto.x, punto.y)?.closest(".columna-encargos") ?? columnaCercana();
    if (columna !== a.columna) {
      a.columna?.classList.remove("encima");
      columna?.classList.add("encima");
      a.columna = columna;
    }
  };
  // En un hueco o en el margen del tablero: la columna más cercana
  const columnaCercana = () => {
    let mejor = null, distancia = Infinity;
    for (const c of tablero.querySelectorAll(".columna-encargos")) {
      const r = c.getBoundingClientRect();
      const d = Math.abs(punto.x - Math.min(Math.max(punto.x, r.left), r.right));
      if (d < distancia) { distancia = d; mejor = c; }
    }
    return mejor;
  };
  // Cerca de los bordes, el tablero y la página se desplazan solos
  let animacion = requestAnimationFrame(function paso() {
    const t = tablero.getBoundingClientRect();
    const margen = Math.min(60, t.width * 0.15);
    if (punto.x < t.left + margen) tablero.scrollLeft -= 14;
    else if (punto.x > t.right - margen) tablero.scrollLeft += 14;
    // arriba o abajo, solo si llevas la tarjeta hacia allí (no si ya empezaste en el borde)
    if (punto.y < 70 && punto.y < ev.clientY - 20) window.scrollBy(0, -12);
    else if (punto.y > innerHeight - 90 && punto.y > ev.clientY + 20) window.scrollBy(0, 12);
    colocar();
    animacion = requestAnimationFrame(paso);
  });
  colocar();
  a.seguir = (m) => { punto = { x: m.clientX, y: m.clientY }; colocar(); };
  a.quitar = () => {
    cancelAnimationFrame(animacion);
    fantasma.remove();
    el.classList.remove("arrastrando");
    tablero.classList.remove("con-arrastre");
    a.columna?.classList.remove("encima");
  };
  return a;
}

// Nuevo y sin abrir: es lo único que cuenta en los globos del panel y del menú
const sinVer = (e) => e.estado === "nuevo" && !e.visto;
async function marcarVisto(e) {
  if (e.visto) return;
  const ahora = new Date().toISOString();
  const { error } = await window.nube.cliente.from("encargos").update({ visto: ahora }).eq("id", e.id);
  if (error) return; // sin la columna (falta volver a pasar el esquema): no pasa nada
  e.visto = ahora;
  pintar();
  window.dispatchEvent(new Event("panel-cambiado"));
}

async function cargar() {
  const { data, error } = await window.nube.cliente.from("encargos").select("*").order("creado", { ascending: false });
  if (error) throw error;
  encargos = data;
  pintar();
}

// ---------- Ficha ----------

async function urlFoto(ruta) {
  const { data, error } = await window.nube.cliente.storage.from("encargos").download(ruta);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  urls.push(url);
  return url;
}

function telefonoWhatsApp(telefono) {
  let n = (telefono || "").replace(/\D/g, "");
  if (n.startsWith("00")) n = n.slice(2);
  if (n.length === 9 && /^[6789]/.test(n)) n = "34" + n; // número español sin prefijo
  return n;
}

function mensajeRespuesta(e, { precio, plazo }) {
  const partes = [`Hola ${e.nombre}. Te escribo de El Almacén por tu encargo (${(e.tipo || "pieza").toLowerCase()}${e.cantidad > 1 ? `, ${e.cantidad} unidades` : ""}).`];
  if (precio) partes.push(`El presupuesto es de ${euros.format(precio)}${plazo ? ` y el plazo, ${plazo}` : ""}.`);
  else if (plazo) partes.push(`El plazo sería ${plazo}.`);
  partes.push("¿Te encaja?");
  return partes.join(" ");
}

function dato(etiqueta, valor) {
  return valor ? [h("dt", {}, etiqueta), h("dd", {}, valor)] : [];
}

async function abrir(e) {
  urls.forEach(URL.revokeObjectURL);
  urls = [];
  const precio = h("input", { type: "number", inputmode: "decimal", min: "0", step: "0.5", value: e.precio ?? "", placeholder: "45" });
  const plazo = h("input", { type: "text", maxLength: 120, value: e.plazo ?? "", placeholder: "unas 4 semanas" });
  const estado = h("select", {}, ...Object.entries(ESTADOS).map(([clave, nombre]) => h("option", { value: clave, selected: e.estado === clave }, nombre)));
  const notas = h("textarea", { rows: 3, value: e.notas ?? "", placeholder: "Solo las ves tú: pasta, esmalte, cuándo meterlo en el horno…" });
  const actual = () => ({ precio: precio.value ? Number(precio.value) : null, plazo: plazo.value.trim() });
  marcarVisto(e);

  // Guarda lo que hay en la ficha; con precio, un encargo nuevo pasa solo a «presupuestado»
  async function guardar() {
    const cambios = { ...actual(), plazo: actual().plazo || null, estado: estado.value, notas: notas.value.trim() || null };
    if (cambios.precio != null && e.estado === "nuevo" && cambios.estado === "nuevo") cambios.estado = "presupuestado";
    const { error } = await window.nube.cliente.from("encargos").update(cambios).eq("id", e.id);
    if (error) return false;
    Object.assign(e, cambios);
    estado.value = e.estado;
    pintar();
    window.dispatchEvent(new Event("panel-cambiado"));
    return true;
  }
  // Al contestar se guarda el presupuesto y el plazo que le mandas
  const alContestar = () => { if (actual().precio != null || actual().plazo) guardar(); };

  const telefono = telefonoWhatsApp(e.telefono);
  const porWhatsApp = telefono && h("a", { class: `boton${e.contestar_por === "whatsapp" ? "" : " secundario"}`, target: "_blank", rel: "noopener", href: `https://wa.me/${telefono}`,
    onclick: (ev) => { ev.currentTarget.href = `https://wa.me/${telefono}?text=${encodeURIComponent(mensajeRespuesta(e, actual()))}`; alContestar(); } },
    `Contestar por WhatsApp${e.contestar_por === "whatsapp" ? " (lo prefiere)" : ""}`);
  const porCorreo = e.correo && h("a", { class: `boton${e.contestar_por === "correo" ? "" : " secundario"}`, href: `mailto:${e.correo}`,
    onclick: (ev) => { ev.currentTarget.href = `mailto:${e.correo}?subject=${encodeURIComponent("Tu encargo en El Almacén")}&body=${encodeURIComponent(mensajeRespuesta(e, actual()))}`; alContestar(); } },
    `Contestar por correo${e.contestar_por === "correo" ? " (lo prefiere)" : ""}`);
  // El que prefiere, primero
  const contestar = h("div", { class: "contestar" }, ...(e.contestar_por === "whatsapp" ? [porWhatsApp, porCorreo] : [porCorreo, porWhatsApp]));

  const galeria = h("div", { class: "galeria-encargo" });
  $("#contenido-ficha").replaceChildren(
    h("h2", {}, `${e.tipo || "Pieza"}${e.cantidad > 1 ? ` × ${e.cantidad}` : ""}`),
    h("p", { class: "quien" }, `${e.nombre} · ${fecha(e.creado, { day: "numeric", month: "long", year: "numeric" })}`),
    preferencia(e, true),
    h("p", { class: "idea" }, e.idea),
    h("dl", { class: "datos-encargo" },
      ...dato("Uso", e.uso),
      ...dato("Tamaño", e.medidas),
      ...dato("Colores", e.colores),
      ...dato("Para cuándo", e.para_cuando && fecha(e.para_cuando + "T12:00", { day: "numeric", month: "long", year: "numeric" })),
      ...dato("Quiere gastar", e.presupuesto_cliente),
      ...dato("Teléfono", e.telefono),
      ...dato("Correo", e.correo)),
    galeria,
    h("section", { class: "tu-respuesta" },
      h("h3", {}, "Tu respuesta"),
      h("div", { class: "fila-campos" },
        h("label", { class: "campo" }, "Presupuesto (€)", precio),
        h("label", { class: "campo" }, "Plazo", plazo)),
      h("label", { class: "campo" }, "Estado", estado),
      h("label", { class: "campo" }, "Notas", notas),
      h("button", { type: "button", class: "guardar", onclick: async (ev) => {
        const boton = ev.currentTarget;
        boton.disabled = true;
        const bien = await guardar();
        boton.disabled = false;
        avisar(bien ? "Guardado ✓" : "No se ha podido guardar");
      } }, "Guardar"),
      contestar),
    h("button", { type: "button", class: "borrar-encargo", onclick: async () => {
      if (!confirm(`¿Borrar el encargo de ${e.nombre} y sus fotos?`)) return;
      const rutas = [...(e.fotos ?? []), e.tablero?.imagen].filter(Boolean);
      if (rutas.length) await window.nube.cliente.storage.from("encargos").remove(rutas);
      const { error } = await window.nube.cliente.from("encargos").delete().eq("id", e.id);
      if (error) return avisar("No se ha podido borrar");
      encargos = encargos.filter((x) => x.id !== e.id);
      $("#ficha-encargo").close();
      pintar();
      avisar("Encargo borrado");
    } }, "Borrar encargo"),
  );
  $("#ficha-encargo").showModal();
  $("#ficha-encargo").scrollTop = 0;

  // Fotos y tablero, cuando lleguen
  const imagenes = [...(e.fotos ?? []).map((ruta, i) => ({ ruta, texto: `Foto ${i + 1}` })), ...(e.tablero?.imagen ? [{ ruta: e.tablero.imagen, texto: `Tablero «${e.tablero.nombre}»`, tablero: true }] : [])];
  for (const imagen of imagenes) {
    try {
      const url = await urlFoto(imagen.ruta);
      galeria.append(h("a", { href: url, target: "_blank", class: imagen.tablero ? "tablero" : "" },
        h("img", { src: url, alt: imagen.texto }), imagen.tablero && h("span", {}, imagen.texto)));
    } catch {
      galeria.append(h("span", { class: "sin-foto" }, `${imagen.texto}: no se ha podido cargar`));
    }
  }
}

$("#cerrar-ficha").addEventListener("click", () => $("#ficha-encargo").close());
$("#ficha-encargo").addEventListener("click", (e) => e.target === e.currentTarget && e.currentTarget.close());

// ---------- Arranque ----------

(async () => {
  await window.accesoTaller;
  const estado = $("#estado-panel");
  try {
    await cargar();
    estado.hidden = true;
    $("#panel").hidden = false;
  } catch {
    estado.textContent = "No se han podido cargar los encargos. Comprueba la conexión y recarga.";
  }
})();
