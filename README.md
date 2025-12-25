# SortAssets

A WoodWing Assets external plugin for sorting assets

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

### Deployment
```bash
# Deploy
Host this plugin as a static website somewhere

For example:
Live URL: https://rbuikman.github.io/SortAssets/

## Configuration

Edit [config.js](config.js) to configure:
- `CLIENT_URL_WHITELIST`: Add your WoodWing Assets Server URL(s)

## Setup in WoodWing Assets

1. Go to Management Console > Plugins > External Action plugins
2. Add a new plugin with:
   - **Name**: Sort Assets in Folder
   - **URL**: https://rbuikman.github.io/SortAssets/
   - **Title**: Sort Assets in Folder
   - **User interface**: Tab
   - **Add location**: Toolbar, Folder context menu
