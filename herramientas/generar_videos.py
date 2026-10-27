"""Genera dos videos explicativos (sprites y huesos) con los recursos reales del proyecto."""
import math, subprocess, sys, os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import imageio_ffmpeg

ROOT = r"C:\Users\Adrian\Animaciones"
SITE = os.path.join(ROOT, "presentacion-cuentos")
OUT = os.path.join(SITE, "assets", "video")
os.makedirs(OUT, exist_ok=True)
W, H, FPS = 1280, 720, 30

# ---------- estilo ----------
BG = (255, 250, 242)
INK = (45, 42, 58)
MUTED = (108, 102, 121)
ORANGE = (240, 138, 36)
BLUE = (58, 116, 214)
GREEN = (63, 166, 107)
GREEN_SOFT = (229, 245, 234)
BLUE_SOFT = (231, 239, 252)
ORANGE_SOFT = (255, 240, 220)
LINE = (236, 228, 214)
F = lambda size, bold=False: ImageFont.truetype(r"C:\Windows\Fonts\segoeuib.ttf" if bold else r"C:\Windows\Fonts\segoeui.ttf", size)
FT, FS, FC, FL, FXS = F(40, True), F(24), F(22, True), F(18, True), F(16)


def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def lerp(a, b, t):
    return a + (b - a) * t


def frame_base(step, title, caption):
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    if step:
        tw = d.textlength(step, font=FL) + 28
        d.rounded_rectangle([60, 34, 60 + tw, 66], 16, fill=BLUE)
        d.text((74, 38), step, font=FL, fill="white")
        d.text((60 + tw + 16, 26), title, font=FT, fill=INK)
    if caption:
        d.rounded_rectangle([60, H - 92, W - 60, H - 32], 18, fill=(255, 255, 255), outline=LINE, width=2)
        d.text((84, H - 79), caption, font=FS, fill=INK)
    return img, d


def card(d, box, title, lines, accent=BLUE):
    x0, y0, x1, y1 = box
    d.rounded_rectangle(box, 18, fill="white", outline=LINE, width=2)
    d.rounded_rectangle([x0, y0, x1, y0 + 44], 18, fill=accent)
    d.rectangle([x0, y0 + 24, x1, y0 + 44], fill=accent)
    d.text((x0 + 18, y0 + 8), title, font=FC, fill="white")
    y = y0 + 60
    for ln in lines:
        d.text((x0 + 18, y), ln, font=FS, fill=INK)
        y += 38


def paste(img, im, x, y, alpha=1.0):
    if alpha < 1:
        im = im.copy()
        im.putalpha(im.getchannel("A").point(lambda v: int(v * alpha)))
    img.paste(im, (int(x), int(y)), im)


def timeline(d, x, y, w, rows, dur, play=None, label_w=170, row_h=44, slots=None, fps_label=None):
    """Ventana Animation simplificada: regla de tiempo, filas con keyframes y cabezal."""
    h = 34 + row_h * len(rows)
    d.rounded_rectangle([x, y, x + w, y + h], 14, fill="white", outline=LINE, width=2)
    tx0, tx1 = x + label_w, x + w - 20
    d.rectangle([x + 2, y + 2, x + w - 2, y + 32], fill=(246, 241, 255))
    i = 0
    while i * 0.25 <= dur + 1e-6:
        tt = i * 0.25
        tx = lerp(tx0, tx1, tt / dur)
        d.line([tx, y + (18 if i % 2 == 0 else 25), tx, y + 32], fill=MUTED, width=1)
        if i % 2 == 0:
            d.text((tx + 3, y + 3), f"{tt:.1f} s", font=FXS, fill=MUTED)
        i += 1
    if fps_label:
        d.text((x + 14, y + 6), fps_label, font=FXS, fill=MUTED)
    for r, (name, keys) in enumerate(rows):
        ry = y + 34 + r * row_h
        d.line([x + 2, ry, x + w - 2, ry], fill=LINE)
        d.text((x + 14, ry + 10), name, font=FXS, fill=INK)
        for k in keys:
            kx = lerp(tx0, tx1, k / dur)
            cy = ry + row_h / 2
            d.polygon([(kx, cy - 8), (kx + 8, cy), (kx, cy + 8), (kx - 8, cy)], fill=ORANGE, outline=(150, 80, 10))
    if play is not None:
        px = lerp(tx0, tx1, max(0, min(1, play / dur)))
        d.line([px, y + 2, px, y + h - 2], fill=(224, 87, 79), width=3)
        d.polygon([(px - 7, y + 2), (px + 7, y + 2), (px, y + 12)], fill=(224, 87, 79))
    return (tx0, tx1, y + 34, row_h)


def render(name, scenes, poster_t):
    ff = imageio_ffmpeg.get_ffmpeg_exe()
    path = os.path.join(OUT, name + ".mp4")
    p = subprocess.Popen([ff, "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(FPS),
                          "-i", "-", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-preset", "medium",
                          "-movflags", "+faststart", path], stdin=subprocess.PIPE)
    total = sum(s[0] for s in scenes)
    n = int(total * FPS)
    start = 0.0
    idx = 0
    prev_last = None
    poster_saved = False
    for f in range(n):
        gt = f / FPS
        while idx < len(scenes) - 1 and gt >= start + scenes[idx][0]:
            start += scenes[idx][0]
            idx += 1
        dur, fn = scenes[idx]
        t = gt - start
        img = fn(t, t / dur)
        # transición: fundido desde el fondo al empezar cada escena
        if t < 0.3 and idx > 0:
            img = Image.blend(Image.new("RGB", (W, H), BG), img, ease(t / 0.3))
        if not poster_saved and gt >= poster_t:
            img.save(os.path.join(OUT, name + "_poster.jpg"), quality=86)
            poster_saved = True
        p.stdin.write(img.tobytes())
    p.stdin.close()
    p.wait()
    print(name, f"{total:.1f}s", os.path.getsize(path) // 1024, "KB")


# =====================================================================
# VIDEO 1: SPRITES (el niño)
# =====================================================================
SHEET = Image.open(os.path.join(ROOT, r"Assets\Brackeys\2D Mega Pack\Characters\Hoja de sprites_ niño chibi animado.png")).convert("RGBA")
SH = SHEET.height
IDLE_R = [(0, 392, 247, 304), (244, 397, 252, 298), (494, 397, 247, 295), (741, 396, 247, 298), (988, 397, 247, 301), (1235, 397, 247, 301), (1482, 397, 247, 302), (1729, 397, 247, 304)]
Q_R = [(0, 1, 247, 305), (247, 1, 247, 306), (494, 1, 247, 330), (741, 0, 247, 333), (988, 1, 247, 344), (1235, 1, 247, 317), (1481, 1, 247, 317), (1729, 1, 247, 317)]
top_down = lambda r: (r[0], SH - r[1] - r[3], r[0] + r[2], SH - r[1])
KID = {k: [Image.open(os.path.join(SITE, "assets", "images", "kid", f"{k}_{i}.png")).convert("RGBA") for i in range(8)] for k in ("idle", "question")}


def kid_scaled(k, i, h):
    im = KID[k][i % 8]
    return im.resize((int(im.width * h / im.height), h), Image.LANCZOS)


KIDS_CACHE = {}
def kidc(k, i, h):
    key = (k, i % 8, h)
    if key not in KIDS_CACHE:
        KIDS_CACHE[key] = kid_scaled(k, i, h)
    return KIDS_CACHE[key]


SHEET_BIG = SHEET.resize((int(SHEET.width * 0.56), int(SH * 0.56)), Image.LANCZOS)
SHEET_SMALL = SHEET.resize((int(SHEET.width * 0.34), int(SH * 0.34)), Image.LANCZOS)


def s_title(t, p):
    img, d = frame_base(None, None, None)
    d.text((100, 200), "Animación por sprites", font=F(64, True), fill=ORANGE)
    d.text((100, 290), "Cómo se animó el niño del prototipo en Unity", font=F(30), fill=INK)
    d.text((100, 350), "Recurso real: hoja de 16 dibujos · 2 animaciones", font=FS, fill=MUTED)
    paste(img, kidc("idle", int(t * 7), 420), 860, 170)
    return img


def s_import(t, p):
    img, d = frame_base("Paso 1", "Importar la hoja de sprites", "Arrastra la imagen a Assets y ajusta su importación en el Inspector.")
    a = ease(t / 0.8)
    paste(img, SHEET_SMALL, 60, 200, a)
    if t > 1.2:
        k = ease((t - 1.2) / 0.6)
        x = lerp(W, 770, k)
        card(d, [x, 150, x + 450, 410], "Inspector", ["Texture Type: Sprite (2D and UI)", "Sprite Mode: Multiple", "Pixels Per Unit: 100", "Pulsar Apply"], BLUE)
    return img


def s_slice(t, p):
    img, d = frame_base("Paso 2", "Cortar en el Sprite Editor", "Sprite Editor → Slice: Unity separa cada dibujo en un sprite independiente.")
    ox, oy, s = 60, 150, 0.56
    paste(img, SHEET_BIG, ox, oy)
    n = int(round(ease(min(1, t / 4.0)) * 16))
    for i, r in enumerate(IDLE_R + Q_R):
        if i >= n:
            break
        x0, y0, x1, y1 = top_down(r)
        col = GREEN if i < 8 else ORANGE
        d.rectangle([ox + x0 * s, oy + y0 * s, ox + x1 * s, oy + y1 * s], outline=col, width=3)
        d.rounded_rectangle([ox + x0 * s + 4, oy + y0 * s + 4, ox + x0 * s + 34, oy + y0 * s + 26], 6, fill=col)
        d.text((ox + x0 * s + 9, oy + y0 * s + 4), str(i), font=FXS, fill="white")
    d.text((60, 610 - 20), "Fila de arriba: reposo (8 dibujos)   ·   Fila de abajo: pensar (8 dibujos)", font=FL, fill=MUTED)
    return img


def anim_scene(kind, clip, loop_txt, fly_dur, step, title, caption):
    rects = IDLE_R if kind == "idle" else Q_R

    def fn(t, p):
        img, d = frame_base(step, title, caption)
        sx, sy, s = 60, 110, 0.34
        paste(img, SHEET_SMALL, sx, sy)
        tl = timeline(d, 60, 420, 820, [("Sprite", [])], 8 / 7, play=None, fps_label="Samples: 7")
        tx0, tx1, ry, rh = tl
        slot_w = (tx1 - tx0) / 8
        d.text((60, 384), f"{clip}   ({loop_txt})", font=FC, fill=INK)
        playing = t > fly_dur + 0.3
        for i, r in enumerate(rects):
            st = i * fly_dur / 10
            k = ease((t - st) / (fly_dur * 0.3))
            if k <= 0:
                continue
            x0, y0, x1, y1 = top_down(r)
            fx, fy = sx + x0 * s, sy + y0 * s
            th = kidc(kind, i, 40)
            gx, gy = tx0 + i * slot_w + slot_w / 2 - th.width / 2, ry + 2
            paste(img, th, lerp(fx, gx, k), lerp(fy, gy, k))
        # Vista previa
        d.rounded_rectangle([920, 110, 1220, 600], 20, fill=GREEN_SOFT)
        d.text((940, 122), "Vista previa", font=FL, fill=GREEN)
        if playing:
            pt = t - fly_dur - 0.3
            fi = int(pt * 7)
            if kind == "question":
                fi = min(7, int((pt % (8 / 7 + 0.8)) * 7))   # una vez, pausa y repite
            fi %= 8
            paste(img, kidc(kind, fi, 400), 1070 - kidc(kind, fi, 400).width / 2, 175)
            ph = (fi + 0.5) / 7
            timeline(d, 60, 420, 820, [("Sprite", [])], 8 / 7, play=ph, fps_label="Samples: 7")
            for i in range(8):
                th = kidc(kind, i, 40)
                paste(img, th, tx0 + i * slot_w + slot_w / 2 - th.width / 2, ry + 2)
            d.rounded_rectangle([tx0 + fi * slot_w + 2, ry, tx0 + (fi + 1) * slot_w - 2, ry + rh - 1], 6, outline=ORANGE, width=3)
            d.text((60, 520), "8 dibujos a 7 por segundo = 1,14 s por ciclo", font=FL, fill=MUTED)
        else:
            paste(img, kidc(kind, 0, 400), 1070 - kidc(kind, 0, 400).width / 2, 175, 0.35)
        return img
    return fn


def s_animator(t, p):
    img, d = frame_base("Paso 5", "Conectar las animaciones en el Animator", "IsClicked cambia a «pensar» sin esperar; al terminar, Exit Time lo devuelve al reposo.")
    # Estados
    def state(x, y, label, sub, fill, active):
        d.rounded_rectangle([x, y, x + 240, y + 80], 14, fill=fill, outline=(INK if active else LINE), width=4 if active else 2)
        d.text((x + 20, y + 10), label, font=FC, fill="white" if fill in (ORANGE, BLUE) else INK)
        d.text((x + 20, y + 44), sub, font=FXS, fill="white" if fill in (ORANGE, BLUE) else MUTED)
    trig = 2.0 <= t < 2.6
    in_q = 2.3 <= t < 2.3 + 8 / 7 + 0.1
    state(90, 200, "Idle", "AnimationKid · por defecto", ORANGE, not in_q)
    state(560, 200, "Question", "AnimationQuestion", BLUE, in_q)
    d.line([330, 225, 560, 225], fill=(224, 87, 79) if trig else INK, width=5 if trig else 3)
    d.polygon([(560, 225), (546, 217), (546, 233)], fill=INK)
    d.text((350, 186), "IsClicked · sin Exit Time", font=FXS, fill=INK)
    d.line([560, 255, 330, 255], fill=INK, width=3)
    d.polygon([(330, 255), (344, 247), (344, 263)], fill=INK)
    d.text((370, 262), "Exit Time = 1 (al terminar)", font=FXS, fill=INK)
    # Parámetro
    d.rounded_rectangle([90, 340, 400, 420], 14, fill="white", outline=LINE, width=2)
    d.text((110, 350), "Parameters", font=FL, fill=MUTED)
    d.text((110, 380), "IsClicked   (Trigger)", font=FL, fill=INK)
    d.ellipse([360, 384, 380, 404], fill=(224, 87, 79) if trig else LINE)
    if trig:
        d.text((90, 440), "¡Clic! → SetTrigger(\"IsClicked\")", font=FC, fill=(224, 87, 79))
    # Niño
    d.rounded_rectangle([920, 110, 1220, 600], 20, fill=GREEN_SOFT)
    if in_q:
        fi = min(7, int((t - 2.3) * 7))
        im = kidc("question", fi, 400)
    else:
        im = kidc("idle", int(t * 7), 400)
    paste(img, im, 1070 - im.width / 2, 175)
    if 1.6 < t < 2.4:
        d.ellipse([1050, 380, 1080, 410], outline=(224, 87, 79), width=4)
    return img


def s_end_kid(t, p):
    img, d = frame_base(None, None, None)
    d.text((100, 220), "Resultado", font=F(56, True), fill=GREEN)
    d.text((100, 300), "Reposo en bucle → clic → pensar → reposo", font=F(30), fill=INK)
    d.text((100, 352), "Cada pose nueva necesita un dibujo nuevo.", font=FS, fill=MUTED)
    cyc = t % (8 / 7 * 2)
    im = kidc("idle", int(cyc * 7), 420) if cyc < 8 / 7 else kidc("question", int((cyc - 8 / 7) * 7), 420)
    paste(img, im, 860, 170)
    return img


SPRITES = [
    (3.5, s_title),
    (5.0, s_import),
    (6.0, s_slice),
    (8.0, anim_scene("idle", "AnimationKid.anim", "Loop Time activado", 2.5, "Paso 3", "Crear el clip de reposo", "Selecciona los 8 dibujos y arrástralos a la escena o a la ventana Animation.")),
    (8.0, anim_scene("question", "AnimationQuestion.anim", "Loop Time desactivado: se reproduce una vez", 2.5, "Paso 4", "Crear el clip de pensar", "Mismo proceso con la fila de abajo. Desmarca Loop Time en el clip.")),
    (6.0, s_animator),
    (4.0, s_end_kid),
]

# =====================================================================
# VIDEO 2: HUESOS (la niña)
# =====================================================================
from psd_tools import PSDImage
psd = PSDImage.open(os.path.join(ROOT, r"Assets\Characters\NewChar\NewChar.psb"))
DW, DH = psd.width, psd.height
LAYERS = []  # (nombre, imagen en lienzo completo, bbox)
for l in psd:
    full = Image.new("RGBA", (DW, DH))
    full.paste(l.topil(), (l.left, l.top))
    LAYERS.append((l.name, full, (l.left, l.top, l.right, l.bottom)))
LAYER = {n: (im, bb) for n, im, bb in LAYERS}

m = lambda s, v: v if s == "L" else DW - v
BONES = {  # nombre: (padre, articulación, fin, color)
    "torso": (None, (300, 575), (300, 480), (230, 80, 80)),
    "chest": ("torso", (300, 480), (300, 395), (240, 150, 40)),
    "head": ("chest", (300, 392), (300, 150), (200, 170, 40)),
}
COLS = {"L": [(80, 160, 230), (60, 190, 200), (120, 110, 220), (90, 180, 110), (60, 150, 90)],
        "R": [(70, 120, 220), (40, 170, 190), (150, 90, 210), (110, 200, 80), (40, 160, 120)]}
for s in "LR":
    c = COLS[s]
    BONES[f"arm_upper_{s}"] = ("chest", (m(s, 232), 412), (m(s, 205), 474), c[0])
    BONES[f"arm_lower_{s}"] = (f"arm_upper_{s}", (m(s, 205), 474), (m(s, 192), 532), c[1])
    BONES[f"hand_{s}"] = (f"arm_lower_{s}", (m(s, 192), 532), (m(s, 190), 568), c[2])
    BONES[f"leg_{s}"] = ("torso", (m(s, 268), 575), (m(s, 265), 688), c[3])
    BONES[f"foot_{s}"] = (f"leg_{s}", (m(s, 265), 688), (m(s, 250), 712), c[4])
BONE_ORDER = ["torso", "chest", "head", "arm_upper_L", "arm_lower_L", "hand_L", "arm_upper_R", "arm_lower_R", "hand_R", "leg_L", "foot_L", "leg_R", "foot_R"]
PART_BONE = {"hair_back": "head", "backpack": "chest", "hair_front": "head", "head": "head"}
LABEL = {"hair_back": "Cabello trasero", "backpack": "Mochila", "leg_L": "Pierna izq.", "leg_R": "Pierna der.", "foot_L": "Pie izq.", "foot_R": "Pie der.",
         "torso": "Torso", "arm_upper_L": "Brazo izq.", "arm_lower_L": "Antebrazo izq.", "hand_L": "Mano izq.", "arm_upper_R": "Brazo der.",
         "arm_lower_R": "Antebrazo der.", "hand_R": "Mano der.", "head": "Cabeza", "hair_front": "Flequillo"}


def mat_rot(a, cx, cy):
    r = math.radians(a)
    c, s = math.cos(r), math.sin(r)
    return np.array([[c, -s, cx - c * cx + s * cy], [s, c, cy - s * cx - c * cy], [0, 0, 1]])


def world_mats(pose):
    """pose: {hueso: grados (positivo = sentido horario en pantalla)}, más 'offset': (dx, dy) y 'chest_dy'."""
    M = {}
    for b in BONE_ORDER:
        par, j, e, _ = BONES[b]
        local = mat_rot(pose.get(b, 0), *j)
        if b == "chest":
            local = np.array([[1, 0, 0], [0, 1, pose.get("chest_dy", 0)], [0, 0, 1]]) @ local
        if par is None:
            ox, oy = pose.get("offset", (0, 0))
            M[b] = np.array([[1, 0, ox], [0, 1, oy], [0, 0, 1]]) @ local
        else:
            M[b] = M[par] @ local
    return M


def apply(Mx, pt):
    v = Mx @ np.array([pt[0], pt[1], 1.0])
    return v[0], v[1]


def render_girl(pose=None, alpha=1.0, tint=0.0):
    pose = pose or {}
    M = world_mats(pose)
    out = Image.new("RGBA", (DW, DH))
    for n, im, bb in LAYERS:
        b = PART_BONE.get(n, n)
        inv = np.linalg.inv(M[b])
        data = (inv[0, 0], inv[0, 1], inv[0, 2], inv[1, 0], inv[1, 1], inv[1, 2])
        tim = im.transform((DW, DH), Image.AFFINE, data, resample=Image.BICUBIC)
        if tint > 0:
            col = BONES[b][3] if n != "torso" else None
            if col is None:
                # torso: degradado de color entre cadera y pecho (pesos mezclados)
                over = TORSO_GRAD
            else:
                over = Image.new("RGBA", (DW, DH), col + (255,))
            mask = tim.getchannel("A").point(lambda v: int(v * 0.6 * tint))
            tim = Image.composite(over, tim, mask).convert("RGBA")
            tim.putalpha(im.transform((DW, DH), Image.AFFINE, data, resample=Image.BICUBIC).getchannel("A"))
        out.alpha_composite(tim)
    if alpha < 1:
        out.putalpha(out.getchannel("A").point(lambda v: int(v * alpha)))
    return out, M


def draw_bones(d, M, scale, ox, oy, upto=None, labels=False, prog=1.0):
    n = len(BONE_ORDER) if upto is None else upto
    for i, b in enumerate(BONE_ORDER[:n]):
        par, j, e, col = BONES[b]
        k = 1.0 if i < n - 1 else prog
        sx, sy = apply(M[b], j)
        ex, ey = apply(M[b], e)
        ex, ey = lerp(sx, ex, k), lerp(sy, ey, k)
        sx, sy, ex, ey = ox + sx * scale, oy + sy * scale, ox + ex * scale, oy + ey * scale
        ang = math.atan2(ey - sy, ex - sx)
        wdt = 9
        px, py = -math.sin(ang) * wdt, math.cos(ang) * wdt
        mx, my = lerp(sx, ex, 0.18), lerp(sy, ey, 0.18)
        d.polygon([(sx, sy), (mx + px, my + py), (ex, ey), (mx - px, my - py)], fill=col + (235,), outline=(255, 255, 255, 255))
        d.ellipse([sx - 8, sy - 8, sx + 8, sy + 8], fill=(255, 255, 255, 255), outline=col + (255,), width=3)
        if labels and k >= 1:
            d.text((ex + 8, ey - 10), b, font=FXS, fill=INK)


# Malla: cuadros de rejilla dentro del alfa de cada capa (vista de la geometría)
MESH = []
for n, im, bb in LAYERS:
    a = np.array(im.getchannel("A")) > 10
    st = 16
    for y in range(bb[1], bb[3], st):
        for x in range(bb[0], bb[2], st):
            if a[y:y + st, x:x + st].any():
                MESH.append((x, y, min(x + st, DW), min(y + st, DH)))

TORSO_GRAD = Image.new("RGBA", (DW, DH))
_gd = ImageDraw.Draw(TORSO_GRAD)
for _y in range(DH):
    _k = ease((520 - _y) / 60)
    _gd.line([0, _y, DW, _y], fill=tuple(int(lerp(BONES["torso"][3][i], BONES["chest"][3][i], _k)) for i in range(3)) + (255,))

GSCALE = 0.7
GX, GY = 820, 90  # posición de la niña en el video


def girl_frame(step, title, caption, pose=None, bones=False, upto=None, prog=1.0, labels=False, mesh=0.0, tint=0.0, alpha=1.0):
    img, d = frame_base(step, title, caption)
    g, M = render_girl(pose, alpha, tint)
    gs = g.resize((int(DW * GSCALE), int(DH * GSCALE)), Image.LANCZOS)
    img = img.convert("RGBA")
    ImageDraw.Draw(img).rounded_rectangle([GX - 20, 100, GX + DW * GSCALE + 20, 610], 22, fill=GREEN_SOFT + (255,))
    img.alpha_composite(gs, (GX, GY))
    ov = Image.new("RGBA", (W, H))
    od = ImageDraw.Draw(ov)
    if mesh > 0:
        cut = int(len(MESH) * mesh)
        for (x0, y0, x1, y1) in MESH[:cut]:
            od.rectangle([GX + x0 * GSCALE, GY + y0 * GSCALE, GX + x1 * GSCALE, GY + y1 * GSCALE], outline=(58, 116, 214, 150))
            od.line([GX + x0 * GSCALE, GY + y1 * GSCALE, GX + x1 * GSCALE, GY + y0 * GSCALE], fill=(58, 116, 214, 90))
    if bones:
        draw_bones(od, M, GSCALE, GX, GY, upto, labels, prog)
    img.alpha_composite(ov)
    return img.convert("RGB"), ImageDraw.Draw(img)


def b_title(t, p):
    img, d = frame_base(None, None, None)
    d.text((100, 200), "Animación por huesos", font=F(64, True), fill=BLUE)
    d.text((100, 290), "Cómo se preparó y animó la niña del prototipo", font=F(30), fill=INK)
    d.text((100, 350), "Recurso real: NewChar.psb · 15 capas · 13 huesos", font=FS, fill=MUTED)
    pose = {"chest_dy": -3 * math.sin(t * math.pi), "head": 2 * math.sin(t * math.pi)}
    g, _ = render_girl(pose)
    gs = g.resize((int(DW * 0.62), int(DH * 0.62)), Image.LANCZOS)
    img = img.convert("RGBA"); img.alpha_composite(gs, (850, 150))
    return img.convert("RGB")


GRID = []  # posiciones de la vista "explotada"
for i, (n, im, bb) in enumerate(LAYERS):
    c, r = i % 5, i // 5
    GRID.append((90 + c * 150, 140 + r * 150))


def b_layers(t, p):
    img, d = frame_base("Paso 1", "Dibujar el personaje por capas", "Cada parte que se moverá por su cuenta va en una capa separada del archivo .psb.")
    img = img.convert("RGBA")
    d = ImageDraw.Draw(img)
    k = ease((t - 0.6) / 1.6) - ease((t - 6.2) / 1.2)
    for i, (n, im, bb) in enumerate(LAYERS):
        crop = im.crop(bb)
        s0 = 0.55
        x0, y0 = 360 + bb[0] * s0, 90 + bb[1] * s0
        fit = min(110 / crop.width, 110 / crop.height)
        sc = lerp(s0, fit, k)
        gx, gy = GRID[i]
        cw, ch = crop.width * fit, crop.height * fit
        x1, y1 = gx + (130 - cw) / 2, gy + (110 - ch) / 2
        if k > 0.02:
            d.rounded_rectangle([gx - 5, gy - 5, gx + 135, gy + 135], 12, outline=LINE + (int(255 * k),), width=2)
        ci = crop.resize((max(1, int(crop.width * sc)), max(1, int(crop.height * sc))), Image.LANCZOS)
        img.alpha_composite(ci, (int(lerp(x0, x1, k)), int(lerp(y0, y1, k))))
        if k > 0.9:
            d.text((gx, gy + 112), LABEL[n], font=FXS, fill=MUTED)
    if k > 0.5:
        d.rounded_rectangle([880, 150, 1220, 470], 18, fill=(255, 255, 255, 255), outline=LINE, width=2)
        for j, ln in enumerate(["Photoshop o Krita", "Una capa por parte", "Guardar como .psb", "15 capas en la niña"]):
            d.text((904, 172 + j * 60), "• " + ln, font=FS, fill=INK)
    return img.convert("RGB")


def b_import(t, p):
    img, d = girl_frame("Paso 2", "Importar el .psb en Unity", "Con los paquetes 2D PSD Importer y 2D Animation instalados.")
    d = ImageDraw.Draw(img)
    k = ease((t - 0.4) / 0.6)
    x = lerp(-500, 60, k)
    card(d, [x, 130, x + 600, 470], "Inspector del .psb", ["Texture Type: Sprite (2D and UI)", "Sprite Mode: Multiple", "Use as Rig: activado", "Pixels Per Unit: 100", "Apply → Open Sprite Editor"], BLUE)
    return img


def b_bones(t, p):
    n = len(BONE_ORDER)
    per = 7.0 / n
    upto = min(n, int(t / per) + 1)
    prog = ease((t - (upto - 1) * per) / (per * 0.8))
    img, d = girl_frame("Paso 3", "Crear los huesos", "Skinning Editor → Create Bone. El torso es la raíz; de él cuelgan pecho, cabeza, brazos y piernas.",
                        bones=True, upto=upto, prog=prog, labels=False, alpha=0.55)
    d = ImageDraw.Draw(img)
    tree = ["torso (raíz)", "  chest", "    head", "    arm_upper_L › arm_lower_L › hand_L", "    arm_upper_R › arm_lower_R › hand_R", "  leg_L › foot_L", "  leg_R › foot_R"]
    shown = [1, 2, 3, 6, 9, 11, 13]
    d.rounded_rectangle([60, 120, 760, 470], 18, fill="white", outline=LINE, width=2)
    d.text((84, 134), "Jerarquía de huesos", font=FC, fill=BLUE)
    for i, ln in enumerate(tree):
        if upto >= shown[i]:
            d.text((84, 180 + i * 38), ln, font=F(22), fill=INK)
    return img


def b_mesh(t, p):
    img, d = girl_frame("Paso 4", "Generar la geometría", "Auto Geometry crea una malla sobre cada capa: son los puntos que los huesos van a mover.",
                        mesh=ease(t / 4.0), alpha=0.9)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([60, 140, 760, 440], 18, fill="white", outline=LINE, width=2)
    for i, ln in enumerate(["Cada capa se convierte en una malla", "de puntos y triángulos.", "Más puntos = curvas más suaves,", "pero más trabajo para el equipo.", "La malla real de la niña: 1 punto cada 10 px."]):
        d.text((84, 164 + i * 50), ln, font=FS, fill=INK)
    return img


def b_weights(t, p):
    img, d = girl_frame("Paso 5", "Asignar los pesos", "Auto Weights decide qué hueso mueve cada zona. El color indica el hueso que la controla.",
                        bones=True, tint=ease(t / 1.5))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([60, 140, 760, 440], 18, fill="white", outline=LINE, width=2)
    lines = ["Cada parte sigue al 100 % a su hueso.", "El torso mezcla cadera y pecho:", "así la respiración no lo rompe.", "Revisa en Sprite Influence que", "cada parte tenga el hueso correcto."]
    for i, ln in enumerate(lines):
        d.text((84, 164 + i * 50), ln, font=FS, fill=INK)
    return img


def b_pose(t, p):
    a = math.sin(t / 5.0 * math.pi * 2)
    pose = {"arm_upper_R": -90 * max(0, a), "arm_lower_R": -30 * max(0, a), "head": 10 * a, "arm_upper_L": 30 * max(0, -a), "leg_L": 12 * max(0, -a)}
    img, d = girl_frame("Paso 6", "Probar poses", "Preview Pose: rota los huesos para comprobar que las partes se doblan bien. Luego Apply.",
                        pose=pose, bones=True)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([60, 140, 760, 440], 18, fill="white", outline=LINE, width=2)
    for i, ln in enumerate(["Al rotar un hueso se mueven él", "y todos los que cuelgan de él:", "brazo → antebrazo → mano.", "Si una parte se estira o se rompe,", "se corrigen los pesos (paso 5)."]):
        d.text((84, 164 + i * 50), ln, font=FS, fill=INK)
    return img


def breathe_pose(tt):
    s = math.sin(tt / 2.0 * math.pi * 2)
    return {"chest_dy": -4 * (0.5 - 0.5 * math.cos(tt / 2.0 * math.pi * 2)), "head": 1.5 * s, "arm_upper_L": -2.5 * s, "arm_upper_R": 2.5 * s}


def keyed(keys, tt):
    """Interpolación suave entre (tiempo, valor)."""
    if tt <= keys[0][0]:
        return keys[0][1]
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if tt <= t1:
            return lerp(v0, v1, ease((tt - t0) / (t1 - t0)))
    return keys[-1][1]


WAVE = {
    "offset_y": [(0, 0), (0.12, 12), (0.42, -110), (0.72, 0), (0.82, 6), (0.95, 0), (1.3, 0)],
    "arm_upper_R": [(0, 0), (0.25, -115), (1.0, -115), (1.3, 0)],
    "arm_lower_R": [(0, 0), (0.25, -20), (0.4, 20), (0.55, -25), (0.7, 20), (0.85, -25), (1.0, 0), (1.3, 0)],
    "arm_upper_L": [(0, 0), (0.42, 25), (0.8, 0), (1.3, 0)],
    "head": [(0, 0), (0.3, 8), (1.0, 8), (1.3, 0)],
    "leg_L": [(0, 0), (0.12, -6), (0.42, 10), (0.72, 0), (1.3, 0)],
    "leg_R": [(0, 0), (0.12, 6), (0.42, -10), (0.72, 0), (1.3, 0)],
}


def wave_pose(tt):
    pose = {k: keyed(v, tt) for k, v in WAVE.items() if k != "offset_y"}
    pose["offset"] = (0, keyed(WAVE["offset_y"], tt))
    return pose


def b_keys_idle(t, p):
    tt = t % 2.0
    img, d = girl_frame("Paso 7", "Animar con keyframes: respiración", "Ventana Animation → Record: se guardan poses clave y Unity calcula el movimiento intermedio.",
                        pose=breathe_pose(tt))
    d = ImageDraw.Draw(img)
    d.text((60, 120), "NewChar_Idle.anim  (2 s · Loop Time activado)", font=FC, fill=INK)
    timeline(d, 60, 160, 700, [("chest · escala", [0, 1, 2]), ("head · rotación", [0, 1, 2]), ("arm_upper_L", [0, 1, 2]), ("arm_upper_R", [0, 1, 2])], 2.0, play=tt)
    d.text((60, 400), "Solo se mueven los huesos: no cambian las imágenes ni el color.", font=FL, fill=MUTED)
    return img


def b_keys_wave(t, p):
    tt = min(1.3, max(0, (t - 0.8) % 2.6)) if t > 0.8 else 0
    img, d = girl_frame("Paso 8", "Animar con keyframes: salto y saludo", "Se agacha, salta, saluda moviendo el antebrazo y vuelve al reposo. Se reproduce una vez.",
                        pose=wave_pose(tt))
    d = ImageDraw.Draw(img)
    d.text((60, 120), "NewChar_Clicked.anim  (1,3 s · Loop Time desactivado)", font=FC, fill=INK)
    rows = [("torso · posición", [k for k, _ in WAVE["offset_y"]]), ("arm_upper_R", [k for k, _ in WAVE["arm_upper_R"]]),
            ("arm_lower_R", [k for k, _ in WAVE["arm_lower_R"]]), ("head", [k for k, _ in WAVE["head"]]), ("piernas", [k for k, _ in WAVE["leg_L"]])]
    timeline(d, 60, 160, 700, rows, 1.3, play=tt, row_h=40)
    return img


def b_end(t, p):
    img, d = frame_base(None, None, None)
    d.text((100, 200), "Resultado", font=F(56, True), fill=GREEN)
    d.text((100, 280), "Una sola ilustración, muchos movimientos", font=F(30), fill=INK)
    d.text((100, 334), "Idle en bucle · clic → NewChar_Clicked · vuelta al reposo", font=FS, fill=MUTED)
    tt = t % 3.3
    pose = breathe_pose(tt) if tt < 2.0 else wave_pose(tt - 2.0)
    g, _ = render_girl(pose)
    gs = g.resize((int(DW * 0.6), int(DH * 0.6)), Image.LANCZOS)
    img = img.convert("RGBA"); img.alpha_composite(gs, (850, 170))
    return img.convert("RGB")


HUESOS = [
    (3.5, b_title),
    (7.5, b_layers),
    (4.5, b_import),
    (8.0, b_bones),
    (5.0, b_mesh),
    (5.0, b_weights),
    (5.5, b_pose),
    (6.0, b_keys_idle),
    (6.0, b_keys_wave),
    (4.0, b_end),
]

which = sys.argv[1] if len(sys.argv) > 1 else "both"
if which in ("sprites", "both"):
    render("sprites", SPRITES, 14.0)
if which in ("huesos", "both"):
    render("huesos", HUESOS, 22.0)
