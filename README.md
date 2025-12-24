# SortAssets

A WoodWing Assets external plugin for bulk updating asset status in folders.

## Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server (http://localhost:4002)
npm run dev

# Build for production
npm run build
```

### Debugging
1. Run `npm run dev`
2. Open http://localhost:4002 in your browser
3. Press F12 (or Cmd+Option+I) to open DevTools
4. Check Console tab for errors and logs
5. Test in WoodWing Assets by setting the plugin URL to `http://localhost:4002`

### Deployment
```bash
# Deploy to GitHub Pages
npm run deploy:gh-pages

# Or deploy to Surge
npm run deploy:surge
```

Live URL: https://rbuikman.github.io/SortAssets/

## Configuration

Edit [config.js](config.js) to configure:
- `CLIENT_URL_WHITELIST`: Add your WoodWing Assets Server URL(s)
- `NEW_STATUS`: Configure available status options

## Setup in WoodWing Assets

1. Go to Management Console > Plugins > External Action plugins
2. Add a new plugin with:
   - **Name**: Set status to all files in folder
   - **URL**: https://rbuikman.github.io/SortAssets/ (or http://localhost:4002 for testing)
   - **Title**: Set status to all files in folder
   - **User interface**: Dialog
   - **Width**: 480
   - **Height**: 240
   - **Add location**: Toolbar, Folder context menu
