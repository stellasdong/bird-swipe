"""Macaulay Library asset URLs and media fetching.

All Macaulay-specific URL patterns live here. They are undocumented and could
change; if media stops loading, this is the one file to fix. Run this module
directly for a live smoke test:

    python -m bird_swipe.core.macaulay 661965337
"""

from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import requests
from platformdirs import user_cache_dir

_CDN = "https://cdn.download.ams.birds.cornell.edu/api/v2/asset"
_CDN_V1 = "https://cdn.download.ams.birds.cornell.edu/api/v1/asset"
_SITE = "https://macaulaylibrary.org/asset"
_UA = "bird-swipe/0.0.1 (+https://github.com/stellasdong/bird-swipe)"

# Image sizes offered by the CDN. 1200 is a good display default; 2400 for zoom.
PHOTO_SIZE_DEFAULT = 1200
PHOTO_SIZE_HIGH = 2400


def asset_page_url(ml_id: str | int) -> str:
    """The human reference page we replicate, e.g. .../asset/661965337."""
    return f"{_SITE}/{ml_id}"


def embed_url(ml_id: str | int) -> str:
    """Embeddable player page — used for video playback in a webview."""
    return f"{_SITE}/{ml_id}/embed"


def photo_url(ml_id: str | int, size: int = PHOTO_SIZE_DEFAULT) -> str:
    """Direct JPEG URL for a photo asset (also the poster frame for video)."""
    return f"{_CDN}/{ml_id}/{size}"


def video_url(ml_id: str | int) -> str:
    """Direct MP4 (H.264) URL for a video asset — played natively via QMediaPlayer.

    Note this uses the CDN's ``v1`` API; the ``v2`` path returns only a poster
    JPEG for video assets.
    """
    return f"{_CDN_V1}/{ml_id}/mp4"


def _cache_dir() -> Path:
    d = Path(user_cache_dir("bird-swipe", "bird-swipe")) / "media"
    d.mkdir(parents=True, exist_ok=True)
    return d


def fetch_photo(
    ml_id: str | int,
    size: int = PHOTO_SIZE_DEFAULT,
    *,
    session: requests.Session | None = None,
    timeout: float = 30.0,
) -> bytes:
    """Return JPEG bytes for the asset, using an on-disk cache keyed by id+size."""
    cache = _cache_dir() / f"{ml_id}_{size}.jpg"
    if cache.exists() and cache.stat().st_size > 0:
        return cache.read_bytes()

    getter = session or requests
    resp = getter.get(photo_url(ml_id, size), headers={"User-Agent": _UA}, timeout=timeout)
    resp.raise_for_status()
    data = resp.content

    # Unique temp name so a prefetch and the main fetch of the same id can't
    # clobber each other's partial file before the atomic rename.
    fd, tmp_name = tempfile.mkstemp(dir=str(cache.parent), suffix=".part")
    with os.fdopen(fd, "wb") as fh:
        fh.write(data)
    os.replace(tmp_name, cache)  # atomic within the cache dir
    return data


def _smoke_test(ml_id: str) -> int:
    print(f"asset page : {asset_page_url(ml_id)}")
    print(f"embed      : {embed_url(ml_id)}")
    print(f"photo      : {photo_url(ml_id)}")
    try:
        data = fetch_photo(ml_id)
    except Exception as exc:  # pragma: no cover - live network
        print(f"FETCH FAILED: {exc}")
        return 1
    ok = data[:2] == b"\xff\xd8"  # JPEG magic
    print(f"fetched {len(data)} bytes, jpeg={ok}")
    return 0 if ok else 2


if __name__ == "__main__":
    _id = sys.argv[1] if len(sys.argv) > 1 else "661965337"
    raise SystemExit(_smoke_test(_id))
