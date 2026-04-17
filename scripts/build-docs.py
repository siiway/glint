import subprocess, sys

subprocess.run(["bun", "install"], check=True)
subprocess.run(["bun", "run", "docs:build"], check=True)
