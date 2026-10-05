#!/usr/bin/env python3
"""
My-Class-Track — اجرای محلی برنامه با یک دستور.

این اسکریپت یک سرور ساکن کوچک روی همین فایل‌ها بالا می‌آورد و مرورگر
را باز می‌کند. هیچ وابستگی بیرونی لازم نیست.

اجرا:
    python run.py
    python run.py --port 8080
    python run.py --no-browser
"""
import argparse
import http.server
import os
import socket
import socketserver
import threading
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 8777


class Handler(http.server.SimpleHTTPRequestHandler):
    """سرو فایل‌های ایستا با مسیر ریشه درست و بدون کش."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def end_headers(self):
        # همیشه آخرین نسخه فایل‌ها را بده تا سرویس‌ورکر نسخه کهنه نگه ندارد.
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        # فقط پیام‌های خطا را چاپ کن تا خروجی تمیز بماند.
        status = str(args[1]) if len(args) > 1 else ""
        if status.startswith(("4", "5")):
            print(f"  ! {fmt % args}")


def find_free_port(preferred: int) -> int:
    """اگر پیشنهادی اشغال بود، پورت آزاد بعدی را برمی‌گرداند."""
    for port in range(preferred, preferred + 50):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            try:
                s.bind(("127.0.0.1", port))
                return port
            except OSError:
                continue
    raise SystemExit("خطا: هیچ پورت آزادی پیدا نشد.")


def main() -> None:
    parser = argparse.ArgumentParser(description="اجرای محلی My-Class-Track")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT,
                        help=f"پورت دلخواه (پیش‌فرض {DEFAULT_PORT})")
    parser.add_argument("--host", default="127.0.0.1",
                        help="نشانی bind (پیش‌فرض فقط همین کامپیوتر)")
    parser.add_argument("--no-browser", action="store_true",
                        help="مرورگر را خودکار باز نکن")
    args = parser.parse_args()

    port = find_free_port(args.port)
    url = f"http://localhost:{port}/"

    print()
    print("  My-Class-Track")
    print("  " + "-" * 34)
    print(f"  آدرس برنامه : {url}")
    print(f"  پوشه فایل‌ها : {ROOT}")
    print("  برای توقف   : در همین پنجره Ctrl+C بزنید")
    print()
    print("  (اگر آدرس را در گوشی باز کنید، ابتدا باید همین را در تنظیمات")
    print("   به‌عنوان کلاس هفتگی وارد کنید.)")
    print()

    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((args.host, port), Handler) as httpd:
        if not args.no_browser:
            # کمی صبر کن تا سرور کاملاً آماده شود.
            threading.Timer(0.4, lambda: webbrowser.open(url)).start()
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n  برنامه متوقف شد. خداحافظ.\n")


if __name__ == "__main__":
    main()