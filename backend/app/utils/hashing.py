import hashlib
from typing import Union
from pathlib import Path


def compute_sha256(source: Union[str, Path, bytes]) -> str:
    """Compute SHA-256 hash of a file path or raw bytes."""
    sha256_hash = hashlib.sha256()

    if isinstance(source, bytes):
        sha256_hash.update(source)
        return sha256_hash.hexdigest()

    file_path = Path(source)
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(65536), b""):
            sha256_hash.update(byte_block)

    return sha256_hash.hexdigest()
