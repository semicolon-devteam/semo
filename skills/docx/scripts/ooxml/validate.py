#!/usr/bin/env python3
"""
Validate XML files in an unpacked .docx directory.

Usage:
    python validate.py <unpacked_directory>

Example:
    python validate.py unpacked/
"""

import sys
from pathlib import Path

try:
    from defusedxml import ElementTree as ET
except ImportError:
    print("Warning: defusedxml not installed, using standard xml.etree")
    from xml.etree import ElementTree as ET


def validate_xml(xml_path: Path) -> tuple[bool, str]:
    """Validate an XML file."""
    try:
        ET.parse(xml_path)
        return True, "Valid"
    except ET.ParseError as e:
        return False, str(e)


def validate_docx_directory(dir_path: str) -> None:
    """Validate all XML files in an unpacked docx directory."""
    dir_path = Path(dir_path)

    if not dir_path.exists():
        print(f"Error: Directory not found: {dir_path}")
        sys.exit(1)

    xml_files = list(dir_path.rglob('*.xml'))
    rels_files = list(dir_path.rglob('*.rels'))
    all_files = xml_files + rels_files

    if not all_files:
        print(f"Error: No XML files found in {dir_path}")
        sys.exit(1)

    print(f"Validating {len(all_files)} XML files...\n")

    errors = []
    for xml_file in all_files:
        valid, message = validate_xml(xml_file)
        relative_path = xml_file.relative_to(dir_path)

        if valid:
            print(f"  [OK] {relative_path}")
        else:
            print(f"  [ERROR] {relative_path}: {message}")
            errors.append((relative_path, message))

    print(f"\n{'=' * 50}")
    if errors:
        print(f"FAILED: {len(errors)} error(s) found")
        for path, msg in errors:
            print(f"  - {path}: {msg}")
        sys.exit(1)
    else:
        print(f"PASSED: All {len(all_files)} files are valid")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)

    validate_docx_directory(sys.argv[1])
