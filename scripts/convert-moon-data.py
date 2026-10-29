#!/usr/bin/env python3
"""Convert NASA PDS Phobos/Deimos products into compact browser-ready assets."""
from pathlib import Path
import json
import numpy as np
from astropy.io import fits
from PIL import Image, ImageOps, ImageEnhance

ROOT = Path("data/moons/nasa-pds-thomas")
OUT = Path("data/moons/optimized")
OUT.mkdir(parents=True, exist_ok=True)

BODIES = {
    "phobos": {"table": "m1phobos.tab", "fits": "m1phobosm.fit", "texture": (1024, 512)},
    "deimos": {"table": "m2deimos.tab", "fits": "m2deimosm.fit", "texture": (512, 256)},
}

def make_mesh(body, table_path):
    # PDS tables store planetocentric latitude, east longitude, and radius (km).
    data = np.loadtxt(table_path)
    latitudes = np.unique(data[:, 0])
    longitudes = np.unique(data[:, 1])
    grid = data[:, 2].reshape(len(latitudes), len(longitudes))
    # Drop the duplicated 360-degree seam; use modest grids appropriate for distant moons.
    if longitudes[-1] - longitudes[0] >= 359.9:
        longitudes = longitudes[:-1]
        grid = grid[:, :-1]
    target_lat = np.linspace(latitudes[0], latitudes[-1], min(len(latitudes), 91 if body == "phobos" else 37))
    target_lon_count = min(len(longitudes), 180 if body == "phobos" else 72)
    # The source samples are regular; index resampling preserves actual measured radii.
    lat_idx = np.rint(np.linspace(0, len(latitudes)-1, len(target_lat))).astype(int)
    lon_idx = np.rint(np.linspace(0, len(longitudes)-1, target_lon_count, endpoint=False)).astype(int)
    sampled = grid[np.ix_(lat_idx, lon_idx)]
    lats = latitudes[lat_idx]
    lons = longitudes[lon_idx]
    vertices = []
    uvs = []
    mean_radius = float(np.mean(sampled))
    for i, lat in enumerate(lats):
        lr = np.deg2rad(lat)
        for j, lon in enumerate(lons):
            lo = np.deg2rad(lon)
            radius = float(sampled[i, j]) / mean_radius
            uvs.append([float(lons[j] / 360.0), float((lat + 90.0) / 180.0)])
            # Three.js convention: longitude zero faces +Z, east longitude turns toward -X.
            vertices.append([round(-radius*np.cos(lr)*np.sin(lo), 6),
                             round(radius*np.sin(lr), 6),
                             round(radius*np.cos(lr)*np.cos(lo), 6)])
    faces = []
    rows, cols = len(lats), len(lons)
    for i in range(rows-1):
        for j in range(cols):
            j2 = (j+1) % cols
            a, b = i*cols+j, i*cols+j2
            c, d = (i+1)*cols+j, (i+1)*cols+j2
            faces.extend([[a, c, b], [b, c, d]])
    payload = {"units": "mean-radius", "vertices": vertices, "uvs": uvs, "indices": [v for face in faces for v in face]}
    path = OUT / f"{body}-mesh.json"
    path.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"{path}: {path.stat().st_size:,} bytes; {len(vertices):,} vertices, {len(faces):,} triangles")

def make_texture(body, fits_path, size):
    with fits.open(fits_path, memmap=True) as hdus:
        image = next((h.data for h in hdus if h.data is not None and np.asarray(h.data).ndim >= 2), None)
        if image is None:
            raise ValueError(f"No image array in {fits_path}")
        image = np.asarray(image, dtype=np.float32).squeeze()
        while image.ndim > 2:
            image = image[0]
        finite = image[np.isfinite(image)]
        if finite.size == 0:
            raise ValueError(f"No finite pixels in {fits_path}")
        low, high = np.percentile(finite, [1, 99])
        if high <= low:
            high = low + 1
        image = np.nan_to_num((image-low)/(high-low), nan=0.0, posinf=1.0, neginf=0.0)
        image = np.clip(image, 0, 1)
        image = (image*255).astype(np.uint8)
    # High-pass mosaics are monochrome detail maps, not natural-colour photographs.
    # Resize to small power-of-two dimensions for mobile GPU memory and download costs.
    im = Image.fromarray(image, mode="L").resize(size, Image.Resampling.LANCZOS)
    im = ImageOps.autocontrast(im, cutoff=1)
    im = ImageEnhance.Contrast(im).enhance(0.8)
    im = im.convert("RGB")
    path = OUT / f"{body}-texture.jpg"
    im.save(path, "JPEG", quality=82, optimize=True, progressive=True)
    print(f"{path}: {path.stat().st_size:,} bytes; {size[0]}x{size[1]}")

for body, spec in BODIES.items():
    make_mesh(body, ROOT / spec["table"])
    make_texture(body, ROOT / spec["fits"], spec["texture"])
