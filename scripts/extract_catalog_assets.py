"""Extract the catalog's embedded product photography into web-ready assets.

Usage:
    python scripts/extract_catalog_assets.py <christmas.pdf> <general.pdf>

The mapping is intentionally explicit so reruns are deterministic and a source
catalog change cannot silently reorder product photography.
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


ASSETS = {
    "navidad": {
        "hero-navidad": (1, 0),
        "pino-navidad": (2, 1),
        "galleta-jengibre": (2, 3),
        "arbol-hojas": (3, 1),
        "muneco-nieve": (3, 3),
        "renos-2d": (4, 1),
        "copo-nieve": (4, 3),
        "arbol-pesebre": (5, 1),
        "vela-postre-chantilli": (5, 3),
        "vaso-wax-melts-navidad": (6, 1),
        "vaso-arbolito-navideno": (6, 3),
        "velas-espiral": (7, 1),
        "vaso-hielos": (7, 3),
    },
    "general": {
        "hero-general": (1, 0),
        "logo-celestial": (2, 1),
        "vela-aromatica-300g": (4, 3),
        "vela-aromatica-150g": (4, 2),
        "vela-wax-melts-160g": (5, 1),
        "vela-wax-melts-100g": (5, 0),
        "bouquet-velas": (7, 0),
        "recordatorios-animales-a": (9, 0),
        "recordatorios-animales-b": (9, 1),
        "recordatorios-flores": (9, 2),
        "recordatorios-osos": (9, 3),
        "recordatorios-carritos": (9, 4),
    },
}

# Source catalogs contain a few screenshots used as image references. Crop only
# the surrounding device/application chrome; the product photography remains
# untouched.
CROPS = {
    "muneco-nieve": (0.00, 0.00, 1.00, 0.92),
    "vaso-hielos": (0.37, 0.095, 0.695, 0.79),
    "vaso-wax-melts-navidad": (0.00, 0.00, 1.00, 0.91),
    "velas-espiral": (0.00, 0.06, 1.00, 0.52),
}


def save_webp(image: Image.Image, destination: Path, crop=None) -> None:
    if crop:
        left, top, right, bottom = crop
        image = image.crop(
            (
                round(image.width * left),
                round(image.height * top),
                round(image.width * right),
                round(image.height * bottom),
            )
        )
    image = image.convert("RGBA" if "A" in image.getbands() else "RGB")
    image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.save(destination, "WEBP", quality=88, method=6)


def extract(pdf_path: Path, group: str, destination: Path) -> None:
    reader = PdfReader(str(pdf_path))
    for filename, (page_number, image_index) in ASSETS[group].items():
        page = reader.pages[page_number - 1]
        images = list(page.images)
        try:
            source = images[image_index].image
        except IndexError as exc:
            raise RuntimeError(
                f"Catalog structure changed: {group} page {page_number} "
                f"has no image at index {image_index}."
            ) from exc
        save_webp(source, destination / f"{filename}.webp", CROPS.get(filename))


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit(
            "Expected paths to the Christmas catalog and general catalog PDFs."
        )

    christmas_pdf = Path(sys.argv[1]).resolve(strict=True)
    general_pdf = Path(sys.argv[2]).resolve(strict=True)
    destination = Path(__file__).resolve().parents[1] / "public" / "images" / "products"

    extract(christmas_pdf, "navidad", destination)
    extract(general_pdf, "general", destination)
    print(f"Extracted {len(ASSETS['navidad']) + len(ASSETS['general'])} assets to {destination}")


if __name__ == "__main__":
    main()
