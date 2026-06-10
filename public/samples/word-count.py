#!/usr/bin/env python3
"""
Sample Ocean Compute-to-Data algorithm.

Reads any mounted input files under common Ocean compute input folders,
counts lines/words/bytes, and writes a small JSON report.
"""

import json
from pathlib import Path


INPUT_CANDIDATES = [
    Path("/data/inputs"),
    Path("/data/input"),
    Path("/data"),
    Path.cwd(),
]
OUTPUT_DIR = Path("/data/outputs")


def iter_input_files():
    seen = set()
    for folder in INPUT_CANDIDATES:
        if not folder.exists():
            continue
        for path in folder.rglob("*"):
            if not path.is_file() or path in seen:
                continue
            if str(path).startswith(str(OUTPUT_DIR)):
                continue
            seen.add(path)
            yield path


def summarize_file(path):
    data = path.read_bytes()
    text = data.decode("utf-8", errors="ignore")
    return {
        "path": str(path),
        "bytes": len(data),
        "lines": len(text.splitlines()),
        "words": len(text.split()),
    }


def main():
    results = [summarize_file(path) for path in iter_input_files()]
    report = {
        "algorithm": "sample-word-count",
        "files": results,
        "totals": {
            "files": len(results),
            "bytes": sum(item["bytes"] for item in results),
            "lines": sum(item["lines"] for item in results),
            "words": sum(item["words"] for item in results),
        },
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output_file = OUTPUT_DIR / "word-count-report.json"
    output_file.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
