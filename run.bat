@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

:MENU
cls
echo ======================================================================
echo                     CLAG DOWNLOADER - AUTOMATION RUNNER
echo        Next-Gen Multi-Connection Download Manager and Media Grabber
echo                          Made by: Wael Sayed
echo ======================================================================
echo.
echo  [1] Start Development Server (Full UIX + Engine)
echo  [2] Build Production Bundle (Client and Server)
echo  [3] Start Standalone Desktop App (App Window Mode)
echo  [4] Run Python Interactive CLI / Engine
echo  [5] Package Browser Extension (.zip for Chrome/Edge)
echo  [6] Build Standalone Windows Executable (.exe)
echo  [7] Build and Sync Web Distribution (dist/web for Vercel)
echo  [8] Deploy to Vercel via CLI (npx vercel --prod)
echo  [9] Push Project to GitHub (for Render.com Cloud Deployment)
echo  [10] Install / Verify All Dependencies
echo  [11] Run Unit Tests and Integrity Checks
echo  [12] Exit
echo.
echo ======================================================================
set /p CHOICE="Select an option [1-12]: "

if "%CHOICE%"=="1" goto DEV_SERVER
if "%CHOICE%"=="2" goto BUILD_PROD
if "%CHOICE%"=="3" goto DESKTOP_APP
if "%CHOICE%"=="4" goto PYTHON_CLI
if "%CHOICE%"=="5" goto PACKAGE_EXT
if "%CHOICE%"=="6" goto BUILD_EXE
if "%CHOICE%"=="7" goto BUILD_WEB
if "%CHOICE%"=="8" goto DEPLOY_VERCEL
if "%CHOICE%"=="9" goto PUSH_GITHUB
if "%CHOICE%"=="10" goto INSTALL_DEPS
if "%CHOICE%"=="11" goto RUN_TESTS
if "%CHOICE%"=="12" goto EXIT_SCRIPT

echo.
echo Invalid selection. Please choose an option from 1 to 12.
pause
goto MENU

:DEV_SERVER
cls
echo Starting CLAG Downloader Development Engine...
echo Server running at http://localhost:8989
echo Press Ctrl+C to stop.
echo.
call npx tsx watch src/server/server.ts
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Server process stopped with error code %ERRORLEVEL%.
    pause
)
goto MENU

:BUILD_PROD
cls
echo Building production bundles...
echo.
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Production build failed with error code %ERRORLEVEL%.
    pause
    goto MENU
)
echo.
echo Production build completed successfully!
pause
goto MENU

:DESKTOP_APP
cls
echo Launching CLAG Downloader Desktop Edition...
python src/python/clag_desktop.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Failed to start Desktop Edition.
    pause
)
goto MENU

:PYTHON_CLI
cls
echo Starting CLAG Python Interactive CLI...
python -m src.python.clag_cli
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Python CLI exited with error code %ERRORLEVEL%.
    pause
)
goto MENU

:PACKAGE_EXT
cls
echo Packaging Chrome/Edge Browser Extension...
node scripts/package_extension.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Failed to package browser extension.
    pause
    goto MENU
)
echo.
pause
goto MENU

:BUILD_EXE
cls
echo Building standalone Windows Executable (.exe)...
python scripts/build_exe.py
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Failed to build .exe file.
    pause
    goto MENU
)
echo.
pause
goto MENU

:BUILD_WEB
cls
echo Building and Syncing Web Distribution for Cloud Hosting...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Frontend build failed with error code %ERRORLEVEL%.
    pause
    goto MENU
)
call node scripts/sync_web_dist.js
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Web distribution sync failed with error code %ERRORLEVEL%.
    pause
    goto MENU
)
echo.
echo dist/web is synchronized and ready for Vercel deployment!
pause
goto MENU

:DEPLOY_VERCEL
cls
echo Deploying CLAG Downloader to Vercel...
echo.
call npx vercel --prod
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Vercel deployment process encountered error code %ERRORLEVEL%.
    pause
    goto MENU
)
echo.
echo Vercel deployment completed!
pause
goto MENU

:PUSH_GITHUB
cls
echo ======================================================================
echo                PUSH CLAG DOWNLOADER TO GITHUB
echo ======================================================================
echo.
echo This command pushes the clean project source code to your GitHub
echo repository (automatically excluding node_modules and big .exe files).
echo.
set /p REPO_URL="Enter your GitHub repository URL (e.g. https://github.com/username/repo.git): "
if "!REPO_URL!"=="" (
    echo.
    echo Repository URL cannot be empty.
    pause
    goto MENU
)
echo.
echo Configuring remote repository...
git remote remove origin 2>nul
git remote add origin "!REPO_URL!"
git branch -M main
echo.
echo Pushing files to GitHub main branch...
git push -u origin main --force
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Git push failed with error code %ERRORLEVEL%.
    echo Please verify your repository URL and GitHub permissions.
    pause
    goto MENU
)
echo.
echo Project successfully pushed to GitHub!
echo You can now go to Render.com and connect this repository.
pause
goto MENU

:INSTALL_DEPS
cls
echo Installing and verifying dependencies...
echo.
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo npm install failed with error code %ERRORLEVEL%.
    pause
    goto MENU
)
python -m pip install -q yt-dlp pillow pyinstaller
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Python dependency check failed.
    pause
    goto MENU
)
echo.
echo All dependencies installed and verified successfully!
pause
goto MENU

:RUN_TESTS
cls
echo Running integrity tests...
node --test
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Tests failed.
    pause
    goto MENU
)
echo.
echo All tests passed!
pause
goto MENU

:EXIT_SCRIPT
echo Exiting CLAG Downloader.
exit /b 0
