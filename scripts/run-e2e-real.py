"""Roda o E2E real. O token vem do Bitwarden direto para o ambiente do processo; nunca e impresso."""
import os
import subprocess
import sys

PS = (
    "$s = (& 'C:\\Users\\luanc\\agent-tools\\bw-auto-unlock\\Get-BwSession.ps1') | Select-Object -Last 1; "
    "$env:BW_SESSION = $s; "
    "$it = bw get item 'Dumentre / Chatwoot / API token (hermes)' | ConvertFrom-Json; "
    "if ($it.login.password) { [Console]::Out.Write($it.login.password) } else { [Console]::Out.Write($it.notes) }"
)
tok = subprocess.run(["powershell", "-NoProfile", "-Command", PS], capture_output=True, text=True).stdout.strip().splitlines()[-1].strip()
env = dict(
    os.environ,
    CW_TOKEN=tok,
    CW_BASE_URL="https://chatwoot.46-224-228-253.sslip.io",
    CW_ACCOUNT="2",
    CW_INBOX="3",
)
sys.exit(subprocess.run(["npx.cmd", "playwright", "test", "-c", "playwright.real.config.ts"], env=env).returncode)
