#!/usr/bin/env python3
"""Generate Diesel table declarations from latest committed Drizzle snapshot."""

import hashlib
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parents[2]
SNAPSHOT = ROOT / "packages/database/drizzle/meta/0086_snapshot.json"
OUTPUT = ROOT / "crates/database/src/schema.rs"

SQL_TYPES = {
    "bigint": "BigInt",
    "boolean": "Bool",
    "date": "Date",
    "double precision": "Double",
    "integer": "Integer",
    "integer[]": "Array<Integer>",
    "jsonb": "Jsonb",
    "real": "Float",
    "real[]": "Array<Float>",
    "smallint": "SmallInt",
    "text": "Text",
    "timestamp with time zone": "Timestamptz",
    "varchar": "Varchar",
    "varchar(255)": "Varchar",
}
KEYWORDS = {
    "as", "async", "await", "break", "const", "continue", "crate", "dyn", "else",
    "enum", "extern", "false", "fn", "for", "if", "impl", "in", "let", "loop",
    "match", "mod", "move", "mut", "pub", "ref", "return", "self", "Self", "static",
    "struct", "super", "trait", "true", "type", "union", "unsafe", "use", "where",
    "while", "abstract", "become", "box", "do", "final", "macro", "override", "priv",
    "typeof", "unsized", "virtual", "yield", "try",
}


def rust_name(name: str) -> str:
    candidate = re.sub(r"[^A-Za-z0-9_]", "_", name)
    return f"r#{candidate}" if candidate in KEYWORDS else candidate


def primary_key(table: dict) -> list[str]:
    result = [column["name"] for column in table["columns"].values() if column["primaryKey"]]
    for key in table["compositePrimaryKeys"].values():
        result.extend(key["columns"])
    if not result:
        raise ValueError(f"table {table['name']} has no primary key")
    return list(dict.fromkeys(result))


def declaration(schema: str, name: str, columns: dict, keys: list[str], module_name: str | None = None) -> str:
    rust_table_name = module_name or name
    table_path = f"{schema}.{rust_table_name}" if schema else rust_table_name
    rendered_keys = ", ".join(rust_name(key) for key in keys)
    lines = ["diesel::table! {"]
    if module_name:
        lines.append(f'    #[sql_name = "{name}"]')
    lines.append(f"    {table_path} ({rendered_keys}) {{")
    for column in columns.values():
        sql_type = SQL_TYPES[column["type"]]
        if not column["notNull"]:
            sql_type = f"Nullable<{sql_type}>"
        lines.append(f"        {rust_name(column['name'])} -> {sql_type},")
    lines.extend(["    }", "}", ""])
    return "\n".join(lines)


def main() -> None:
    snapshot_bytes = SNAPSHOT.read_bytes()
    snapshot = json.loads(snapshot_bytes)
    table_columns = sum(len(table["columns"]) for table in snapshot["tables"].values())
    view_columns = sum(len(view["columns"]) for view in snapshot["views"].values())
    parts = [
        "//! Generated from packages/database/drizzle/meta/0086_snapshot.json.",
        "//! Regenerate with tools/rust-migration/generate-diesel-schema.py.",
        "",
        f'pub const DRIZZLE_SNAPSHOT_SHA256: &str = "{hashlib.sha256(snapshot_bytes).hexdigest()}";',
        f"pub const DRIZZLE_TABLE_COUNT: usize = {len(snapshot['tables'])};",
        f"pub const DRIZZLE_VIEW_COUNT: usize = {len(snapshot['views'])};",
        f"pub const DRIZZLE_COLUMN_COUNT: usize = {table_columns + view_columns};",
        "",
    ]
    for qualified_name, table in sorted(snapshot["tables"].items()):
        keys = primary_key(table)
        columns = list(table["columns"].items())
        if len(columns) <= 32:
            parts.append(declaration(table["schema"], table["name"], table["columns"], keys))
            continue
        key_columns = [(name, column) for name, column in columns if name in keys]
        value_columns = [(name, column) for name, column in columns if name not in keys]
        width = 32 - len(key_columns)
        for index in range(0, len(value_columns), width):
            projection = dict(key_columns + value_columns[index:index + width])
            part = index // width + 1
            parts.append(declaration(table["schema"], table["name"], projection, keys, f"{table['name']}_part_{part}"))
    for qualified_name, view in sorted(snapshot["views"].items()):
        # record_history_entry is unique for this pair in its defining query.
        parts.append(declaration(view["schema"], view["name"], view["columns"], ["history_view", "id"]))
    OUTPUT.write_text("\n".join(parts), encoding="utf-8")


if __name__ == "__main__":
    main()
