@echo off
echo 🚀 Building ExaMark Desktop App...

REM Clean previous builds
echo 🧹 Cleaning previous builds...
if exist dist rmdir /s /q dist

REM Install dependencies if needed
echo 📦 Installing dependencies...
call npm install

REM Build for Windows
echo 🪟 Building for Windows...
call npm run build-win

echo ✅ Build complete! Check the dist/ folder for the installer.
echo.
echo 📁 Generated files:
dir dist

echo.
echo 🎯 Key features of ExaMark Desktop:
echo    • No memory limits (uses full system RAM)
echo    • Email tracking works even when minimized to tray
echo    • Offline database storage
echo    • Native desktop notifications
echo    • Auto-startup capabilities
echo    • Background email webhook processing
echo.
echo 💡 Distribution:
echo    • Windows: .exe installer in dist/ folder
echo    • Users can install and run without hosting costs
echo    • Perfect for individual users or small teams

pause
