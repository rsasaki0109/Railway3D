from __future__ import annotations

import argparse
from pathlib import Path

from railway3d_pipeline import __version__
from railway3d_pipeline.diffing import diff_dataset_files, diff_to_markdown
from railway3d_pipeline.json_utils import write_json
from railway3d_pipeline.packaging import package_dataset
from railway3d_pipeline.schema_validation import validate_dataset_file
from railway3d_pipeline.source_registry import audit_source, fetch_source
from railway3d_pipeline.synthetic import PipelineError, build_synthetic_region


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="railway3d",
        description="Railway3D static data pipeline command line interface.",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    subparsers = parser.add_subparsers(dest="command")

    source_parser = subparsers.add_parser("source", help="Audit and fetch data sources.")
    source_subparsers = source_parser.add_subparsers(dest="source_command")
    source_audit_parser = source_subparsers.add_parser("audit", help="Audit configured sources.")
    source_audit_parser.add_argument("region", help="Region id to audit.")
    source_audit_parser.add_argument("--output", type=Path)
    source_fetch_parser = source_subparsers.add_parser("fetch", help="Fetch a fixed source snapshot.")
    source_fetch_parser.add_argument("region", help="Region id to fetch.")
    source_fetch_parser.add_argument("--output", type=Path, default=Path("build/sources/synthetic-golden"))

    build_parser_command = subparsers.add_parser("build", help="Build static dataset assets.")
    build_subparsers = build_parser_command.add_subparsers(dest="build_command")
    region_parser = build_subparsers.add_parser("region", help="Build a configured region.")
    region_parser.add_argument("region", help="Region id to build.")
    region_parser.add_argument("--output", type=Path, default=Path("build/data/synthetic-golden"))
    region_parser.add_argument("--schema-dir", type=Path, default=Path("schemas/v1"))
    region_parser.add_argument("--max-abs-gradient-permille", type=float, default=60.0)

    validate_parser = subparsers.add_parser("validate", help="Validate Railway3D assets.")
    validate_subparsers = validate_parser.add_subparsers(dest="validate_command")
    dataset_parser = validate_subparsers.add_parser("dataset", help="Validate a dataset JSON file.")
    dataset_parser.add_argument("path", type=Path)
    dataset_parser.add_argument("--schema-dir", type=Path, default=Path("schemas/v1"))

    diff_parser = subparsers.add_parser("diff", help="Compare Railway3D dataset assets.")
    diff_subparsers = diff_parser.add_subparsers(dest="diff_command")
    diff_dataset_parser = diff_subparsers.add_parser("dataset", help="Diff two dataset JSON files.")
    diff_dataset_parser.add_argument("left", type=Path)
    diff_dataset_parser.add_argument("right", type=Path)
    diff_dataset_parser.add_argument("--output", type=Path)
    diff_dataset_parser.add_argument("--json-output", type=Path)

    package_parser = subparsers.add_parser("package", help="Package Railway3D dataset assets.")
    package_subparsers = package_parser.add_subparsers(dest="package_command")
    package_dataset_parser = package_subparsers.add_parser("dataset", help="Package a dataset JSON file.")
    package_dataset_parser.add_argument("path", type=Path)
    package_dataset_parser.add_argument("--target", type=Path, required=True)
    package_dataset_parser.add_argument("--public", action="store_true")

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    try:
        if args.command == "source" and args.source_command == "audit":
            report = audit_source(args.region)
            if args.output:
                write_json(args.output, report)
            print(f"Audited sources for {args.region}: {report['sourceCount']} source(s)")
            return 0

        if args.command == "source" and args.source_command == "fetch":
            report = fetch_source(args.region, args.output)
            print(f"Fetched source snapshot for {args.region}: {report['checksum']}")
            return 0

        if args.command == "build" and args.build_command == "region":
            result = build_synthetic_region(
                args.region,
                args.output,
                args.schema_dir,
                max_abs_gradient_permille=args.max_abs_gradient_permille,
            )
            print(f"Built {args.region}: {result.dataset_path} {result.checksum}")
            return 0

        if args.command == "validate" and args.validate_command == "dataset":
            issues = validate_dataset_file(args.path, args.schema_dir)
            if issues:
                for issue in issues:
                    print(f"{issue.code}: {issue.path}: {issue.message}")
                return 1
            print(f"Validated {args.path}")
            return 0

        if args.command == "diff" and args.diff_command == "dataset":
            diff = diff_dataset_files(args.left, args.right)
            markdown = diff_to_markdown(diff)
            if args.output:
                args.output.parent.mkdir(parents=True, exist_ok=True)
                args.output.write_text(markdown, encoding="utf-8")
            if args.json_output:
                write_json(args.json_output, diff)
            print(markdown, end="")
            return 0

        if args.command == "package" and args.package_command == "dataset":
            manifest = package_dataset(args.path, args.target, public=args.public)
            print(f"Packaged {args.path} into {args.target}: {manifest['datasetChecksum']}")
            return 0
    except PipelineError as error:
        print(f"{error.code}: {error}")
        return 1

    return 0
