# Auto Upload Script for GitHub Repository
# Script for uploading files to GitHub Repository

Write-Host "=== Auto Upload Script for GitHub Repository ===" -ForegroundColor Green
Write-Host "Repository: https://github.com/PhurichayaKd/vercel-deploy" -ForegroundColor Yellow
Write-Host ""

# Check if Git is installed
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Host "Git is not installed" -ForegroundColor Red
    Write-Host "Please install Git from https://git-scm.com/" -ForegroundColor Yellow
    exit 1
}

# Create temp folder for clone
$tempDir = "$env:TEMP\vercel-deploy-temp"
if (Test-Path $tempDir) {
    Remove-Item $tempDir -Recurse -Force
}

Write-Host "Creating temporary folder..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $tempDir -Force | Out-Null

try {
    # Clone repository
    Write-Host "Cloning repository..." -ForegroundColor Cyan
    Set-Location $tempDir
    git clone https://github.com/PhurichayaKd/vercel-deploy.git .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Cannot clone repository" -ForegroundColor Red
        Write-Host "Please check:" -ForegroundColor Yellow
        Write-Host "1. Internet connection" -ForegroundColor Yellow
        Write-Host "2. Repository access rights" -ForegroundColor Yellow
        Write-Host "3. Repository URL is correct" -ForegroundColor Yellow
        exit 1
    }

    # Copy all files from source folder
    Write-Host "Copying files..." -ForegroundColor Cyan
    $sourceDir = "D:\Project-IoT\safety-bus-bot\vercel-deploy"
    
    # List of files to copy
    $filesToCopy = @(
        "index.html",
        "package.json", 
        "vercel.json",
        "README.md"
    )
    
    # Copy main files
    foreach ($file in $filesToCopy) {
        $sourcePath = Join-Path $sourceDir $file
        if (Test-Path $sourcePath) {
            Copy-Item $sourcePath . -Force
            Write-Host "  $file" -ForegroundColor Green
        } else {
            Write-Host "  File not found: $file" -ForegroundColor Yellow
        }
    }
    
    # Copy css folder
    $cssSource = Join-Path $sourceDir "css"
    if (Test-Path $cssSource) {
        Copy-Item $cssSource . -Recurse -Force
        Write-Host "  css/" -ForegroundColor Green
    } else {
        Write-Host "  Folder not found: css" -ForegroundColor Yellow
    }
    
    # Copy js folder
    $jsSource = Join-Path $sourceDir "js"
    if (Test-Path $jsSource) {
        Copy-Item $jsSource . -Recurse -Force
        Write-Host "  js/" -ForegroundColor Green
    } else {
        Write-Host "  Folder not found: js" -ForegroundColor Yellow
    }

    # Check copied files
    Write-Host ""
    Write-Host "Files to upload:" -ForegroundColor Cyan
    Get-ChildItem -Recurse | Where-Object { !$_.PSIsContainer } | ForEach-Object {
        $relativePath = $_.FullName.Replace((Get-Location).Path + "\", "")
        Write-Host "  $relativePath" -ForegroundColor White
    }

    # Add all files to Git
    Write-Host ""
    Write-Host "Adding files to Git..." -ForegroundColor Cyan
    git add .
    
    # Check if there are changes
    $status = git status --porcelain
    if (-not $status) {
        Write-Host "No new files to upload" -ForegroundColor Yellow
        return
    }

    # Commit changes
    Write-Host "Committing changes..." -ForegroundColor Cyan
    $commitMessage = "Initial commit - Add LIFF app files for Safety Bus system"
    git commit -m $commitMessage
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Cannot commit" -ForegroundColor Red
        exit 1
    }

    # Push to GitHub
    Write-Host "Pushing to GitHub..." -ForegroundColor Cyan
    git push origin main
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Upload successful!" -ForegroundColor Green
        Write-Host "Repository: https://github.com/PhurichayaKd/vercel-deploy" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Cyan
        Write-Host "1. Go to Vercel and Deploy again" -ForegroundColor White
        Write-Host "2. Set LIFF ID" -ForegroundColor White
        Write-Host "3. Test the system" -ForegroundColor White
    } else {
        Write-Host "Cannot push" -ForegroundColor Red
        Write-Host "Please check repository access rights" -ForegroundColor Yellow
        exit 1
    }

} catch {
    Write-Host "Error occurred: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally {
    # Clean up temp folder
    Set-Location "D:\Project-IoT\safety-bus-bot\vercel-deploy"
    if (Test-Path $tempDir) {
        Remove-Item $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host ""
Write-Host "Completed!" -ForegroundColor Green