#!/bin/bash

# Build and deploy to GitHub Pages
echo "Building and deploying to GitHub Pages..."
npm run deploy:gh-pages

if [ $? -eq 0 ]; then
    echo "✅ Successfully deployed to GitHub Pages!"
    echo "URL: https://rbuikman.github.io/SortAssets/"
else
    echo "❌ Deployment failed!"
    exit 1
fi
