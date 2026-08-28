# push-gh-cli.ps1
# Gunakan script ini untuk membuat repository dan push pake GitHub CLI (gh).
# Prasyarat: gh terinstall dan sudah login (gh auth login).

param(
    [string]$RepoName = "infocve",
    [ValidateSet("public","private")]
    [string]$Visibility = "public"
)

Write-Host "Repo: $RepoName  Visibility: $Visibility"

# cek gh
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host "GitHub CLI (gh) tidak ditemukan. Install terlebih dahulu, contoh:
winget install --id=GitHub.cli -e" -ForegroundColor Yellow
    exit 1
}

# cek auth
$auth = gh auth status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Belum login ke gh. Menjalankan 'gh auth login'..." -ForegroundColor Yellow
    gh auth login
    if ($LASTEXITCODE -ne 0) { Write-Host "Gagal login ke gh" -ForegroundColor Red; exit 2 }
}

# buat repo & push
$flag = if ($Visibility -eq 'private') { '--private' } else { '--public' }
Write-Host "Membuat repository dan push..."
gh repo create $RepoName $flag --source="." --remote=origin --push
if ($LASTEXITCODE -eq 0) {
    Write-Host "Sukses: repo dibuat dan dipush ke origin/$RepoName" -ForegroundColor Green
    $user = gh api user --jq .login
    Write-Host "Buka: https://github.com/$user/$RepoName"
} else {
    Write-Host "Gagal membuat atau mendorong repo. Periksa output di atas." -ForegroundColor Red
    exit 3
}
