#!/bin/bash
# 
# File: setup-project.sh
# Project: Cipher Intelligence Labs VSCode AI CodeGen
# Description: Sets up project structure and copies necessary files from VSCode fork
# Copyright © 2025 Cipher Intelligence Labs
#

# Stop on error
set -e

# Configuration
VSCODE_FORK_DIR="$1"
AI_PROJECT_DIR="$2"

# Check if arguments are provided
if [ -z "$VSCODE_FORK_DIR" ] || [ -z "$AI_PROJECT_DIR" ]; then
    echo "Usage: $0 <vscode-fork-directory> <ai-project-directory>"
    exit 1
fi

# Validate VSCode fork directory
if [ ! -d "$VSCODE_FORK_DIR" ]; then
    echo "Error: VSCode fork directory '$VSCODE_FORK_DIR' does not exist"
    exit 1
fi

# Create base project directory
echo "Creating project directory structure at $AI_PROJECT_DIR..."
mkdir -p "$AI_PROJECT_DIR"

# Create directory structure for AI components
mkdir -p "$AI_PROJECT_DIR/src/ai/config"
mkdir -p "$AI_PROJECT_DIR/src/ai/models"
mkdir -p "$AI_PROJECT_DIR/src/ai/apiConnector"
mkdir -p "$AI_PROJECT_DIR/src/ai/localLLM"
mkdir -p "$AI_PROJECT_DIR/src/ai/generator"
mkdir -p "$AI_PROJECT_DIR/src/ai/chat"
mkdir -p "$AI_PROJECT_DIR/src/ai/utils"
mkdir -p "$AI_PROJECT_DIR/src/ai/tests"

# Create directory structure for front-end components
mkdir -p "$AI_PROJECT_DIR/src/front/components"
mkdir -p "$AI_PROJECT_DIR/src/front/views"
mkdir -p "$AI_PROJECT_DIR/src/front/styles"

# Create directory structure for key VSCode components to retain
mkdir -p "$AI_PROJECT_DIR/src/vs/editor/browser"
mkdir -p "$AI_PROJECT_DIR/src/vs/editor/common"
mkdir -p "$AI_PROJECT_DIR/src/vs/editor/contrib"
mkdir -p "$AI_PROJECT_DIR/src/vs/workbench/api"
mkdir -p "$AI_PROJECT_DIR/src/vs/workbench/browser"
mkdir -p "$AI_PROJECT_DIR/src/vs/workbench/parts"
mkdir -p "$AI_PROJECT_DIR/src/vs/platform/node"
mkdir -p "$AI_PROJECT_DIR/src/vs/platform/browser"
mkdir -p "$AI_PROJECT_DIR/docs"

# Copy key VSCode files
echo "Copying VSCode core files..."

# Copy editor files
if [ -f "$VSCODE_FORK_DIR/src/vs/editor/editor.main.ts" ]; then
    cp "$VSCODE_FORK_DIR/src/vs/editor/editor.main.ts" "$AI_PROJECT_DIR/src/vs/editor/"
fi

if [ -f "$VSCODE_FORK_DIR/src/vs/editor/editor.api.ts" ]; then
    cp "$VSCODE_FORK_DIR/src/vs/editor/editor.api.ts" "$AI_PROJECT_DIR/src/vs/editor/"
fi

# Copy editor browser files
if [ -d "$VSCODE_FORK_DIR/src/vs/editor/browser" ]; then
    cp -r "$VSCODE_FORK_DIR/src/vs/editor/browser/"* "$AI_PROJECT_DIR/src/vs/editor/browser/"
fi

# Copy editor common files
if [ -d "$VSCODE_FORK_DIR/src/vs/editor/common" ]; then
    cp -r "$VSCODE_FORK_DIR/src/vs/editor/common/"* "$AI_PROJECT_DIR/src/vs/editor/common/"
fi

# Copy editor contrib files
if [ -d "$VSCODE_FORK_DIR/src/vs/editor/contrib" ]; then
    cp -r "$VSCODE_FORK_DIR/src/vs/editor/contrib/"* "$AI_PROJECT_DIR/src/vs/editor/contrib/"
fi

# Copy workbench files
if [ -d "$VSCODE_FORK_DIR/src/vs/workbench" ]; then
    cp -r "$VSCODE_FORK_DIR/src/vs/workbench/"* "$AI_PROJECT_DIR/src/vs/workbench/"
fi

# Copy platform files
if [ -d "$VSCODE_FORK_DIR/src/vs/platform" ]; then
    cp -r "$VSCODE_FORK_DIR/src/vs/platform/"* "$AI_PROJECT_DIR/src/vs/platform/"
fi

# Copy or create config files
echo "Creating configuration files..."
if [ -f "$VSCODE_FORK_DIR/package.json" ]; then
    cp "$VSCODE_FORK_DIR/package.json" "$AI_PROJECT_DIR/"
fi

if [ -f "$VSCODE_FORK_DIR/tsconfig.json" ]; then
    cp "$VSCODE_FORK_DIR/tsconfig.json" "$AI_PROJECT_DIR/"
fi

# Create additional necessary files
touch "$AI_PROJECT_DIR/electron-main.js"
touch "$AI_PROJECT_DIR/README.md"
touch "$AI_PROJECT_DIR/src/front/app.tsx"
touch "$AI_PROJECT_DIR/src/front/index.html"
touch "$AI_PROJECT_DIR/src/front/styles/main.css"
touch "$AI_PROJECT_DIR/docs/architecture.md"

# Create resources directory
mkdir -p "$AI_PROJECT_DIR/resources/app"
if [ -f "$VSCODE_FORK_DIR/resources/app/package.json" ]; then
    cp "$VSCODE_FORK_DIR/resources/app/package.json" "$AI_PROJECT_DIR/resources/app/"
fi

# Create extension integration point
mkdir -p "$AI_PROJECT_DIR/src/vs/extensions/ai-codegen"
touch "$AI_PROJECT_DIR/src/vs/extensions/ai-codegen/package.json"

echo "Project setup complete. Next steps:"
echo "1. Implement the AI code generator components"
echo "2. Integrate the AI components with the VSCode core"
echo "3. Test the integration"
echo "4. Build the application"

echo "Done!"
