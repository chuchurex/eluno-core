#!/bin/bash

# Publish Workflow Script
# Automates: Build -> FTP Upload (Immediate) -> Git Push (Backup)

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}🚀 Starting IMMEDIATE publication process...${NC}"

# 1. Verification Build
echo -e "\n${YELLOW}🔨 Building project...${NC}"
npm run build

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed! Fix errors before publishing.${NC}"
    exit 1
fi

# 2. FTP Deployment (Immediate)
echo -e "\n${YELLOW}🔌 Deploying via FTP...${NC}"
node ../core/scripts/deploy.js

if [ $? -ne 0 ]; then
    echo -e "${RED}❌ FTP Deployment failed! Checking if git push is still needed...${NC}"
    # Ask user if they want to continue with git push? Or just exit?
    # For safety, let's exit, so they know something went wrong.
    exit 1
fi

# 3. Git Operations (Backup/History)
echo -e "\n${YELLOW}📦 Syncing with Git...${NC}"
git add .

if git diff-index --quiet HEAD --; then
    echo -e "${GREEN}✨ No changes to commit.${NC}"
    exit 0
fi

if [ -z "$1" ]; then
    MSG="content: update site $(date '+%Y-%m-%d %H:%M') [skip ci]"
else
    MSG="$1 [skip ci]"
fi

# Note: Added [skip ci] to commit message to prevent GitHub Action from triggering
# since we just deployed manually.

echo -e "${YELLOW}📝 Committing: '${MSG}'${NC}"
git commit -m "$MSG"

echo -e "\n${YELLOW}⬆️  Pushing to GitHub...${NC}"
git push origin main

echo -e "\n${GREEN}✅ ALL DONE! Site updated immediately and code backed up.${NC}"
