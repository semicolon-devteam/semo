#!/usr/bin/env python3
"""
Unpack a .docx file to a directory for editing.

Usage:
    python unpack.py <docx_file> <output_directory>

Example:
    python unpack.py document.docx unpacked/
"""

import sys
import zipfile
from pathlib import Path


def unpack_docx(docx_path: str, output_dir: str) -> None:
    """Unpack a .docx file to a directory."""
    docx_path = Path(docx_path)
    output_dir = Path(output_dir)

    if not docx_path.exists():
        print(f"Error: File not found: {docx_path}")
        sys.exit(1)

    if output_dir.exists():
        print(f"Warning: Output directory exists, will overwrite: {output_dir}")

    output_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(docx_path, 'r') as zip_ref:
        zip_ref.extractall(output_dir)

    print(f"Unpacked: {docx_path} -> {output_dir}")
    print(f"\nKey files:")
    print(f"  - {output_dir}/word/document.xml (main content)")
    print(f"  - {output_dir}/word/styles.xml (styles)")

    # Suggest RSID for tracked changes
    import random
    rsid = f"{random.randint(0, 0xFFFFFF):06X}"
    print(f"\nSuggested RSID for tracked changes: {rsid}")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    unpack_docx(sys.argv[1], sys.argv[2])
