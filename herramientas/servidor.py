"""Servidor local para la presentación.

A diferencia de `python -m http.server`, responde a solicitudes parciales (Range),
que los navegadores necesitan para saltar a cualquier punto de los videos.

Uso (desde la carpeta presentacion-cuentos):
    python herramientas/servidor.py          -> http://localhost:8765
    python herramientas/servidor.py 8080     -> otro puerto
"""
import os
import re
import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class RangeHandler(SimpleHTTPRequestHandler):
    # Tipos MIME de la compilación de Unity y de los videos
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      ".wasm": "application/wasm", ".unityweb": "application/octet-stream", ".mp4": "video/mp4"}

    def send_head(self):
        rango = self.headers.get("Range")
        path = self.translate_path(self.path)
        if not rango or not os.path.isfile(path):
            return super().send_head()
        m = re.match(r"bytes=(\d*)-(\d*)$", rango.strip())
        size = os.path.getsize(path)
        if not m:
            return super().send_head()
        ini = int(m.group(1)) if m.group(1) else max(0, size - int(m.group(2) or 0))
        fin = int(m.group(2)) if m.group(1) and m.group(2) else size - 1
        fin = min(fin, size - 1)
        if ini > fin:
            self.send_error(416, "Rango no válido")
            return None
        f = open(path, "rb")
        f.seek(ini)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {ini}-{fin}/{size}")
        self.send_header("Content-Length", str(fin - ini + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.end_headers()
        self._restante = fin - ini + 1
        return f

    def copyfile(self, source, outputfile):
        restante = getattr(self, "_restante", None)
        if restante is None:
            return super().copyfile(source, outputfile)
        while restante > 0:
            bloque = source.read(min(64 * 1024, restante))
            if not bloque:
                break
            outputfile.write(bloque)
            restante -= len(bloque)
        self._restante = None

    def end_headers(self):
        if not self.headers.get("Range"):
            self.send_header("Accept-Ranges", "bytes")
        super().end_headers()


if __name__ == "__main__":
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    servidor = ThreadingHTTPServer(("127.0.0.1", puerto), partial(RangeHandler, directory=RAIZ))
    print(f"Presentación disponible en http://localhost:{puerto}  (Ctrl+C para detener)")
    servidor.serve_forever()
