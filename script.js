/* =========================================================
   Cuentos que Sienten · lógica de la presentación
   ========================================================= */

/* ---------------------------------------------------------
   1. Configuración de la compilación WebGL de Unity
   Las rutas corresponden a los archivos reales que genera Unity
   dentro de unity-build/Build/. Si se vuelve a compilar con otro
   nombre de carpeta o compresión, actualiza estos valores.
   --------------------------------------------------------- */
const UNITY_BUILD = {
  loaderUrl: "unity-build/Build/unity-build.loader.js",
  config: {
    dataUrl: "unity-build/Build/unity-build.data.unityweb",
    frameworkUrl: "unity-build/Build/unity-build.framework.js.unityweb",
    codeUrl: "unity-build/Build/unity-build.wasm.unityweb",
    streamingAssetsUrl: "unity-build/StreamingAssets",
    companyName: "DefaultCompany",
    productName: "Animaciones",
    productVersion: "1.0",
  },
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/* ---------------------------------------------------------
   2. Diapositivas: una sección visible a la vez, con pestañas
   numeradas arriba, flechas, miniaturas, teclado y gestos
   --------------------------------------------------------- */
const slides = $$(".slide");
const pad2 = n => String(n).padStart(2, "0");
let current = -1;

$("#topNav").innerHTML = slides.map((s, i) =>
  `<li><a href="#${s.id}" data-i="${i}">${pad2(i + 1)}. ${s.dataset.title}</a></li>`).join("");
$("#thumbs").innerHTML = slides.map((s, i) =>
  `<li><a href="#${s.id}" data-i="${i}" aria-label="Diapositiva ${i + 1}: ${s.dataset.title}">
    <img class="${s.dataset.fit || "contain"}" src="${s.dataset.thumb}" alt="" loading="lazy" draggable="false">
    <span>${pad2(i + 1)}. ${s.dataset.title}</span></a></li>`).join("");
const topLinks = $$("#topNav a"), thumbLinks = $$("#thumbs a");

function showSlide(i, { updateHash = true } = {}) {
  i = Math.max(0, Math.min(slides.length - 1, i));
  if (i === current) return;
  const prev = slides[current];
  current = i;
  slides.forEach((s, j) => {
    s.classList.toggle("active", j === i);
    s.classList.toggle("before", j < i);
    s.setAttribute("aria-hidden", j !== i);
    s.inert = j !== i;
  });
  // Al salir de una diapositiva se pausan sus videos y audios
  if (prev) $$("video, audio", prev).forEach(m => m.pause());
  [topLinks, thumbLinks].forEach(list => list.forEach((a, j) => {
    a.classList.toggle("active", j === i);
    if (j === i) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
  }));
  thumbLinks[i].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  topLinks[i].scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  $("#slideCounter").textContent = `${pad2(i + 1)} / ${pad2(slides.length)}`;
  $("#progressFill").style.width = ((i + 1) / slides.length) * 100 + "%";
  $("#prevSlide").disabled = i === 0;
  $("#nextSlide").disabled = i === slides.length - 1;
  const inner = $(".slide-inner", slides[i]);
  if (inner) inner.scrollTop = 0;
  if (updateHash && location.hash !== "#" + slides[i].id) history.replaceState(null, "", "#" + slides[i].id);
  document.dispatchEvent(new CustomEvent("slidechange", { detail: slides[i].id }));
}
const indexOfId = id => slides.findIndex(s => s.id === id);

// Cualquier enlace interno (#prototipo, #temas…) cambia de diapositiva
document.addEventListener("click", e => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const i = indexOfId(a.getAttribute("href").slice(1));
  if (i >= 0) { e.preventDefault(); showSlide(i); }
});
addEventListener("hashchange", () => { const i = indexOfId(location.hash.slice(1)); if (i >= 0) showSlide(i, { updateHash: false }); });
$("#prevSlide").addEventListener("click", () => showSlide(current - 1));
$("#nextSlide").addEventListener("click", () => showSlide(current + 1));
$("#thumbsLeft").addEventListener("click", () => { $("#thumbs").scrollLeft -= 440; });
$("#thumbsRight").addEventListener("click", () => { $("#thumbs").scrollLeft += 440; });

// Teclado: flechas y Re Pág / Av Pág, salvo dentro de campos, videos o el juego
addEventListener("keydown", e => {
  if (e.altKey || e.ctrlKey || e.metaKey) return;
  const t = e.target;
  if (t.closest && t.closest("input, textarea, select, video, audio, canvas, [contenteditable], .seg, [role=tablist]")) return;
  if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); showSlide(current + 1); }
  else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); showSlide(current - 1); }
  else if (e.key === "Home" && !t.closest(".slide-inner")) showSlide(0);
});

// Gesto de deslizar en pantallas táctiles (fuera de las zonas interactivas)
(function swipe() {
  let x0 = null, y0 = 0;
  const SKIP = "canvas, input, video, audio, pre, .table-wrap, .seg, .input-pad, .hover-stage, .hero-stage, .rig-stage, .frame-strip, .thumbs, .topnav";
  $("#deck").addEventListener("touchstart", e => {
    x0 = e.target.closest(SKIP) || e.touches.length > 1 ? null : e.touches[0].clientX;
    y0 = e.touches[0].clientY;
  }, { passive: true });
  $("#deck").addEventListener("touchend", e => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0;
    if (Math.abs(dx) > 70 && Math.abs(dy) < 60) showSlide(current + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();

// Pantalla completa de toda la presentación
$("#fullscreenDeck").addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => {});
});

/* ---------------------------------------------------------
   3. El niño: fotogramas reales y reproductor de clips
   Un solo temporizador a 7 fps (la velocidad de los clips de
   Unity) mueve a todas las copias del niño de la página.
   --------------------------------------------------------- */
const KID_FRAMES = {
  idle: Array.from({ length: 8 }, (_, i) => `assets/images/kid/idle_${i}.png`),
  question: Array.from({ length: 8 }, (_, i) => `assets/images/kid/question_${i}.png`),
  wave: Array.from({ length: 8 }, (_, i) => `assets/images/kid/wave_${i}.png`),
};
const KID_FPS = 7;
Object.values(KID_FRAMES).flat().forEach(src => { const im = new Image(); im.src = src; });

const kidPlayers = [];
// Reposo en bucle; «saludar» y «pensar» se reproducen una vez y vuelven solos al reposo (como Has Exit Time)
function kidPlayer(img, onFrame) {
  const p = {
    clip: "idle", frame: 0,
    play(clip) { p.clip = clip; p.frame = 0; p.draw(); },
    draw() { img.src = KID_FRAMES[p.clip][p.frame]; onFrame && onFrame(p); },
    tick() {
      p.frame++;
      if (p.frame >= 8) { p.frame = 0; if (p.clip !== "idle") p.clip = "idle"; }
      p.draw();
    },
  };
  kidPlayers.push(p);
  return p;
}
setInterval(() => kidPlayers.forEach(p => {
  // Solo se animan los que están a la vista (ahorra trabajo en las diapositivas ocultas)
  if (p.img.closest(".slide.active")) p.tick();
}), 1000 / KID_FPS);
const kid = (img, onFrame) => Object.assign(kidPlayer(img, onFrame), { img });

// Clic simple o doble, con la misma lógica que IsCliked.cs: se cuentan los clics y,
// cuando pasa el tiempo de doble clic (0,5 s), 1 clic = IsClicked y 2 o más = IsDoubleClicked.
const DOUBLE_CLICK_TIME = 500;
function clickCounter(onSingle, onDouble) {
  let count = 0, timer = 0;
  return () => {
    count++;
    if (count === 1) timer = setTimeout(() => { (count === 1 ? onSingle : onDouble)(); count = 0; }, DOUBLE_CLICK_TIME);
    return count;
  };
}

// Portada: un clic = saludar, doble clic = pensar. La tarjeta flotante lo muestra en reposo
const heroKid = kid($("#heroKid"));
$("#heroKidBtn").addEventListener("click", clickCounter(() => heroKid.play("wave"), () => heroKid.play("question")));
kid($("#cardKid"));

// Demostración de sprites: reposo en bucle, «saludar» o «pensar» una vez y vuelta al reposo
const strip = $("#frameStrip");
const spriteDemo = kid($("#spriteDemo"), p => {
  strip.innerHTML = KID_FRAMES[p.clip].map((src, i) => `<img src="${src}" alt="Fotograma ${i + 1}" class="${i === p.frame ? "on" : ""}">`).join("");
});
spriteDemo.draw();
$$("[data-sprite]").forEach(b => b.addEventListener("click", () => spriteDemo.play(b.dataset.sprite)));

/* ---------------------------------------------------------
   4. Reproductor del prototipo real (Unity WebGL)
   --------------------------------------------------------- */
const ui = {
  frame: $("#unityFrame"),
  intro: $("#unityIntro"),
  loading: $("#unityLoading"),
  error: $("#unityError"),
  errorText: $("#unityErrorText"),
  progress: $("#unityProgress"),
  progressText: $("#unityProgressText"),
  status: $("#unityStatus"),
  restart: $("#restartUnity"),
  fullscreen: $("#fullscreenUnity"),
};
let unityInstance = null;
let loaderLoaded = false;

function setStatus(text, kind = "") {
  ui.status.textContent = text;
  ui.status.className = "status-pill " + kind;
}
function show(el) { [ui.intro, ui.loading, ui.error].forEach(o => o.classList.toggle("hidden", o !== el)); }

function showError(message) {
  ui.errorText.innerHTML = message;
  show(ui.error);
  setStatus("Error al cargar", "err");
  ui.restart.disabled = true;
  ui.fullscreen.disabled = true;
}

// Comprueba que un archivo exista en el servidor (sin descargarlo completo)
async function fileInfo(url) {
  const r = await fetch(url, { method: "HEAD", cache: "no-store" });
  return { ok: r.ok, size: Number(r.headers.get("content-length")) || 0 };
}

// Muestra el tamaño aproximado de la descarga antes de iniciar
(async function describeBuild() {
  if (location.protocol === "file:") return;
  try {
    const infos = await Promise.all([UNITY_BUILD.config.dataUrl, UNITY_BUILD.config.frameworkUrl, UNITY_BUILD.config.codeUrl].map(fileInfo));
    if (infos.every(i => i.ok)) {
      const mb = infos.reduce((a, i) => a + i.size, 0) / 1048576;
      if (mb > 0) $("#buildSizeNote").textContent = `Se descargarán unos ${mb.toFixed(1)} MB de la compilación de Unity.`;
    } else {
      $("#buildSizeNote").textContent = "La compilación WebGL no está en unity-build/Build/. Consulta el README para agregarla.";
    }
  } catch { /* sin conexión al servidor: se informa al pulsar el botón */ }
})();

function loadLoaderScript() {
  return new Promise((resolve, reject) => {
    if (loaderLoaded) return resolve();
    const s = document.createElement("script");
    s.src = UNITY_BUILD.loaderUrl;
    s.onload = () => { loaderLoaded = true; resolve(); };
    s.onerror = () => reject(new Error("No se pudo descargar el cargador de Unity."));
    document.body.appendChild(s);
  });
}

// Unity no permite reutilizar el mismo canvas después de cerrar una instancia
function freshCanvas() {
  const old = $("#unity-canvas");
  const canvas = old.cloneNode(false);
  old.replaceWith(canvas);
  return canvas;
}

async function startUnity() {
  if (location.protocol === "file:") {
    showError("La página se abrió directamente como archivo (<code>file://</code>). Unity WebGL necesita un servidor web: sigue los pasos de «Ejecutar localmente» en el README.");
    return;
  }
  show(ui.loading);
  setStatus("Cargando…", "loading");
  ui.progress.style.width = "0%";
  ui.progressText.textContent = "0 %";

  try {
    const loader = await fileInfo(UNITY_BUILD.loaderUrl);
    if (!loader.ok) {
      showError(`Falta la compilación WebGL. Debe existir <code>${UNITY_BUILD.loaderUrl}</code> junto con los archivos de datos, framework y WebAssembly.`);
      return;
    }
    await loadLoaderScript();
    const canvas = freshCanvas();
    const config = {
      ...UNITY_BUILD.config,
      // Mensajes del cargador de Unity: los errores se muestran al cliente
      showBanner: (msg, type) => {
        if (type === "error") showError(msg);
        else console.warn("[Unity]", msg);
      },
    };
    unityInstance = await createUnityInstance(canvas, config, p => {
      const pct = Math.round(p * 100);
      ui.progress.style.width = pct + "%";
      ui.progressText.textContent = pct + " %";
    });
    [ui.intro, ui.loading, ui.error].forEach(o => o.classList.add("hidden"));
    setStatus("Prototipo en ejecución", "ok");
    ui.restart.disabled = false;
    ui.fullscreen.disabled = false;
    canvas.focus();
  } catch (err) {
    console.error(err);
    showError(`${err && err.message ? err.message : err}<br>Comprueba que el navegador sea compatible con WebGL 2 y que la página se sirva desde un servidor.`);
  }
}

async function restartUnity() {
  ui.restart.disabled = true;
  ui.fullscreen.disabled = true;
  if (unityInstance) {
    try { await unityInstance.Quit(); } catch (e) { console.warn(e); }
    unityInstance = null;
  }
  startUnity();
}

$("#startUnity").addEventListener("click", startUnity);
$("#retryUnity").addEventListener("click", restartUnity);
ui.restart.addEventListener("click", restartUnity);
ui.fullscreen.addEventListener("click", () => { if (unityInstance) unityInstance.SetFullscreen(1); });

/* ---------------------------------------------------------
   5. Temas a tratar: lo que falta y cómo hacerlo
   --------------------------------------------------------- */
const TOPIC_GROUPS = { all: "Todos", interaccion: "Interacción", audio: "Audio", contenido: "Contenido", calidad: "Pruebas y entrega" };
const TOPICS = [
  {
    g: "interaccion", t: "Interacción con pantalla táctil",
    now: "El prototipo solo responde al ratón: los scripts leen <code>Mouse.current</code>. En una tableta o celular el toque no activa a los personajes.",
    steps: [
      "En los scripts de interacción, cambiar <code>Mouse.current</code> por <code>Pointer.current</code>, que representa al ratón, al dedo o al lápiz, según cuál se usó por última vez.",
      "Cambiar <code>leftButton</code> por <code>press</code>: con ratón es el clic izquierdo y en táctil es «el dedo tocó la pantalla».",
      "Comprobar el collider en el mismo instante del toque (<code>press.wasPressedThisFrame</code>), porque el dedo no tiene una posición previa como el cursor.",
      "Reemplazar el hover: en táctil no hay «pasar por encima», así que se resalta mientras el dedo presiona (<code>press.isPressed</code>) o con un destello breve.",
    ],
    code: `Pointer p = Pointer.current;               // ratón, dedo o lápiz
if (p != null && p.press.wasPressedThisFrame)
{
    Vector2 mundo = Camera.main.ScreenToWorldPoint(p.position.ReadValue());
    if (bodyCollider.OverlapPoint(mundo))
        animator.SetTrigger("IsClicked");
}`,
    test: "Abrir Window → General → Device Simulator, elegir una tableta y tocar los personajes. Después, probar en el dispositivo real.",
  },
  {
    g: "interaccion", t: "Diferenciar un toque de un doble toque",
    now: "Con <b>ratón</b> ya funciona: <code>IsCliked.cs</code> (niño) e <code>IsClickedRig.cs</code> (niña) cuentan los clics y esperan 0,5 s. Un clic activa <code>IsClicked</code> (saludar) y dos activan <code>IsDoubleClicked</code> (pregunta). Falta que funcione con el dedo, y el clic simple tarda 0,5 s en responder porque espera un posible segundo clic.",
    steps: [
      "Hecho: parámetro Trigger <code>IsDoubleClicked</code> y estado <b>Question</b> en los dos Animator, con vuelta a Idle por Exit Time.",
      "Hecho: los scripts cuentan los clics sobre el personaje y deciden la acción cuando pasa <code>doubleClickTime</code>.",
      "Pendiente: cambiar <code>Mouse.current</code> por <code>Pointer.current</code> para que el doble toque también funcione en pantallas táctiles (ver el tema anterior).",
      "Pendiente: definir con el cliente si el primer toque responde al instante (más ágil) o si espera 0,5 s por si llega otro toque, como ahora (sin interrupciones).",
    ],
    code: `if (over && Mouse.current.leftButton.wasPressedThisFrame)
{
    clickCount++;
    if (clickCount == 1) firstClickTime = Time.time;
}
if (clickCount > 0 && Time.time - firstClickTime > doubleClickTime)
{
    if (clickCount == 1) animator.SetTrigger("IsClicked");        // saludar
    else                 animator.SetTrigger("IsDoubleClicked");  // pregunta
    clickCount = 0;
}`,
    test: "Un clic → saluda (tras 0,5 s). Dos clics rápidos → pregunta. Dos clics lentos → saluda dos veces.",
  },
  {
    g: "interaccion", t: "Interacciones con objetos del entorno",
    now: "Solo los dos personajes reaccionan. El fondo es una única imagen y sus elementos no son interactivos.",
    steps: [
      "Separar del fondo los objetos que deben reaccionar (taza, pelota, árbol) como sprites o capas propias.",
      "A cada objeto agregarle un Collider 2D ajustado a su forma (Polygon Collider 2D si es irregular) y un Animator con su reposo y su acción.",
      "Colocar el mismo script de interacción que usan los personajes: no cambia el código, solo los clips y el sonido.",
      "Ordenar las capas de dibujo (Sorting Order) para que el objeto quede delante o detrás de los personajes según la escena.",
    ],
    test: "Cada objeto responde solo cuando se toca él mismo, sin activar a los vecinos, y vuelve a su reposo.",
  },
  {
    g: "audio", t: "Música de fondo en bucle",
    now: "La música está en la cámara con Play On Awake, pero con <b>Loop desactivado</b>: suena 24 s y se detiene.",
    steps: [
      "Seleccionar <b>Main Camera</b> → componente Audio Source → activar <b>Loop</b>.",
      "Opcional: mover la música a un objeto propio llamado «Ambiente», para no mezclarla con la cámara.",
      "En el archivo de música, poner Load Type en <b>Streaming</b> para que no ocupe memoria.",
      "Volver a compilar WebGL para que la presentación muestre el cambio.",
    ],
    test: "Dejar la escena abierta más de 24 s y comprobar que la música vuelve a empezar sin cortes.",
  },
  {
    g: "audio", t: "Sonido para la acción de la niña",
    now: "La niña salta y saluda, pero en silencio: no tiene Audio Source.",
    steps: [
      "Pedir el sonido al ingeniero de audio (WAV, mono, nombre del tipo <code>SFX_Nina_Saludo.wav</code>).",
      "En el objeto <b>NewChar</b>, agregar un Audio Source con Play On Awake y Loop desactivados y Spatial Blend en 0 (2D).",
      "En <code>IsClickedRig.cs</code>, agregar un campo para el clip y reproducirlo con <code>PlayOneShot</code> justo donde se activa el trigger.",
      "Para que el sonido caiga en el momento exacto del salto, usar un Animation Event (ver el tema siguiente).",
    ],
    code: `[SerializeField] private AudioClip sonidoClic;   // se asigna en el Inspector
// ...
animator.SetTrigger(clickTrigger);
audioSource.PlayOneShot(sonidoClic);`,
    test: "Hacer clic en la niña: el sonido acompaña al salto y no se corta si se hace clic varias veces.",
  },
  {
    g: "audio", t: "Sincronización precisa entre animación y audio",
    now: "El sonido del niño suena en el momento del clic, no en un fotograma concreto de la animación.",
    steps: [
      "El animador entrega un video de cada acción a la velocidad final (24 o 30 fps) y el ingeniero de audio diseña el sonido sobre ese video.",
      "En Unity, abrir el clip en la ventana Animation, ubicar el fotograma del gesto (el mordisco, el sorbo) y pulsar <b>Add Event</b>.",
      "El evento llama a una función pública del script que reproduce el sonido. Si la animación cambia de duración, el sonido se mueve con ella.",
      "Para secuencias largas o transiciones entre escenas, usar <b>Timeline</b>, con la animación y el audio en pistas paralelas.",
    ],
    test: "Reproducir la animación a velocidad reducida (Time.timeScale) y verificar que el sonido coincide con el gesto.",
  },
  {
    g: "audio", t: "Limpiar el Audio Source que no se usa",
    now: "Dentro del niño hay un objeto hijo <code>Idle/Audio Source</code> con el mismo clip «pensar». El script usa el Audio Source del propio <code>Idle</code>, así que este hijo no cumple ninguna función.",
    steps: [
      "Confirmar que no hay otro script que lo use.",
      "Eliminar el objeto hijo o reutilizarlo para un segundo sonido, por ejemplo el del doble toque.",
    ],
    test: "El niño sigue sonando al hacer clic y no aparecen errores en la consola.",
  },
  {
    g: "contenido", t: "Más personajes",
    now: "Hay dos personajes: el niño (sprites) y la niña (huesos). Cada uno tiene su propio script y su propio Animator.",
    steps: [
      "Elegir la técnica: hoja de sprites si el animador dibuja cuadro a cuadro, o archivo por capas (.psb) si se anima con huesos.",
      "Para huesos: importar con Sprite Mode Multiple y Use as Rig, crear huesos, geometría y pesos en el Skinning Editor.",
      "Crear sus clips (reposo y acciones). Si comparte la estructura de estados, usar un <b>Animator Override Controller</b> para reutilizar la lógica y solo cambiar los clips.",
      "Agregar Collider 2D, Audio Source y el script de interacción, y guardarlo como <b>Prefab</b> para reutilizarlo en otras escenas.",
    ],
    test: "El personaje nuevo pasa la misma lista: reposo, resaltado, toque, acción con sonido y regreso al reposo.",
  },
  {
    g: "contenido", t: "Más escenas y transiciones entre ellas",
    now: "Existe una sola escena (SampleScene) y no hay forma de pasar a otra.",
    steps: [
      "Crear una escena de Unity por cada lámina del cuento y agregarlas en File → Build Profiles → lista de escenas.",
      "Crear un gestor de escenas que cargue la siguiente con <code>SceneManager.LoadSceneAsync</code> al terminar la actividad o al pulsar un botón.",
      "Mostrar la transición con un fundido: un panel de interfaz que se oscurece, carga la escena nueva y se aclara.",
      "Si la música debe continuar entre escenas, ponerla en un objeto con <code>DontDestroyOnLoad</code>.",
    ],
    test: "Recorrer todas las escenas de principio a fin sin pantallas negras largas ni sonidos que queden sonando.",
  },
  {
    g: "contenido", t: "Integrar los recursos definitivos del cliente",
    now: "El prototipo usa ilustraciones, animaciones y audios de prueba.",
    steps: [
      "Acordar formatos: ilustraciones por capas (.psb) o hojas de sprites, velocidad de animación (fps), y audio en WAV 48 kHz (efectos en mono, música en estéreo).",
      "Definir una nomenclatura común, por ejemplo <code>SFX_E01_Nina_Comer.wav</code> o <code>E01_Nina_Comer.anim</code>.",
      "Armar una tabla compartida por escena: elemento → evento (1 o 2 toques) → animación → sonido → fotograma del sonido.",
      "Reemplazar los recursos de prueba, ajustar colliders y volver a compilar.",
    ],
    test: "Cada fila de la tabla se comprueba en la escena: el evento dispara la animación y el sonido correctos.",
  },
  {
    g: "contenido", t: "Contenido educativo sobre emociones",
    now: "Los personajes reaccionan, pero todavía no transmiten un mensaje sobre qué se debe o no se debe hacer.",
    steps: [
      "Definir con el cliente el guion de cada escena: emoción, comportamiento correcto e incorrecto.",
      "Traducirlo en acciones de los personajes (por ejemplo, un toque = comportamiento adecuado; doble toque = consecuencia) y, si se acuerda, en voz o narración.",
      "Agregar los elementos visuales de apoyo que se decidan (gestos, globos, íconos), sin saturar la escena.",
    ],
    test: "Revisión con el equipo pedagógico del cliente antes de probarlo con niños.",
  },
  {
    g: "calidad", t: "Validación en dispositivos y con niños",
    now: "Probado en el editor de Unity y en un navegador de escritorio. No se ha probado en tabletas ni con el público final.",
    steps: [
      "Definir el dispositivo final (tableta, celular, PC o pantalla táctil grande) y compilar para esa plataforma (Android, iOS o WebGL).",
      "Revisar que las zonas de toque sean grandes para dedos pequeños, y el rendimiento: fluidez, tiempo de carga y memoria.",
      "Hacer pruebas de uso con niños: ¿entienden que pueden tocar? ¿reconocen la emoción? ¿el volumen es adecuado?",
      "Ajustar con lo observado y volver a compilar.",
    ],
    test: "Lista de verificación firmada con el cliente: dispositivo, interacciones, audio y comprensión del mensaje.",
  },
];

let topicFilter = "all";
function renderTopics() {
  $("#topicFilters").innerHTML = Object.entries(TOPIC_GROUPS).map(([k, v]) =>
    `<button class="seg-btn ${k === topicFilter ? "active" : ""}" data-g="${k}" role="radio" aria-checked="${k === topicFilter}">${v}</button>`).join("");
  $("#topicList").innerHTML = TOPICS.filter(t => topicFilter === "all" || t.g === topicFilter).map(t => `
    <details class="accordion topic">
      <summary><span><span class="chip chip-topic">${TOPIC_GROUPS[t.g]}</span> ${t.t}</span></summary>
      <div class="accordion-body">
        <p class="topic-now"><b>Hoy:</b> ${t.now}</p>
        <h4>Cómo hacerlo</h4>
        <ol class="numbered">${t.steps.map(s => `<li>${s}</li>`).join("")}</ol>
        ${t.code ? `<pre><code>${t.code.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>` : ""}
        <p class="topic-test"><b>Cómo comprobarlo:</b> ${t.test}</p>
      </div>
    </details>`).join("");
}
$("#topicFilters").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (b) { topicFilter = b.dataset.g; renderTopics(); }
});
renderTopics();

/* ---------------------------------------------------------
   5b. Sistemas de clic distintos al ratón
   --------------------------------------------------------- */
const INPUT_METHODS = [
  {
    id: "A", t: "Pointer.current", sub: "El cambio más pequeño",
    what: "<code>Pointer</code> representa a «lo último que apuntó a la pantalla»: el ratón, un dedo o un lápiz. Se usa igual que <code>Mouse</code>, así que el script actual casi no cambia.",
    steps: [
      "Abrir el script de interacción del personaje.",
      "Reemplazar <code>Mouse.current</code> por <code>Pointer.current</code>.",
      "Reemplazar <code>leftButton</code> por <code>press</code> (con ratón es el clic izquierdo; con el dedo es tocar la pantalla).",
      "Cambiar el hover: con el dedo no hay «pasar por encima», así que se resalta mientras el dedo presiona (<code>press.isPressed</code>).",
    ],
    code: `Pointer p = Pointer.current;                 // ratón, dedo o lápiz
if (p == null) return;

// Posición en pantalla -> posición en la escena
Vector2 mundo = Camera.main.ScreenToWorldPoint(p.position.ReadValue());
bool encima = bodyCollider.OverlapPoint(mundo);

if (encima && p.press.wasPressedThisFrame)   // antes: leftButton
{
    animator.SetTrigger("IsClicked");
    audioSource.PlayOneShot(audioSource.clip);
}`,
    pros: ["Cambio mínimo sobre el código que ya existe.", "Funciona con ratón, dedo y lápiz."],
    cons: ["Solo sigue al primer dedo: si dos niños tocan a la vez, uno se ignora.", "El doble toque hay que programarlo a mano, midiendo el tiempo entre toques."],
  },
  {
    id: "B", t: "Input Actions (Tap y Multi Tap)", sub: "Configurable sin tocar código",
    what: "Las <b>Input Actions</b> son un archivo donde se definen acciones como «Tocar» o «Doble toque» y qué las dispara. Unity ya trae las interacciones <b>Tap</b> (toque) y <b>Multi Tap</b> (varios toques seguidos), así que los tiempos se ajustan desde el editor.",
    steps: [
      "En Project: <i>Create → Input Actions</i>, por ejemplo <code>ControlesCuento</code>, y crear un Action Map llamado «Escena».",
      "Acción <b>Tocar</b> (tipo Button) con el binding <code>&lt;Pointer&gt;/press</code> e interacción <b>Tap</b>.",
      "Acción <b>DobleToque</b> (tipo Button) con el mismo binding e interacción <b>Multi Tap</b>: Tap Count 2, Max Tap Spacing 0,3 s.",
      "Acción <b>Posicion</b> (tipo Value, Vector2) con el binding <code>&lt;Pointer&gt;/position</code>.",
      "En el script, recibir las acciones con <code>InputActionReference</code> y asignarlas en el Inspector.",
    ],
    code: `[SerializeField] InputActionReference tocar, dobleToque, posicion;

void OnEnable()
{
    tocar.action.performed += AlTocar;
    dobleToque.action.performed += AlDobleToque;
    tocar.action.Enable(); dobleToque.action.Enable(); posicion.action.Enable();
}

void OnDisable()
{
    tocar.action.performed -= AlTocar;
    dobleToque.action.performed -= AlDobleToque;
}

bool Encima()
{
    Vector2 mundo = Camera.main.ScreenToWorldPoint(posicion.action.ReadValue<Vector2>());
    return bodyCollider.OverlapPoint(mundo);
}

void AlTocar(InputAction.CallbackContext c)      { if (Encima()) animator.SetTrigger("IsClicked"); }
void AlDobleToque(InputAction.CallbackContext c) { if (Encima()) animator.SetTrigger("DoubleTap"); }`,
    pros: ["Tiempos y controles se cambian desde el editor, sin programar.", "Se pueden agregar otros controles (teclado, mando) a la misma acción."],
    cons: ["Más piezas que preparar: archivo de acciones, referencias y activación.", "Si Tap y Multi Tap usan el mismo binding, el primer toque también dispara «Tocar»: hay que decidir si eso es aceptable."],
  },
  {
    id: "C", t: "Event System + IPointerClickHandler", sub: "Recomendado",
    what: "Es el mismo sistema que usan los botones de la interfaz de Unity. En lugar de preguntar en cada fotograma «¿me tocaron?», Unity <b>avisa</b> al personaje cuando lo tocan, cuando el cursor o el dedo entra y cuando sale.",
    steps: [
      "En la escena: <i>GameObject → UI → Event System</i>. Si Unity lo sugiere, pulsar <i>Replace with InputSystemUIInputModule</i> para usar el Input System nuevo.",
      "En la <b>Main Camera</b>: <i>Add Component → Physics 2D Raycaster</i>. Permite que los toques «choquen» con los Collider 2D de la escena.",
      "Cada personaje necesita su <b>Collider 2D</b> (ya lo tienen).",
      "Crear un script que implemente las interfaces de puntero y colocarlo en el personaje en lugar del script actual.",
    ],
    code: `using UnityEngine;
using UnityEngine.EventSystems;

public class TocarPersonaje : MonoBehaviour,
    IPointerClickHandler, IPointerEnterHandler, IPointerExitHandler
{
    [SerializeField] Color colorResaltado = new Color(1f, 0.9f, 0.5f);
    Animator animator;
    SpriteRenderer[] partes;
    Color[] originales;

    void Awake()
    {
        animator = GetComponent<Animator>();
        partes = GetComponentsInChildren<SpriteRenderer>();
        originales = System.Array.ConvertAll(partes, p => p.color);
    }

    // Unity llama a esto cuando tocan o hacen clic sobre el personaje
    public void OnPointerClick(PointerEventData e)
    {
        if (e.clickCount >= 2) animator.SetTrigger("DoubleTap");
        else animator.SetTrigger("IsClicked");
    }

    // El cursor (o el dedo al presionar) entra / sale del personaje
    public void OnPointerEnter(PointerEventData e) => Resaltar(true);
    public void OnPointerExit(PointerEventData e)  => Resaltar(false);

    void Resaltar(bool on)
    {
        for (int i = 0; i < partes.Length; i++)
            partes[i].color = on ? colorResaltado : originales[i];
    }
}`,
    pros: ["No hay que revisar nada en cada fotograma: el código es más corto y claro.", "Ratón, dedo y lápiz funcionan igual, y admite varios dedos a la vez.", "<code>clickCount</code> ya cuenta los toques seguidos para el doble toque.", "Con el dedo, el resaltado aparece al presionar y desaparece al soltar, sin código extra."],
    cons: ["Requiere Event System en la escena y Physics 2D Raycaster en la cámara.", "<code>OnPointerClick</code> se dispara al <b>soltar</b> el dedo o el botón. Si se quiere reaccionar al presionar, se usa <code>IPointerDownHandler</code>.", "Un elemento de interfaz encima del personaje bloquea el toque."],
  },
  {
    id: "D", t: "Enhanced Touch", sub: "Solo táctil, varios dedos",
    what: "API pensada exclusivamente para pantallas táctiles: entrega la lista de todos los dedos activos, con su fase (empezó, se movió, terminó) y cuántas veces se tocó seguido.",
    steps: [
      "Activar el soporte al habilitar el script con <code>EnhancedTouchSupport.Enable()</code>.",
      "En cada fotograma, recorrer <code>Touch.activeTouches</code> y atender los toques en fase <code>Began</code>.",
      "Para probar con ratón en el editor, activar <code>TouchSimulation.Enable()</code>.",
    ],
    code: `using UnityEngine.InputSystem.EnhancedTouch;
using Touch = UnityEngine.InputSystem.EnhancedTouch.Touch;
using TouchPhase = UnityEngine.InputSystem.TouchPhase;

void OnEnable()  { EnhancedTouchSupport.Enable(); }
void OnDisable() { EnhancedTouchSupport.Disable(); }

void Update()
{
    foreach (Touch t in Touch.activeTouches)        // todos los dedos
    {
        if (t.phase != TouchPhase.Began) continue;
        Vector2 mundo = Camera.main.ScreenToWorldPoint(t.screenPosition);
        if (!bodyCollider.OverlapPoint(mundo)) continue;

        animator.SetTrigger(t.tapCount >= 2 ? "DoubleTap" : "IsClicked");
    }
}`,
    pros: ["Control total de varios dedos al mismo tiempo.", "<code>tapCount</code> cuenta los toques seguidos."],
    cons: ["No responde al ratón (salvo con simulación), así que en PC habría que mantener otro sistema.", "Más código para algo que la opción C ya resuelve."],
  },
];
let methodIdx = 2; // abre en la recomendada
const methodTabs = $("#methodTabs");
methodTabs.innerHTML = INPUT_METHODS.map((m, i) =>
  `<button class="seg-btn" role="tab" id="method-tab-${i}" aria-controls="methodPanel" data-i="${i}"><b>${m.id}.</b> ${m.t}</button>`).join("");
function renderMethod() {
  const m = INPUT_METHODS[methodIdx];
  $$("button", methodTabs).forEach((b, i) => { b.classList.toggle("active", i === methodIdx); b.setAttribute("aria-selected", i === methodIdx); });
  $("#methodPanel").setAttribute("aria-labelledby", "method-tab-" + methodIdx);
  $("#methodPanel").innerHTML = `<div class="panel-anim">
    <div class="method-head"><h3>${m.id}. ${m.t}</h3><span class="chip ${m.id === "C" ? "chip-done" : "chip-topic"}">${m.sub}</span></div>
    <p>${m.what}</p>
    <div class="method-grid">
      <div><h4>Pasos</h4><ol class="numbered">${m.steps.map(s => `<li>${s}</li>`).join("")}</ol></div>
      <div><h4>Código</h4><pre><code>${m.code.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre></div>
    </div>
    <div class="two-col pros-cons">
      <div class="pros"><h4>Ventajas</h4><ul>${m.pros.map(s => `<li>${s}</li>`).join("")}</ul></div>
      <div class="cons"><h4>A tener en cuenta</h4><ul>${m.cons.map(s => `<li>${s}</li>`).join("")}</ul></div>
    </div></div>`;
}
methodTabs.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { methodIdx = +b.dataset.i; renderMethod(); } });
renderMethod();

// Demostración web: detectar con qué se toca y contar toques seguidos
(function inputDemo() {
  const pad = $("#inputPad"), layer = $("#rippleLayer");
  const NAMES = { mouse: "🖱 Ratón", touch: "👆 Dedo", pen: "✏️ Lápiz" };
  const inputKid = kid($("#inputKid"));
  // Igual que IsCliked.cs: se espera el tiempo de doble clic y luego se decide la animación
  const SINGLE = "IsClicked → Saludar", DOUBLE = "IsDoubleClicked → Pensar";
  const single = () => { inputKid.play("wave"); $("#inputAction").textContent = SINGLE; };
  const double = () => { inputKid.play("question"); $("#inputAction").textContent = DOUBLE; };
  const counter = clickCounter(single, double);
  pad.addEventListener("pointerdown", e => {
    const count = counter();
    $("#inputType").textContent = NAMES[e.pointerType] || e.pointerType || "Desconocido";
    $("#inputCount").textContent = count;
    $("#inputAction").textContent = "Esperando 0,5 s por un segundo toque…";
    // Onda visual en el punto tocado
    const r = pad.getBoundingClientRect();
    const dot = document.createElement("span");
    dot.className = "ripple";
    dot.style.left = e.clientX - r.left + "px";
    dot.style.top = e.clientY - r.top + "px";
    layer.appendChild(dot);
    setTimeout(() => dot.remove(), 600);
  });
  pad.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      single();
      $("#inputType").textContent = "⌨️ Teclado";
      $("#inputCount").textContent = 1;
    }
  });
})();

/* ---------------------------------------------------------
   5c. Videos paso a paso (sprites y huesos) con capítulos
   --------------------------------------------------------- */
// Subir este número al volver a generar los videos, para que el navegador no use la copia en caché
const VIDEO_VERSION = 2;
const VIDEOS = {
  sprites: {
    title: "Proceso con sprites",
    chapters: [[0, "Introducción"], [3.5, "1. Importar la hoja de sprites"], [8.5, "2. Cortar en el Sprite Editor"],
      [14.5, "3. Crear el clip de reposo"], [22.5, "4. Crear el clip de pensar"], [30.5, "5. Conectar en el Animator"], [36.5, "Resultado"]],
    // Archivos reales que intervienen en este proceso (en el orden en que se usan)
    files: [
      ["png", "Hoja de sprites del niño", "Hoja de sprites_ niño chibi animado.png · 1983 × 793 px, 16 dibujos (reposo y pensar). Se importa como <b>Sprite (2D and UI)</b> con <b>Sprite Mode: Multiple</b> y se corta en el Sprite Editor."],
      ["png", "Hoja del saludo", "Sprite de niño saludando.png · 2172 × 724 px, 8 dibujos. Mismo tratamiento que la anterior."],
      ["anim", "Clips de animación", "AnimationKid, AnimationQuestion y Saludar. Los crea Unity al arrastrar los dibujos a la escena o desde la ventana Animation."],
      ["controller", "Animator Controller", "AnimatorKid: estados Idle, Saludar y Question, con los parámetros IsClicked e IsDoubleClicked."],
      ["wav", "Efecto de sonido", "sonido_pensar_kid.wav · 1,1 s, mono, 44,1 kHz. Lo reproduce el Audio Source del niño."],
      ["cs", "Script", "IsCliked.cs: detecta el clic y el doble clic y activa los triggers."],
    ],
    note: "Formatos de imagen que también sirven: <b>.psd</b>, <b>.jpg</b> (sin transparencia, no conviene para personajes) y <b>.aseprite</b> (el proyecto tiene instalado el 2D Aseprite Importer, que convierte sus etiquetas en clips). Se recomienda <b>.png</b> porque guarda la transparencia sin perder calidad.",
  },
  huesos: {
    title: "Proceso con huesos",
    chapters: [[0, "Introducción"], [3.5, "1. Dibujar por capas"], [11, "2. Importar el .psb"], [15.5, "3. Crear los huesos"],
      [23.5, "4. Generar la geometría"], [28.5, "5. Asignar los pesos"], [33.5, "6. Probar poses"],
      [39, "7. Keyframes: respiración"], [45, "8. Keyframes: salto y saludo"], [51, "Resultado"]],
    files: [
      ["psb", "Ilustración por capas", "NewChar.psb · 600 × 760 px, 15 capas, 3,7 MB. Lo importa el paquete <b>2D PSD Importer</b>; el esqueleto, la geometría y los pesos se guardan en la configuración de importación de este archivo (su .meta)."],
      ["anim", "Clips de animación", "NewChar_Idle, NewChar_Clicked y NewChar_Question. Guardan solo rotaciones y escalas de los huesos."],
      ["controller", "Animator Controller", "AnimatorNewChar: estados Idle, Clicked y Question."],
      ["png", "Signo de pregunta", "question_mark.png: imagen extra que aparece durante la pregunta."],
      ["cs", "Script", "IsClickedRig.cs: hover, clic y doble clic de la niña."],
    ],
    note: "<b>¿Hace falta un .fbx?</b> No. Con huesos 2D el esqueleto se crea dentro de Unity sobre el .psb, así que no se exporta nada desde otro programa. El <b>.fbx</b> solo se necesita cuando el personaje llega ya armado desde un programa 3D (Blender, Maya, Mixamo) con su esqueleto y sus animaciones: ver la diapositiva <a href=\"#recursos\">Recursos ya hechos</a>. También sirve <b>.psd</b>, pero <b>.psb</b> admite archivos más grandes y es el que recomienda Unity.",
  },
};
(function videos() {
  const video = $("#howtoVideo");
  const list = $("#videoChapters");
  let current = "sprites";
  function load(key) {
    current = key;
    const v = VIDEOS[key];
    $("#videoTitle").textContent = v.title;
    video.pause();
    video.poster = `assets/video/${key}_poster.jpg?v=${VIDEO_VERSION}`;
    video.querySelector("source").src = `assets/video/${key}.mp4?v=${VIDEO_VERSION}`;
    video.load();
    list.innerHTML = v.chapters.map(([t, name], i) => `<li><button data-t="${t}" data-i="${i}">${name}</button></li>`).join("");
    $("#videoFiles").innerHTML = `<h4>Archivos que usa este proceso</h4>
      <ul class="file-grid">${v.files.map(([ext, name, desc]) => `<li class="file-chip"><span class="ext ext-${ext}">.${ext}</span><div><b>${name}</b><span>${desc}</span></div></li>`).join("")}</ul>
      <p class="note note-info">${v.note}</p>`;
    $$("[data-video]").forEach(b => { const on = b.dataset.video === key; b.classList.toggle("active", on); b.setAttribute("aria-selected", on); });
  }
  $$("[data-video]").forEach(b => b.addEventListener("click", () => load(b.dataset.video)));
  list.addEventListener("click", e => {
    const b = e.target.closest("button");
    if (!b) return;
    video.currentTime = +b.dataset.t + 0.05;
    video.play().catch(() => {});
  });
  // Resalta el capítulo que se está viendo
  video.addEventListener("timeupdate", () => {
    const ch = VIDEOS[current].chapters;
    let idx = 0;
    ch.forEach(([t], i) => { if (video.currentTime >= t) idx = i; });
    $$("button", list).forEach((b, i) => b.classList.toggle("on", i === idx));
  });
  load("sprites");
})();

// Diapositiva «Recursos ya hechos»: pestañas por tipo de recurso
(function assetTabs() {
  const tabs = $$("[data-asset]");
  tabs.forEach(b => b.addEventListener("click", () => {
    tabs.forEach(t => { const on = t === b; t.classList.toggle("active", on); t.setAttribute("aria-selected", on); });
    $$(".asset-panel").forEach(p => p.hidden = p.id !== "asset-" + b.dataset.asset);
  }));
})();

/* ---------------------------------------------------------
   6. Diagrama interactivo del flujo de una interacción
   --------------------------------------------------------- */
const FLOW = [
  { t: "El usuario interactúa", b: "El niño hace clic sobre el personaje. En el prototipo el personaje está en <b>AnimationKid</b>, su animación de reposo en bucle." },
  { t: "El sistema detecta la entrada", b: "En cada fotograma, el script pregunta al <b>Input System</b> si el botón izquierdo del ratón se presionó en ese instante (<code>wasPressedThisFrame</code>)." },
  { t: "¿La acción es para este personaje?", b: "La posición del ratón se convierte a coordenadas de la escena y se comprueba si cae dentro del <b>Collider 2D</b> del personaje (<code>OverlapPoint</code>). Si el clic fue en otro lugar, no ocurre nada." },
  { t: "Se activa el parámetro", b: "El script llama a <code>SetTrigger(\"IsClicked\")</code>. Es como tocar un timbre: el Animator recibe el aviso. En el mismo momento se reproduce el sonido «pensar». Antes, el script espera 0,5 s: si llega un segundo clic, en lugar de <code>IsClicked</code> activa <code>IsDoubleClicked</code>." },
  { t: "El Animator cambia de estado", b: "La transición <b>Idle → Saludar</b> tiene la condición <code>IsClicked</code> y no espera a que termine el reposo (Has Exit Time desactivado), así que cambia de inmediato." },
  { t: "Se reproduce la animación", b: "Se reproduce <b>Saludar</b>: 8 dibujos a 7 por segundo en los que el niño levanta la mano y saluda. Con doble clic se reproduce <b>AnimationQuestion</b>: se lleva la mano a la barbilla y aparece un signo de pregunta." },
  { t: "Regreso al reposo", b: "Las transiciones <b>Saludar → Idle</b> y <b>Question → Idle</b> usan Has Exit Time: cuando la animación termina, el personaje vuelve solo a <b>AnimationKid</b> y queda listo para otro clic." },
];
let flowIdx = 0;
const flowList = $("#flowSteps");
const flowPanel = $("#flowPanel");
// El niño acompaña cada paso: reposo, destello al detectar el clic, saludar y regreso al reposo
const flowKid = kid($("#flowKid"));
function flowPose() {
  $(".flow-visual").classList.toggle("flash", flowIdx === 1 || flowIdx === 2);
  flowKid.play(flowIdx >= 3 && flowIdx <= 5 ? "wave" : "idle");
}
flowList.innerHTML = FLOW.map((f, i) => `<li><button role="tab" id="flow-tab-${i}" aria-controls="flowPanel" aria-selected="false" data-i="${i}"><span class="n">${i + 1}</span>${f.t}</button></li>`).join("");
function renderFlow() {
  $$("button", flowList).forEach((b, i) => b.setAttribute("aria-selected", i === flowIdx));
  const f = FLOW[flowIdx];
  flowPanel.setAttribute("aria-labelledby", "flow-tab-" + flowIdx);
  flowPanel.innerHTML = `<div class="panel-anim"><span class="tag tag-blue">Paso ${flowIdx + 1} de ${FLOW.length}</span><h3>${f.t}</h3><p>${f.b}</p>
    <div class="panel-nav"><button class="btn btn-small" id="flowPrev" ${flowIdx === 0 ? "disabled" : ""}>‹ Anterior</button>
    <button class="btn btn-small btn-action-soft" id="flowNext" ${flowIdx === FLOW.length - 1 ? "disabled" : ""}>Siguiente ›</button></div></div>`;
  $("#flowPrev").onclick = () => { flowIdx--; renderFlow(); };
  $("#flowNext").onclick = () => { flowIdx++; renderFlow(); };
  flowPose();
}
flowList.addEventListener("click", e => { const b = e.target.closest("button"); if (b) { flowIdx = +b.dataset.i; renderFlow(); } });
flowList.addEventListener("keydown", e => {
  if (e.key === "ArrowDown" || e.key === "ArrowUp") {
    e.preventDefault();
    flowIdx = (flowIdx + (e.key === "ArrowDown" ? 1 : FLOW.length - 1)) % FLOW.length;
    renderFlow();
    $(`#flow-tab-${flowIdx}`).focus();
  }
});
renderFlow();

/* ---------------------------------------------------------
   7. Capas reales de la niña (etapa 1)
   --------------------------------------------------------- */
const PART_NAMES = {
  hair_back: "Cabello trasero", backpack: "Mochila", leg_L: "Pierna izq.", leg_R: "Pierna der.",
  foot_L: "Pie izq.", foot_R: "Pie der.", torso: "Torso", arm_upper_L: "Brazo izq.", arm_lower_L: "Antebrazo izq.",
  hand_L: "Mano izq.", arm_upper_R: "Brazo der.", arm_lower_R: "Antebrazo der.", hand_R: "Mano der.",
  head: "Cabeza", hair_front: "Flequillo",
};
$("#partsGrid").innerHTML = Object.entries(PART_NAMES).map(([f, n]) =>
  `<div class="part"><img src="assets/images/partes/${f}.png" alt="${n}" loading="lazy"><span>${n}</span></div>`).join("");

/* ---------------------------------------------------------
   8. Demostración de pesos (canvas)
   Un brazo de dos huesos. Cada vértice se mueve según la mezcla
   de influencia (peso) entre el hueso del brazo y el del antebrazo.
   --------------------------------------------------------- */
(function weightsDemo() {
  const cv = $("#weightsCanvas");
  const ctx = cv.getContext("2d");
  const angleInput = $("#elbowAngle");
  let mode = "good";
  const shoulder = { x: 90, y: 150 }, L1 = 180, L2 = 170, W = 34, N = 40;

  // Peso del antebrazo según la posición a lo largo del brazo (0 = hombro, 1 = mano)
  function forearmWeight(t) {
    const j = L1 / (L1 + L2); // posición del codo
    if (mode === "good") {
      const k = (t - (j - 0.06)) / 0.12; // mezcla suave alrededor del codo
      return Math.min(1, Math.max(0, k));
    }
    // Mal asignado: el antebrazo «agarra» media parte del brazo superior
    return t > j * 0.45 ? 1 : 0;
  }

  function draw() {
    const a = (angleInput.value * Math.PI) / 180;
    const elbow = { x: shoulder.x + L1, y: shoulder.y };
    ctx.clearRect(0, 0, cv.width, cv.height);

    const top = [], bot = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, d = t * (L1 + L2);
      const w = forearmWeight(t);
      [[-W / 2, top], [W / 2, bot]].forEach(([off, arr]) => {
        const p = { x: shoulder.x + d, y: shoulder.y + off };
        // Posición si siguiera al antebrazo: rotar alrededor del codo
        const dx = p.x - elbow.x, dy = p.y - elbow.y;
        const q = { x: elbow.x + dx * Math.cos(a) - dy * Math.sin(a), y: elbow.y + dx * Math.sin(a) + dy * Math.cos(a) };
        arr.push({ x: p.x * (1 - w) + q.x * w, y: p.y * (1 - w) + q.y * w, w });
      });
    }
    // Piel del brazo, coloreada por peso: azul = brazo, naranja = antebrazo
    for (let i = 0; i < N; i++) {
      const w = (top[i].w + top[i + 1].w) / 2;
      ctx.fillStyle = `rgb(${Math.round(120 + 120 * w)}, ${Math.round(170 - 30 * w)}, ${Math.round(230 - 180 * w)})`;
      ctx.beginPath();
      ctx.moveTo(top[i].x, top[i].y); ctx.lineTo(top[i + 1].x, top[i + 1].y);
      ctx.lineTo(bot[i + 1].x, bot[i + 1].y); ctx.lineTo(bot[i].x, bot[i].y);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.stroke(); // tapa las uniones entre segmentos
    }
    ctx.strokeStyle = "#2d2a3a"; ctx.lineWidth = 3;
    ctx.beginPath(); top.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();
    ctx.beginPath(); bot.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke();

    // Huesos
    const hand = { x: elbow.x + L2 * Math.cos(a), y: elbow.y + L2 * Math.sin(a) };
    ctx.lineWidth = 6; ctx.strokeStyle = "rgba(45,42,58,.75)";
    ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(elbow.x, elbow.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    [shoulder, elbow].forEach(p => { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, 7); ctx.fill(); ctx.stroke(); });

    ctx.font = "700 13px Nunito, sans-serif"; ctx.fillStyle = "#3a74d6"; ctx.fillText("Azul: sigue al brazo", 16, 26);
    ctx.fillStyle = "#c8640a"; ctx.fillText("Naranja: sigue al antebrazo", 16, 46);
    $("#weightsNote").textContent = mode === "good"
      ? "La influencia cambia de forma gradual justo en el codo: la articulación se dobla con naturalidad."
      : "El antebrazo influye sobre parte del brazo superior: el brazo se dobla en el lugar equivocado y se deforma.";
  }
  angleInput.addEventListener("input", draw);
  $$("[data-weights]").forEach(b => b.addEventListener("click", () => {
    mode = b.dataset.weights;
    $$("[data-weights]").forEach(x => { x.classList.toggle("active", x === b); x.setAttribute("aria-checked", x === b); });
    draw();
  }));
  document.fonts && document.fonts.ready.then(draw);
  draw();
})();

/* ---------------------------------------------------------
   9. La niña con huesos, armada con sus capas reales
   Coordenadas en píxeles del documento .psb (600 × 760).
   Se usa en la portada y en la diapositiva de huesos.
   --------------------------------------------------------- */
const RIG_POS = {
  hair_back: [72, 94], backpack: [182, 379], leg_L: [239, 544], leg_R: [306, 544], foot_L: [214, 679], foot_R: [298, 679],
  torso: [187, 364], arm_upper_L: [177, 384], arm_lower_L: [171, 447], hand_L: [162, 522],
  arm_upper_R: [340, 384], arm_lower_R: [372, 447], hand_R: [382, 522], head: [154, 128], hair_front: [142, 95],
};
const HIP_Y = 575, SHOULDER_Y = 412, BREATH = 0.03; // el pecho se estira un 3 % desde la cadera

function buildRig(host) {
  const img = n => `<img src="assets/images/partes/${n}.png" alt="" draggable="false" style="left:${RIG_POS[n][0]}px;top:${RIG_POS[n][1]}px">`;
  // Hueso visual: desde (x1,y1) hasta (x2,y2)
  const bone = (x1, y1, x2, y2) => {
    const len = Math.hypot(x2 - x1, y2 - y1), ang = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    return `<span class="bone" style="left:${x1}px;top:${y1}px;width:${len}px;transform:rotate(${ang}deg)"></span>`;
  };
  // Grupo articulado: gira alrededor de su articulación (origen)
  const g = (j, ox, oy, inner) => `<div class="g" data-j="${j}" style="transform-origin:${ox}px ${oy}px">${inner}</div>`;
  const side = s => v => (s === "L" ? v : 600 - v);
  const arm = s => {
    const m = side(s);
    return g("arm_upper_" + s, m(232), SHOULDER_Y,
      img("arm_upper_" + s) + bone(m(232), SHOULDER_Y, m(205), 474) +
      g("arm_lower_" + s, m(205), 474,
        img("arm_lower_" + s) + bone(m(205), 474, m(192), 532) +
        g("hand_" + s, m(192), 532, img("hand_" + s) + bone(m(192), 532, m(190), 568))));
  };
  const leg = s => {
    const m = side(s);
    return g("leg_" + s, m(268), HIP_Y, img("leg_" + s) + bone(m(268), HIP_Y, m(265), 688) +
      g("foot_" + s, m(265), 688, img("foot_" + s) + bone(m(265), 688, m(250), 712)));
  };
  // Se respeta el orden de las capas del .psb. Como el cabello trasero va detrás del torso pero
  // pertenece a la cabeza, cabeza y cuerpo aparecen en dos grupos que se animan siempre juntos:
  //   "body" = torso y mochila: se estira desde la cadera (respiración)
  //   "up"   = brazos y cabeza: suben exactamente lo que se estira el torso, así no se separan
  host.innerHTML = `<div class="rig-canvas">
    ${g("root", 300, 700, `
      ${g("up", 300, SHOULDER_Y, g("head", 300, 392, img("hair_back")))}
      ${g("body", 300, HIP_Y, img("backpack"))}
      ${leg("L")}${leg("R")}
      ${g("body", 300, HIP_Y, img("torso") + bone(300, HIP_Y, 300, 480) + bone(300, 480, 300, 395))}
      ${g("up", 300, SHOULDER_Y, arm("L") + arm("R") + g("head", 300, 392, img("head") + img("hair_front") + bone(300, 392, 300, 150)))}
    `)}
    <img class="rig-q" src="assets/images/question_mark.png" alt="" draggable="false">
  </div>`;
  const canvas = $(".rig-canvas", host);
  const all = j => $$(`[data-j="${j}"]`, canvas);

  function fit() {
    const s = Math.min(host.clientWidth / 600, host.clientHeight / 760);
    if (s > 0) canvas.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  new ResizeObserver(fit).observe(host);
  fit();

  const lift = k => `translateY(${-(k - 1) * (HIP_Y - SHOULDER_Y)}px)`; // cuánto sube el hombro si el torso se escala k
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const anim = (j, frames, o) => all(j).map(el => el.animate(frames, o));

  // Reposo (como NewChar_Idle, 2 s en bucle): respiración, cabeza y brazos se mecen
  if (!reduce) {
    const loop = { duration: 2000, iterations: Infinity, easing: "ease-in-out" };
    anim("body", [{ transform: "scaleY(1)" }, { transform: `scaleY(${1 + BREATH})` }, { transform: "scaleY(1)" }], loop);
    anim("up", [{ transform: lift(1) }, { transform: lift(1 + BREATH) }, { transform: lift(1) }], loop);
    anim("head", [{ transform: "rotate(0)" }, { transform: "rotate(1.5deg)" }, { transform: "rotate(0)" }], loop);
    anim("arm_upper_L", [{ transform: "rotate(0)" }, { transform: "rotate(2.5deg)" }, { transform: "rotate(0)" }], loop);
    anim("arm_upper_R", [{ transform: "rotate(0)" }, { transform: "rotate(-2.5deg)" }, { transform: "rotate(0)" }], loop);
  }

  // Acción (como NewChar_Clicked, 1,3 s): se agacha, salta, saluda con el brazo derecho y aterriza.
  // El brazo se levanta hacia afuera, para que la mano quede delante del cabello y no detrás de la cabeza.
  let busy = false;
  function wave() {
    if (busy) return;
    busy = true;
    const o = { duration: 1300, easing: "ease-in-out", composite: "replace" };
    const done = anim("root", [
      { transform: "translateY(0)", offset: 0 }, { transform: "translateY(12px)", offset: 0.1 },
      { transform: "translateY(-60px)", offset: 0.32 }, { transform: "translateY(0)", offset: 0.55 },
      { transform: "translateY(5px)", offset: 0.62 }, { transform: "translateY(0)", offset: 1 }], o);
    anim("body", [{ transform: "scaleY(1)", offset: 0 }, { transform: "scaleY(.97)", offset: 0.1 }, { transform: "scaleY(1)", offset: 0.22 },
      { transform: "scaleY(.98)", offset: 0.62 }, { transform: "scaleY(1)", offset: 1 }], o);
    anim("up", [{ transform: lift(1), offset: 0 }, { transform: lift(.97), offset: 0.1 }, { transform: lift(1), offset: 0.22 },
      { transform: lift(.98), offset: 0.62 }, { transform: lift(1), offset: 1 }], o);
    anim("arm_upper_R", [{ transform: "rotate(0)", offset: 0 }, { transform: "rotate(-80deg)", offset: 0.18 },
      { transform: "rotate(-80deg)", offset: 0.78 }, { transform: "rotate(0)", offset: 1 }], o);
    anim("arm_lower_R", [{ transform: "rotate(0)", offset: 0 }, { transform: "rotate(-60deg)", offset: 0.18 },
      { transform: "rotate(-88deg)", offset: 0.3 }, { transform: "rotate(-55deg)", offset: 0.42 }, { transform: "rotate(-88deg)", offset: 0.54 },
      { transform: "rotate(-55deg)", offset: 0.66 }, { transform: "rotate(-60deg)", offset: 0.78 }, { transform: "rotate(0)", offset: 1 }], o);
    anim("arm_upper_L", [{ transform: "rotate(0)" }, { transform: "rotate(8deg)", offset: 0.32 }, { transform: "rotate(0)", offset: 0.62 }, { transform: "rotate(0)" }], o);
    anim("head", [{ transform: "rotate(0)" }, { transform: "rotate(-5deg)", offset: 0.23 }, { transform: "rotate(-5deg)", offset: 0.77 }, { transform: "rotate(0)" }], o);
    anim("leg_L", [{ transform: "rotate(0)" }, { transform: "rotate(6deg)", offset: 0.32 }, { transform: "rotate(0)", offset: 0.55 }, { transform: "rotate(0)" }], o);
    anim("leg_R", [{ transform: "rotate(0)" }, { transform: "rotate(-6deg)", offset: 0.32 }, { transform: "rotate(0)", offset: 0.55 }, { transform: "rotate(0)" }], o);
    done[0].finished.then(() => { busy = false; });
  }

  // Pregunta (como NewChar_Question, 1,6 s): lleva la mano derecha hacia la barbilla, ladea la cabeza,
  // da dos toquecitos «pensando» y aparece un signo de pregunta, igual que en el niño.
  function question() {
    if (busy) return;
    busy = true;
    const o = { duration: 1600, easing: "ease-in-out", composite: "replace" };
    const done = anim("arm_upper_R", [{ transform: "rotate(0)" }, { transform: "rotate(9.5deg)", offset: 0.19 },
      { transform: "rotate(9.5deg)", offset: 0.78 }, { transform: "rotate(0)" }], o);
    anim("arm_lower_R", [{ transform: "rotate(0)" }, { transform: "rotate(117deg)", offset: 0.19 },
      { transform: "rotate(109deg)", offset: 0.34 }, { transform: "rotate(117deg)", offset: 0.5 }, { transform: "rotate(109deg)", offset: 0.66 },
      { transform: "rotate(117deg)", offset: 0.78 }, { transform: "rotate(0)" }], o);
    anim("hand_R", [{ transform: "rotate(0)" }, { transform: "rotate(10.5deg)", offset: 0.19 }, { transform: "rotate(10.5deg)", offset: 0.78 }, { transform: "rotate(0)" }], o);
    anim("arm_upper_L", [{ transform: "rotate(0)" }, { transform: "rotate(2deg)", offset: 0.5 }, { transform: "rotate(0)" }], o);
    anim("head", [{ transform: "rotate(0)" }, { transform: "rotate(5deg)", offset: 0.19 }, { transform: "rotate(2deg)", offset: 0.44 },
      { transform: "rotate(5deg)", offset: 0.62 }, { transform: "rotate(5deg)", offset: 0.78 }, { transform: "rotate(0)" }], o);
    anim("body", [{ transform: "scaleY(1)" }, { transform: "scaleY(1.02)", offset: 0.19 }, { transform: "scaleY(1)", offset: 0.44 },
      { transform: "scaleY(1.02)", offset: 0.62 }, { transform: "scaleY(1)" }], o);
    anim("up", [{ transform: lift(1) }, { transform: lift(1.02), offset: 0.19 }, { transform: lift(1), offset: 0.44 },
      { transform: lift(1.02), offset: 0.62 }, { transform: lift(1) }], o);
    $(".rig-q", canvas).animate([
      { transform: "scale(0) rotate(0)", offset: 0 }, { transform: "scale(0) rotate(0)", offset: 0.125 },
      { transform: "scale(1.15) rotate(-5deg)", offset: 0.22 }, { transform: "scale(1) rotate(-10deg)", offset: 0.28 },
      { transform: "translateY(-14px) rotate(8deg)", offset: 0.5 }, { transform: "scale(1) rotate(-6deg)", offset: 0.75 },
      { transform: "scale(0) rotate(0)", offset: 0.875 }, { transform: "scale(0) rotate(0)", offset: 1 }], { duration: 1600, easing: "ease-out" });
    done[0].finished.then(() => { busy = false; });
  }
  return { wave, question, fit };
}

// Portada: la niña saluda con un clic y pregunta con doble clic (como IsClickedRig.cs)
const heroRig = buildRig($("#heroRig"));
$("#heroGirlBtn").addEventListener("click", clickCounter(heroRig.wave, heroRig.question));

// Diapositiva de huesos: mostrar el esqueleto, saludar o preguntar (botones, o clic / doble clic sobre ella)
const demoRig = buildRig($("#rigHost"));
$("#rigWave").addEventListener("click", demoRig.wave);
$("#rigQuestion").addEventListener("click", demoRig.question);
$("#rigStage").addEventListener("click", clickCounter(demoRig.wave, demoRig.question));
const bonesBtn = $("#rigBones");
bonesBtn.addEventListener("click", () => {
  const on = $("#rigStage").classList.toggle("show-bones");
  bonesBtn.setAttribute("aria-pressed", on);
  bonesBtn.textContent = on ? "Ocultar huesos" : "Mostrar huesos";
});

/* ---------------------------------------------------------
   10. Demostración de hover
   --------------------------------------------------------- */
(function hoverDemo() {
  const stage = $("#hoverStage");
  const status = $("#hoverStatus");
  let style = "brighten";
  stage.classList.add(style);
  // El niño respira en reposo; el tono cálido usa el fotograma actual como máscara para no salirse de la silueta
  kid($("#hoverImg"), p => stage.style.setProperty("--kid-mask", `url("${KID_FRAMES[p.clip][p.frame]}")`));
  const set = on => {
    stage.classList.toggle("on", on);
    status.textContent = on ? "Cursor encima: el personaje está resaltado." : "Cursor fuera: se restauró el color original.";
  };
  // Ratón: resaltar al entrar, restaurar al salir
  stage.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") set(true); });
  stage.addEventListener("pointerleave", e => { if (e.pointerType === "mouse") set(false); });
  // Táctil: no hay cursor persistente, así que se usa un destello breve al tocar
  stage.addEventListener("pointerdown", e => {
    if (e.pointerType !== "mouse") {
      set(true);
      status.textContent = "Toque: destello breve, porque en pantalla táctil no existe el hover.";
      setTimeout(() => stage.classList.remove("on"), 250);
    }
  });
  // Teclado: el foco equivale a pasar el cursor
  stage.addEventListener("focus", () => set(true));
  stage.addEventListener("blur", () => set(false));
  $$("[data-hover]").forEach(b => b.addEventListener("click", () => {
    stage.classList.remove(style);
    style = b.dataset.hover;
    stage.classList.add(style);
    $$("[data-hover]").forEach(x => { x.classList.toggle("active", x === b); x.setAttribute("aria-checked", x === b); });
  }));
})();

/* ---------------------------------------------------------
   13. Arquitectura conceptual
   --------------------------------------------------------- */
const ARCH = [
  { t: "Entrada del usuario", b: "Clic, toque o, en el futuro, otras formas de interacción. Leerla desde un solo lugar facilita agregar el soporte táctil." },
  { t: "Detección de interacción", b: "Decide <b>qué</b> elemento se tocó (colliders) y <b>cómo</b> (un toque, doble toque, mantener presionado)." },
  { t: "Sistema de acciones", b: "Traduce la interacción en una acción del personaje u objeto: «comer», «sorber», «saludar». Cada elemento define sus propias acciones sin tocar el código de los demás." },
  { t: "Animator", b: "Recibe la acción como parámetro y cambia al estado de animación correspondiente, con sus transiciones de entrada y de vuelta al reposo." },
  { t: "Audio y respuesta visual", b: "Reproduce el sonido sincronizado y los efectos visuales (resaltado, destellos), y en el futuro los mensajes educativos." },
];
const archEl = $("#archDiagram");
archEl.innerHTML = ARCH.map((a, i) => `${i ? '<span class="arrow">→</span>' : ""}<button data-i="${i}" aria-pressed="false">${a.t}</button>`).join("");
function renderArch(i) {
  $$("button", archEl).forEach((b, j) => { b.classList.toggle("active", i === j); b.setAttribute("aria-pressed", i === j); });
  $("#archPanel").innerHTML = `<h3>${ARCH[i].t}</h3><p>${ARCH[i].b}</p>`;
}
archEl.addEventListener("click", e => { const b = e.target.closest("button"); if (b) renderArch(+b.dataset.i); });
renderArch(0);

/* ---------------------------------------------------------
   14. Abrir en la diapositiva del enlace (por ejemplo …/#prototipo) o en la portada
   --------------------------------------------------------- */
showSlide(Math.max(0, indexOfId(location.hash.slice(1))), { updateHash: false });
