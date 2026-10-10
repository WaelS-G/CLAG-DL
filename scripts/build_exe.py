"""
Builds the standalone Windows .exe for CLAG Downloader using PyInstaller.
"""

import os
import sys
import subprocess
import shutil

def main():
    root_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    print("=" * 60)
    print("  CLAG Downloader - Windows Executable Builder (.exe)")
    print("=" * 60)

    # 1. Build frontend bundle and sync dist folders
    print("\n[1/3] Building Client UIX Production Bundle...")
    npm_cmd = ["cmd", "/c", "npm", "run", "build"]
    ret = subprocess.run(npm_cmd, cwd=root_dir)
    subprocess.run(["node", "scripts/sync_web_dist.js"], cwd=root_dir)

    # 2. Package with PyInstaller
    print("\n[2/3] Compiling Standalone Executable with PyInstaller...")
    icon_path = os.path.join(root_dir, "public", "favicon.ico")
    main_script = os.path.join(root_dir, "src", "python", "clag_desktop.py")
    dist_dir = os.path.join(root_dir, "dist", "exe")

    client_dist = os.path.join(root_dir, "dist", "client")
    public_dir = os.path.join(root_dir, "public")
    python_dir = os.path.join(root_dir, "src", "python")

    pyinstaller_args = [
        sys.executable, "-m", "PyInstaller",
        "--name=CLAG_Downloader",
        "--onefile",
        "--noconsole",
        f"--distpath={dist_dir}",
        f"--workpath={os.path.join(root_dir, 'build', 'pyinstaller')}",
        f"--specpath={os.path.join(root_dir, 'build', 'pyinstaller')}",
        f"--paths={python_dir}",
        f"--add-data={client_dist};dist/client",
        f"--add-data={public_dir};public",
        "--collect-all=webview",
        "--collect-all=clr_loader",
        "--collect-all=pythonnet",
        "--collect-all=yt_dlp",
        "--clean",
    ]

    if os.path.exists(icon_path):
        pyinstaller_args.append(f"--icon={icon_path}")

    pyinstaller_args.append(main_script)

    ret = subprocess.run(pyinstaller_args, cwd=root_dir)
    if ret.returncode != 0:
        print("Error: PyInstaller build failed.")
        sys.exit(ret.returncode)

    exe_path = os.path.join(dist_dir, "CLAG_Downloader.exe")
    print("\n[3/3] Success! Standalone Executable created:")
    print(f"      {exe_path}")
    print("=" * 60)

if __name__ == "__main__":
    main()
