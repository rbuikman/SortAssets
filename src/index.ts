import { AssetsApiClient, AssetsPluginContext } from '@woodwing/assets-client-sdk';
import Sortable from 'sortablejs';
import './style.css';
import * as config from '../config.js';

const folderDiv = document.getElementById('folderDiv');
const introDiv = document.getElementById('intro');
const folderPathSpan = document.getElementById('folderPath');
const assetsContainer = document.getElementById('assetsContainer');
const tableViewBtn = document.getElementById('tableViewBtn');
const thumbnailViewBtn = document.getElementById('thumbnailViewBtn');

let apiClient: AssetsApiClient;
let contextService: AssetsPluginContext;
let isDemoMode = false;
let viewMode: 'table' | 'thumbnails' = 'table';
let assets: any[] = [];
let sortableInstance: Sortable | null = null;

// Fetch assets from the selected folder
async function fetchAssets() {
  try {
    let folderSelection;
    
    if (isDemoMode) {
      // Demo data
      assets = [
        { id: '1', name: 'Demo Image 1.jpg', previewUrl: 'https://via.placeholder.com/150', status: 'Active', fileSize: '2.5 MB' },
        { id: '2', name: 'Demo Image 2.jpg', previewUrl: 'https://via.placeholder.com/150', status: 'Active', fileSize: '1.8 MB' },
        { id: '3', name: 'Demo Image 3.jpg', previewUrl: 'https://via.placeholder.com/150', status: 'Draft', fileSize: '3.2 MB' },
        { id: '4', name: 'Demo Document.pdf', previewUrl: 'https://via.placeholder.com/150', status: 'Active', fileSize: '850 KB' },
      ];
    } else {
      folderSelection = contextService.context.activeTab.folderSelection;
      const folderPath = folderSelection[0].assetPath;
      
      // Query to get all assets in the folder
      const query = `ancestorPaths:"${folderPath}"`;
      const searchResponse = await apiClient.search({
        q: query,
        num: 100,
        sort: 'name'
      });
      
      assets = searchResponse.hits || [];
    }
    
    renderAssets();
    introDiv.innerHTML = `<b>${assets.length}</b> assets in folder`;
  } catch (error) {
    introDiv.innerHTML = '<span class="error">Error loading assets</span>';
  }
}

// Render assets based on current view mode
function renderAssets() {
  if (!assetsContainer) return;
  
  // Destroy existing sortable instance
  if (sortableInstance) {
    sortableInstance.destroy();
    sortableInstance = null;
  }
  
  if (viewMode === 'table') {
    renderTableView();
  } else {
    renderThumbnailView();
  }
  
  initializeSortable();
}

// Render table view
function renderTableView() {
  const html = `
    <table class="assets-table">
      <thead>
        <tr>
          <th></th>
          <th>Preview</th>
          <th>Name</th>
          <th>Status</th>
          <th>Size</th>
        </tr>
      </thead>
      <tbody id="sortableList">
        ${assets.map(asset => `
          <tr data-id="${asset.id}">
            <td><span class="drag-handle">⋮⋮</span></td>
            <td>
              <img src="${getAssetPreview(asset)}" alt="${getAssetName(asset)}" class="asset-thumbnail" />
            </td>
            <td>${getAssetName(asset)}</td>
            <td>${getAssetStatus(asset)}</td>
            <td>${getAssetSize(asset)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  assetsContainer.innerHTML = html;
}

// Render thumbnail view
function renderThumbnailView() {
  const html = `
    <div class="assets-grid" id="sortableList">
      ${assets.map(asset => `
        <div class="asset-card" data-id="${asset.id}">
          <img src="${getAssetPreview(asset)}" alt="${getAssetName(asset)}" class="asset-card-thumbnail" />
          <div class="asset-card-name">${getAssetName(asset)}</div>
          <div class="asset-card-info">
            ${getAssetStatus(asset)} • ${getAssetSize(asset)}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  assetsContainer.innerHTML = html;
}

// Initialize SortableJS
function initializeSortable() {
  const sortableList = document.getElementById('sortableList');
  if (!sortableList) return;
  
  sortableInstance = new Sortable(sortableList, {
    animation: 150,
    handle: viewMode === 'table' ? '.drag-handle' : '.asset-card',
    ghostClass: 'sortable-ghost',
    onEnd: (evt) => {
      // Reorder assets array
      const item = assets.splice(evt.oldIndex!, 1)[0];
      assets.splice(evt.newIndex!, 0, item);
    }
  });
}

// Helper functions to get asset properties
function getAssetName(asset: any): string {
  return asset.name || asset.metadata?.name || 'Unnamed';
}

function getAssetPreview(asset: any): string {
  return asset.previewUrl || asset.thumbnailUrl || asset.metadata?.previewUrl || 'https://via.placeholder.com/150?text=No+Preview';
}

function getAssetStatus(asset: any): string {
  return asset.status || asset.metadata?.status || 'Unknown';
}

function getAssetSize(asset: any): string {
  if (asset.fileSize) return asset.fileSize;
  const bytes = asset.metadata?.fileSize || 0;
  if (bytes === 0) return 'Unknown';
  const kb = bytes / 1024;
  const mb = kb / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
}

const loadFolderInfo = async () => {
  let folderSelection;
  
  if (isDemoMode) {
    // Demo mode for standalone testing
    folderSelection = [{ name: 'Demo Folder', assetPath: '/demo/folder' }];
  } else {
    folderSelection = contextService.context.activeTab.folderSelection;
  }
  
  const folderName = folderSelection[0].name;
  folderDiv.innerHTML = '<b>Folder</b>: ' + folderName;
  folderPathSpan.innerHTML = folderName;
  
  // Fetch and display assets
  await fetchAssets();
};

// Toggle between table and thumbnail view
function toggleView(mode: 'table' | 'thumbnails') {
  viewMode = mode;
  
  if (mode === 'table') {
    tableViewBtn.classList.add('active');
    thumbnailViewBtn.classList.remove('active');
  } else {
    thumbnailViewBtn.classList.add('active');
    tableViewBtn.classList.remove('active');
  }
  
  renderAssets();
}

// Event listeners for view toggle buttons
tableViewBtn.addEventListener('click', () => toggleView('table'));
thumbnailViewBtn.addEventListener('click', () => toggleView('thumbnails'));

(async () => {
  try {
    // Timeout for Assets SDK connection
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error('Timeout: Not embedded in WoodWing Assets'));
      }, 5000);
    });
    
    const contextPromise = AssetsPluginContext.get(config.CLIENT_URL_WHITELIST);
    
    contextService = await Promise.race([
      contextPromise,
      timeoutPromise
    ]) as AssetsPluginContext;
    
    apiClient = AssetsApiClient.fromPluginContext(contextService);
    
    await loadFolderInfo();
  } catch (error) {
    // Safe way to get current URL
    let ancestorUrl = 'unknown';
    let isInIframe = window.self !== window.top;
    
    try {
      if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
        ancestorUrl = window.location.ancestorOrigins[0];
      }
    } catch (e) {
      // Cannot determine ancestor URL
    }
    
    // Check if we're embedded in WoodWing Assets but connection failed
    if (isInIframe && ancestorUrl !== 'unknown') {
      // We're in an iframe with a known parent URL - this is likely a whitelist issue
      isDemoMode = true;
      
      introDiv.innerHTML = `
        <strong style="color: red;">Configuration Error</strong><br>
        <p>The plugin cannot connect to WoodWing Assets.</p>
        <p><strong>Parent URL:</strong> <code>${ancestorUrl}</code></p>
        <p>Please add this URL to the <code>CLIENT_URL_WHITELIST</code> in <code>config.js</code></p>
        <p><small>Current whitelist: ${JSON.stringify(config.CLIENT_URL_WHITELIST)}</small></p>
        <p><small>See browser console for more details.</small></p>
      `;
      await loadFolderInfo();
    } else {
      // Running in standalone mode (not embedded in WoodWing Assets)
      isDemoMode = true;
      introDiv.innerHTML = '<strong>Demo Mode</strong><br>This plugin must be embedded in WoodWing Assets to work properly. Currently showing demo data.';
      await loadFolderInfo();
    }
  }
})();
