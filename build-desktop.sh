#!/bin/bash

# Meridian Desktop Build Script
echo "🚀 Building Meridian Desktop App..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Install dependencies if needed
echo "📦 Installing dependencies..."
npm install

# Build for different platforms
echo "🔨 Building for all platforms..."

# Windows
echo "🪟 Building for Windows..."
npm run build-win

# macOS (if on macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    echo "🍎 Building for macOS..."
    npm run build-mac
fi

# Linux
echo "🐧 Building for Linux..."
npm run build-linux

echo "✅ Build complete! Check the dist/ folder for installers."
echo ""
echo "📁 Generated files:"
ls -la dist/

echo ""
echo "🎯 Key features of Meridian Desktop:"
echo "   • No memory limits (uses full system RAM)"
echo "   • Email tracking works even when minimized to tray"
echo "   • Offline database storage"
echo "   • Native desktop notifications"
echo "   • Auto-startup capabilities"
echo "   • Background email webhook processing"
echo ""
echo "💡 Distribution:"
echo "   • Windows: .exe installer"
echo "   • macOS: .dmg installer"  
echo "   • Linux: .AppImage portable"
