from __future__ import annotations

import argparse
from pathlib import Path

from railway3d_pipeline import __version__
from railway3d_pipeline.schema_validation import validate_dataset_file


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="railway3d",
        description="Railway3D static data pipeline command line interface.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    subparsers = parser.add_subparsers(dest="command")

    validate_parser = subparsers.add_parser("validate", help="Validate Railway3D assets.")
    validate_subparsers = validate_parser.add_subparsers(dest="validate_command")
    dataset_parser = validate_subparsers.add_parser("dataset", help="Validate a dataset JSON file.")
    dataset_parser.add_argument("path", type=Path)
    dataset_parser.add_argument("--schema-dir", type=Path, default=Path("schemas/v1"))

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    if args.command == "validate" and args.validate_command == "dataset":
        issues = validate_dataset_file(args.path, args.schema_dir)
        if issues:
            for issue in issues:
                print(f"{issue.code}: {issue.path}: {issue.message}")
            return 1
        print(f"Validated {args.path}")
        return 0

    return 0
