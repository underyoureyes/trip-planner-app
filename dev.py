import os
import shutil
import subprocess
import sys
import time
import urllib.request
import webbrowser

os.chdir(os.path.dirname(os.path.abspath(__file__)))

if not os.path.exists("node_modules"):
    print("Installing dependencies...")
    subprocess.run(["npm", "install"], check=True, shell=True)

if not os.path.exists(".env.local"):
    shutil.copy(".env.example", ".env.local")
    print(".env.local created — fill in your Supabase credentials, then re-run.")
    sys.exit(0)

print("Starting dev server at http://localhost:3000")
proc = subprocess.Popen(["npm", "run", "dev"], shell=True)

# Wait for the server to respond
print("Waiting for server", end="", flush=True)
for _ in range(60):
    try:
        urllib.request.urlopen("http://localhost:3000", timeout=2)
        print(" ready!")
        break
    except Exception:
        print(".", end="", flush=True)
        time.sleep(1)
else:
    print(" timed out, opening anyway")

# Check for dev credentials in .env.local
env_contents = open(".env.local").read()
if "DEV_EMAIL" in env_contents and "DEV_PASSWORD" in env_contents:
    target = "http://localhost:3000/api/dev-login"
else:
    target = "http://localhost:3000"

webbrowser.open(target)

try:
    proc.wait()
except KeyboardInterrupt:
    proc.terminate()
