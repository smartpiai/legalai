"""Round-trip YAML I/O preserving comments and key order."""
from __future__ import annotations

import io
from pathlib import Path
from typing import Any

from ruamel.yaml import YAML


def _yaml() -> YAML:
    y = YAML()
    y.preserve_quotes = True
    y.width = 4096
    y.indent(mapping=2, sequence=4, offset=2)
    return y


def load_yaml(path: Path) -> Any:
    return _yaml().load(path.read_text())


def dump_yaml(data: Any) -> str:
    buf = io.StringIO()
    _yaml().dump(data, buf)
    return buf.getvalue()
