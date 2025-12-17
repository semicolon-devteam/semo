#!/usr/bin/env python3
"""
Pack a directory back into a .docx file.

Usage:
    python pack.py <input_directory> <output_docx>

Example:
    python pack.py unpacked/ edited.docx
"""

import sys
import zipfile
from pathlib import Path


def pack_docx(input_dir: str, output_path: str) -> None:
    """Pack a directory into a .docx file."""
    input_dir = Path(input_dir)
    output_path = Path(output_path)

    if not input_dir.exists():
        print(f"Error: Directory not found: {input_dir}")
        sys.exit(1)

    # Ensure .docx extension
    if not output_path.suffix == '.docx':
        output_path = output_path.with_suffix('.docx')

    # Create the docx (zip) file
    with zipfile.ZipFile(output_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in input_dir.rglob('*'):
            if file_path.is_file():
                arcname = file_path.relative_to(input_dir)
                zipf.write(file_path, arcname)

    print(f"Packed: {input_dir} -> {output_path}")
    print(f"File size: {output_path.stat().st_size:,} bytes")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)

    pack_docx(sys.argv[1], sys.argv[2])
