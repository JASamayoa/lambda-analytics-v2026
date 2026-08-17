#!/usr/bin/env python3
"""
Convierte un logo de cliente (cualquier color, cualquier fondo) al tratamiento
monocromo azul pizarra del muro de clientes de lambda-analytics.net.

    python3 tools/process-logos.py origen.png salida.webp "Nombre del cliente"

Qué hace:
  1. Normaliza a RGBA (maneja PNG-8 con paleta, JPG sin alfa, etc.).
  2. Vuelve transparente el fondo blanco/casi-blanco si el archivo no traía alfa.
  3. Convierte el logo en una silueta del color de marca, usando la luminancia
     original como máscara: lo oscuro queda sólido, lo claro se desvanece.
     Así los contraformas (la H blanca de Honda, por ejemplo) siguen leyéndose.
  4. Recorta el margen vacío y normaliza el lado mayor a 400 px.
"""
import sys
from PIL import Image, ImageOps
import numpy as np

SLATE = (59, 90, 117)      # tono de los 12 logos que ya estaban en el sitio
MAX_SIDE = 400
WHITE_CUT = 236            # a partir de aquí un pixel cuenta como "fondo blanco"


def load_on_white(path):
    """Devuelve el logo compuesto sobre blanco, en RGB.

    Aplanar contra blanco unifica los dos casos (PNG transparente y JPG con
    fondo blanco) en uno solo, y evita el error de derivar la opacidad dos
    veces — que dejaba lavados los logos de color medio como Honda o Tecún.
    """
    im = Image.open(path)
    if im.mode == 'P':
        im = im.convert('RGBA') if 'transparency' in im.info else im.convert('RGB')
    if im.mode in ('L', 'LA', 'RGB'):
        im = im.convert('RGBA')
    im = im.convert('RGBA')
    bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
    return Image.alpha_composite(bg, im).convert('RGB')


def to_brand_mono(im_rgb):
    rgb = np.array(im_rgb).astype(np.float32)
    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]

    # Cobertura de tinta: oscuro → opaco, blanco → transparente.
    ink = np.clip((255.0 - lum) / 255.0, 0, 1)

    # Normaliza por imagen para que el tono más oscuro llegue a opacidad plena.
    # Sin esto, un logo de tonos medios (rojo Honda, verde Cengicaña) saldría
    # lavado al lado de uno negro (Canella).
    peak = np.percentile(ink[ink > 0.04], 98) if (ink > 0.04).any() else 0
    if peak > 0.05:
        ink = np.clip(ink / peak, 0, 1)

    ink = ink ** 0.85          # sube un poco los medios tonos

    out = np.zeros(rgb.shape[:2] + (4,), dtype=np.float32)
    out[:, :, 0], out[:, :, 1], out[:, :, 2] = SLATE
    out[:, :, 3] = ink * 255.0

    cover = float((ink > 0.5).mean())
    if cover < 0.005:
        print(f"    ⚠  casi no quedó tinta ({cover:.1%}). "
              f"¿El logo es blanco sobre fondo oscuro? Requiere invertir a mano.")
    return Image.fromarray(out.astype(np.uint8), 'RGBA')


def trim(im, thresh=8):
    a = np.array(im)[:, :, 3]
    ys, xs = np.where(a > thresh)
    if not len(ys):
        return im
    return im.crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1))


def main(src, dst, label=''):
    im = to_brand_mono(load_on_white(src))
    im = trim(im)
    w, h = im.size
    s = MAX_SIDE / max(w, h)
    if s < 1:
        im = im.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    im.save(dst, 'WEBP', quality=92, method=6, lossless=False)
    print(f"  ✓ {dst.split('/')[-1]:32s} {im.size[0]}x{im.size[1]:<4} {label}")


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2], sys.argv[3] if len(sys.argv) > 3 else '')
