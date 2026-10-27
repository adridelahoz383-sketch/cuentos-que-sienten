# Cuentos que Sienten · Presentación web del prototipo

Presentación web por diapositivas (13) que explica el prototipo y ejecuta la compilación **real** de Unity (WebGL) dentro del navegador. Se navega con las pestañas numeradas, las flechas laterales, las miniaturas, el teclado (← →) o deslizando en pantallas táctiles. Cada diapositiva tiene su dirección (por ejemplo `#prototipo`).

## Estructura

```
presentacion-cuentos/
├── index.html          Página única con todas las secciones
├── styles.css          Estilos (responsive)
├── script.js           Navegación, demostraciones web y cargador de Unity
├── README.md           Este archivo
├── assets/
│   ├── images/
│   │   ├── escena_unity.png     Captura de SampleScene (pantalla previa del reproductor)
│   │   ├── nina_completa.png    La niña compuesta desde sus capas
│   │   ├── kid/                 24 fotogramas reales del niño (idle_0-7, question_0-7, wave_0-7)
│   │   ├── question_mark.png    Signo de pregunta de la niña (el mismo sprite que usa Unity)
│   │   └── partes/              15 capas reales de NewChar.psb
│   ├── audio/
│   │   ├── sonido_pensar_kid.wav
│   │   └── musica_fondo_cuentos_que_sienten.wav
│   ├── video/
│   │   ├── sprites.mp4 / sprites_poster.jpg   Proceso de animación por sprites (niño)
│   │   └── huesos.mp4 / huesos_poster.jpg     Proceso de animación por huesos (niña)
│   └── icons/                   (vacío: los iconos son emoji/texto)
├── herramientas/
│   ├── generar_videos.py        Vuelve a generar los dos videos a partir de los recursos del proyecto
│   └── servidor.py              Servidor local con soporte de Range (para poder adelantar los videos)
└── unity-build/                 Compilación WebGL generada por Unity
    ├── index.html               Reproductor por defecto de Unity (no lo usa la presentación)
    ├── Build/
    │   ├── unity-build.loader.js
    │   ├── unity-build.data.unityweb
    │   ├── unity-build.framework.js.unityweb
    │   └── unity-build.wasm.unityweb
    └── TemplateData/
```

Las rutas de la compilación están en `script.js`, en la constante `UNITY_BUILD`. Si se vuelve a compilar con otro nombre de carpeta o con otra compresión, los nombres de archivo cambian y hay que actualizarlas.

## Procedencia de los recursos

| Recurso | Origen |
|---|---|
| Fotogramas del niño | `Assets/Brackeys/2D Mega Pack/Characters/Hoja de sprites_ niño chibi animado.png` (recortados con los mismos rectángulos que usan los clips `AnimationKid` y `AnimationQuestion`) |
| Fotogramas «saludar» del niño | `Assets/Brackeys/2D Mega Pack/Characters/Sprite de niño saludando.png` (rectángulos del clip `Saludar`, escalados al tamaño de los demás fotogramas) |
| Capas de la niña | `Assets/Characters/NewChar/NewChar.psb` |
| Captura de escena | Game View de `Assets/Scenes/SampleScene.unity` |
| Audios | `Assets/8Bit Music - 062022/` |
| Tipografías | Baloo 2 y Nunito, de Google Fonts (necesitan internet; sin conexión se usan fuentes del sistema) |

## Videos paso a paso

Los dos videos de la sección «Animaciones mediante huesos 2D» se generan dibujando cada fotograma con los recursos reales del proyecto (la hoja de sprites del niño y las capas de `NewChar.psb`). No son grabaciones de pantalla de Unity. Para regenerarlos:

```bash
pip install pillow numpy psd-tools imageio-ffmpeg
python herramientas/generar_videos.py both
```

El script usa rutas absolutas del proyecto (`ROOT` al inicio del archivo). Si se mueve la carpeta, hay que actualizarlas. Si cambia la duración de alguna escena, también hay que actualizar los capítulos (`VIDEOS` en `script.js`). Después de regenerar, sube `VIDEO_VERSION` en `script.js`.

## Compilar el proyecto para WebGL (Unity 6.3)

1. En Unity Hub, comprueba que el editor 6000.3 tenga instalado el módulo **Web Build Support**.
2. *File → Build Profiles* → selecciona **Web** → **Switch Platform**.
3. En la lista de escenas debe estar `Assets/Scenes/SampleScene.unity`.
4. *Player Settings → Publishing Settings*:
   - **Compression Format: Gzip** y **Decompression Fallback: activado**. Así funciona en cualquier servidor, sin configurar cabeceras.
   - Opcional: **Brotli** produce archivos más pequeños, pero el servidor debe enviar `Content-Encoding: br` (ver «Desplegar»).
5. **Build** → elige la carpeta `presentacion-cuentos/unity-build`. El nombre de la carpeta define el nombre de los archivos (`unity-build.loader.js`, etc.).

La compilación incluida se hizo con Gzip + Decompression Fallback. Después se restauró la configuración original del proyecto (Brotli, sin fallback).

## Ejecutar localmente

WebGL **no funciona** abriendo `index.html` con doble clic (`file://`): el navegador bloquea la carga de los archivos. Hace falta un servidor:

```bash
cd presentacion-cuentos
python herramientas/servidor.py
```

Luego abre <http://localhost:8765>. Alternativa con Node.js: `npx serve .`

`python -m http.server` también sirve la página y el prototipo, pero **no permite saltar a otro punto de los videos**: ignora las solicitudes parciales (Range) que usa el navegador. `herramientas/servidor.py` sí las admite. Los alojamientos web habituales también las admiten.

## Desplegar en un alojamiento

Sirve cualquier hosting de archivos estáticos: Netlify, Vercel, GitHub Pages, Cloudflare Pages o un servidor Apache/Nginx propio. Sube la carpeta `presentacion-cuentos` completa.

- **Con Gzip + Decompression Fallback** (la compilación incluida): no requiere configuración especial. Los `.unityweb` se sirven como `application/octet-stream` y el cargador los descomprime en el navegador.
- **Si cambias a Brotli o Gzip sin fallback**, el servidor debe enviar estas cabeceras:
  - `*.data.br` / `*.data.gz`: `Content-Encoding: br` o `gzip`, con `Content-Type: application/octet-stream`.
  - `*.js.br` / `*.js.gz`: `Content-Encoding` correspondiente, con `Content-Type: application/javascript`.
  - `*.wasm.br` / `*.wasm.gz`: `Content-Encoding` correspondiente, con `Content-Type: application/wasm`.
  - Brotli solo funciona bajo **HTTPS**.
- El servidor debe permitir solicitudes `HEAD`. La página las usa para comprobar que la compilación existe y para mostrar su tamaño.

## Compatibilidad y limitaciones de WebGL

- **Navegadores de escritorio actuales** (Chrome, Edge, Firefox, Safari) con WebGL 2.
- **Celulares**: Unity WebGL puede funcionar, pero con más carga y memoria limitada. Además, **el prototipo solo responde al ratón**: en pantallas táctiles el toque todavía no está adaptado.
- **Audio**: el navegador bloquea el sonido hasta la primera interacción del usuario, así que la música empieza tras el primer clic dentro del juego.
- **Primera carga**: descarga varios MB. Las siguientes cargas usan la caché del navegador.

## Comunicación entre la página y Unity (opcional, no implementada)

Hoy la página solo **inicia, reinicia** (`unityInstance.Quit()` y una nueva instancia) y pone en **pantalla completa** (`SetFullscreen`). No envía órdenes al juego. Para que un botón de la web active una animación habría que añadir en Unity un objeto, por ejemplo `WebBridge`, con un script como este:

```csharp
using UnityEngine;

// Recibe órdenes desde JavaScript (unityInstance.SendMessage)
public class WebBridge : MonoBehaviour
{
    [SerializeField] private Animator kidAnimator;

    // Llamado desde la web: unityInstance.SendMessage("WebBridge", "PlayKidAction", "IsClicked");
    public void PlayKidAction(string trigger)
    {
        if (kidAnimator != null) kidAnimator.SetTrigger(trigger);
    }
}
```

Y en `script.js`:

```js
unityInstance.SendMessage("WebBridge", "PlayKidAction", "IsClicked");
```

## Pendiente para integrar el proyecto final

- [ ] Volver a compilar cuando cambie el proyecto (la compilación es una «foto» de la versión actual).
- [ ] Activar **Loop** en el Audio Source de la música (cámara) si debe sonar de forma continua.
- [ ] Revisar el objeto hijo `Idle/Audio Source`. Tiene el mismo clip `sonido_pensar_kid`, pero `IsCliked.cs` usa el Audio Source del propio objeto `Idle`, así que este hijo no se usa.
- [ ] Adaptar la entrada a pantallas táctiles antes de presentarlo en tabletas.
- [ ] Sustituir las ilustraciones, animaciones y audios de prueba por los definitivos del cliente.
- [ ] Actualizar la lista de temas a tratar (`TOPICS` en `script.js`) cuando se resuelva cada punto.
- [ ] Al modificar `styles.css` o `script.js`, subir el número de versión (`?v=11` en styles.css) en `index.html` para que los navegadores no muestren la copia vieja guardada en caché.
