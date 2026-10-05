#!/usr/bin/env python3
"""
My-Class-Track — ساخت بسته قابل‌حمل (Portable ZIP).

همه فایل‌های لازم برای اجرا را در یک پوشه جمع می‌کند، همراه با
«شروع.bat» برای اجرا با دابل‌کلیک در ویندوز.

اجرا:
    python build-portable.py
    python build-portable.py --out dist
خروجی:
    dist/My-Class-Track-v1.0.0-portable/My-Class-Track.zip
"""
import argparse
import os
import shutil
import sys
import zipfile

ROOT = os.path.dirname(os.path.abspath(__file__))
VERSION = "1.0.0"

# همه چیزی که برای اجرا لازم است (نه سورس تست و نه ابزار ساخت).
INCLUDE_FILES = [
    "index.html",
    "offline.html",
    "manifest.webmanifest",
    "sw.js",
    "run.py",
]

INCLUDE_DIRS = [
    "src",
    "icons",
]

# فایل‌های راهنما که داخل بسته می‌آیند.
INCLUDE_DOCS = [
    "README.md",
]

START_BAT = """@echo off
REM ==========================================================
REM  My-Class-Track - اجرای برنامه
REM  برای توقف، این پنجره را ببندید.
REM ==========================================================
setlocal

cd /d "%~dp0"

where py >nul 2>nul
if %errorlevel%==0 (
    start "" http://localhost:8777/
    py -3 run.py
    goto :eof
)

where python >nul 2>nul
if %errorlevel%==0 (
    start "" http://localhost:8777/
    python run.py
    goto :eof
)

echo.
echo   Python is not installed.
echo   Please install Python 3 from https://python.org
echo   and tick "Add python.exe to PATH" during setup.
echo.
pause
"""

START_SH = """#!/bin/sh
# My-Class-Track - launcher for macOS and Linux
cd "$(dirname "$0")" || exit 1

for cmd in python3 python; do
  if command -v "$cmd" >/dev/null 2>&1; then
    PORT=${PORT:-8777}
    (sleep 1 && (xdg-open "http://localhost:$PORT/" || open "http://localhost:$PORT/")) >/dev/null 2>&1 &
    exec "$cmd" run.py --port "$PORT"
  fi
done

echo "Python 3 is required. Install it from https://python.org"
exit 1
"""


def copy_tree(src: str, dst: str) -> int:
    """کپی یک پوشه و برگرداندن تعداد فایل‌ها."""
    count = 0
    for root, dirs, files in os.walk(src):
        dirs[:] = [d for d in dirs if d not in {"__pycache__", ".git"}]
        rel = os.path.relpath(root, src)
        target_dir = os.path.join(dst, rel) if rel != "." else dst
        os.makedirs(target_dir, exist_ok=True)
        for name in files:
            shutil.copy2(os.path.join(root, name), os.path.join(target_dir, name))
            count += 1
    return count


def main() -> int:
    parser = argparse.ArgumentParser(description="ساخت بسته قابل‌حمل")
    parser.add_argument("--out", default="dist", help="پوشه خروجی (پیش‌فرض dist)")
    args = parser.parse_args()

    stage = os.path.join(ROOT, args.out, f"My-Class-Track-v{VERSION}-portable")

    if os.path.isdir(stage):
        shutil.rmtree(stage)
    os.makedirs(stage)

    total = 0
    missing = []

    for name in INCLUDE_FILES + INCLUDE_DOCS:
        src = os.path.join(ROOT, name)
        if os.path.exists(src):
            shutil.copy2(src, os.path.join(stage, name))
            total += 1
        else:
            missing.append(name)

    for d in INCLUDE_DIRS:
        src = os.path.join(ROOT, d)
        if os.path.isdir(src):
            total += copy_tree(src, os.path.join(stage, d))
        else:
            missing.append(d + "/")

    if missing:
        print("  ! این موارد پیدا نشدند: " + ", ".join(missing))

    # راه‌اندازها
    bat = os.path.join(stage, "شروع.bat")
    with open(bat, "w", encoding="cp1256", errors="replace") as f:
        f.write(START_BAT)

    sh = os.path.join(stage, "start.sh")
    with open(sh, "w", encoding="utf-8", newline="\n") as f:
        f.write(START_SH)
    os.chmod(sh, 0o755)

    # فشرده‌سازی
    zip_path = stage + ".zip"
    if os.path.exists(zip_path):
        os.remove(zip_path)

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for root, _dirs, files in os.walk(stage):
            for name in files:
                full = os.path.join(root, name)
                zf.write(full, os.path.relpath(full, os.path.dirname(stage)))

    size_kb = os.path.getsize(zip_path) / 1024
    print()
    print(f"  بسته ساخته شد: {zip_path}")
    print(f"  {total} فایل، {size_kb:.0f} KB")
    print()
    print("  اجرا: پوشه را از حالت فشرده خارج کنید و «شروع.bat» را دابل‌کلیک کنید.")
    print()
    return 0 if not missing else 1


if __name__ == "__main__":
    sys.exit(main())