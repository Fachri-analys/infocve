# push-ssh.ps1
# Membantu membuat SSH key (jika belum ada), menyalin public key ke clipboard,
# dan mendorong repository ke remote SSH git@github.com:USERNAME/REPO.git

param(
    [string]$Username = "Fachri-analys",
    [string]$RepoName = "infocve"
)

$sshPub = "$env:USERPROFILE\.ssh\id_ed25519.pub"
$sshPriv = "$env:USERPROFILE\.ssh\id_ed25519"

# 1) buat key jika belum ada
if (-not (Test-Path $sshPub)) {
    Write-Host "SSH key tidak ditemukan. Membuat ed25519 key di $sshPriv" -ForegroundColor Yellow
    ssh-keygen -t ed25519 -f $sshPriv -C "$(whoami)@$(hostname)" -N "" | Out-Null
    if ($LASTEXITCODE -ne 0) { Write-Host "Gagal membuat SSH key" -ForegroundColor Red; exit 1 }
}

# 2) copy public key ke clipboard
Get-Content $sshPub | Set-Clipboard
Write-Host "Public key telah disalin ke clipboard."
Write-Host "Silakan paste ke GitHub → Settings → SSH and GPG keys → New SSH key." -ForegroundColor Cyan
Write-Host "Membuka halaman GitHub SSH key..."
Start-Process "https://github.com/settings/keys"

Write-Host "Tekan Enter setelah Anda menambahkan SSH key ke GitHub dan menyimpan halaman..."
Read-Host

# 3) tambahkan remote SSH dan push
$remote = "git@github.com:$Username/$RepoName.git"
Write-Host "Menambahkan remote: $remote"
try {
    git remote remove origin -ErrorAction SilentlyContinue | Out-Null
} catch {}

git remote add origin $remote
if ($LASTEXITCODE -ne 0) { Write-Host "Gagal menambahkan remote. Periksa URL dan coba lagi." -ForegroundColor Red; exit 2 }

# 4) pastikan branch main dan push
git branch -M main
Write-Host "Mendorong ke origin/main..."

# Jika repo belum ada di GitHub, push akan gagal. Tampilkan pesan yang membantu.
$push = git push -u origin main 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "Push sukses. Buka: https://github.com/$Username/$RepoName" -ForegroundColor Green
} else {
    Write-Host "Push gagal. Output:" -ForegroundColor Red
    Write-Host $push
    Write-Host "Jika repo belum dibuat di GitHub, buat repo kosong di https://github.com/new lalu ulangi script, atau gunakan gh repo create." -ForegroundColor Yellow
    exit 3
}
