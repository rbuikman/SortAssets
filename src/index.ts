import { AssetsApiClient, AssetsPluginContext } from '@woodwing/assets-client-sdk';
import Sortable from 'sortablejs';
import './style.css';
import * as config from '../config.js';

const introDiv = document.getElementById('intro');
const assetsContainer = document.getElementById('assetsContainer');
const tableViewBtn = document.getElementById('tableViewBtn');
const thumbnailViewBtn = document.getElementById('thumbnailViewBtn');

let apiClient: AssetsApiClient;
let contextService: AssetsPluginContext;
let isDemoMode = false;
let viewMode: 'table' | 'thumbnails' = 'table';
let assets: any[] = [];
let sortableInstance: Sortable | null = null;
let currentParentUrl: string = '';

// Load saved view mode from session storage
const savedViewMode = sessionStorage.getItem('viewMode');
if (savedViewMode === 'table' || savedViewMode === 'thumbnails') {
  viewMode = savedViewMode;
}

// Get column configuration for the current URL
function getColumnConfig(): string | string[] {
  if (!config.COLUMN_CONFIG) {
    return '*'; // Default to all columns if no config
  }
  
  // Try to find exact match first
  if (currentParentUrl && config.COLUMN_CONFIG[currentParentUrl]) {
    return config.COLUMN_CONFIG[currentParentUrl];
  }
  
  // Fall back to default
  return config.COLUMN_CONFIG['default'] || '*';
}

// Fetch assets from the selected folder
async function fetchAssets() {
  try {
    let folderSelection;

    let folderPath = 'unknown';
    
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
      
      console.log('Folder selection from WoodWing:', folderSelection);
      console.log('Stored folder:', sessionStorage.getItem('lastSelectedFolder'));
      
      // Check if a valid folder is selected (not empty or root)
      if (folderSelection && folderSelection.length > 0 && folderSelection[0].assetPath && folderSelection[0].assetPath !== '') {
        folderPath = folderSelection[0].assetPath;
        // Store in session storage for future use
        sessionStorage.setItem('lastSelectedFolder', folderPath);
        console.log('Saved folder to storage:', folderPath);
      } else {
        // Try to load from session storage
        const storedFolderPath = sessionStorage.getItem('lastSelectedFolder');
        console.log('No valid folder selected, using stored folder:', storedFolderPath);
        if (storedFolderPath) {
          folderPath = storedFolderPath;
        } else {
          introDiv.innerHTML = '<span class="error">No folder selected. Please select a folder in WoodWing Assets.</span>';
          return;
        }
      }
      
      // Query to get all assets in the folder, sorted by explicitSortOrder
      const query = `ancestorPaths:"${folderPath}" AND NOT assetType:collection`;
      const searchResponse = await apiClient.search({
        q: query,
        num: 100,
        sort: 'explicitSortOrder asc,name asc',
        appendRequestSecret: true
      });
      
      assets = (searchResponse.hits || []);
    }
    
    renderAssets();
    introDiv.innerHTML = `Sorting <b>${assets.length}</b> assets in folder ${folderPath}`;
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
  if (assets.length === 0) {
    assetsContainer.innerHTML = '<div class="loading">No assets to display</div>';
    return;
  }
  
  // Get columns from config based on current URL
  let columns: string[];
  const columnConfig = getColumnConfig();
  
  if (columnConfig === '*') {
    // Get all properties from metadata only
    const firstAsset = assets[0];
    if (firstAsset.metadata) {
      columns = Object.keys(firstAsset.metadata).filter(key => 
        typeof firstAsset.metadata[key] !== 'object' ||
        firstAsset.metadata[key] === null
      );
    } else {
      columns = ['name'];
    }
  } else {
    columns = Array.isArray(columnConfig) ? columnConfig : ['name'];
  }
  
  // Helper to get nested property value from metadata
  const getPropertyValue = (obj: any, path: string): string => {
    // Always read from metadata
    const value = obj.metadata?.[path];
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };
  
  // Format column header (camelCase to Title Case)
  const formatHeader = (col: string): string => {
    const lastPart = col.includes('.') ? col.split('.').pop() : col;
    return lastPart.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };
  
  const html = `
    <table class="assets-table">
      <thead>
        <tr>
          <th></th>
          <th>Preview</th>
          ${columns.map(col => `<th>${formatHeader(col)}</th>`).join('')}
          <th></th>
        </tr>
      </thead>
      <tbody id="sortableList">
        ${assets.map(asset => `
          <tr data-id="${asset.id}">
            <td><span class="drag-handle">⋮⋮</span></td>
            <td>
              <img src="${getAssetPreview(asset)}" alt="${getAssetName(asset)}" class="asset-thumbnail" />
            </td>
            ${columns.map(col => `<td>${getPropertyValue(asset, col)}</td>`).join('')}
            <td>
              <a class="asset-link" target="_blank" href="${currentParentUrl}/app/#/search/id:${asset.id}/name-asc/" title="Open asset in new tab">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                  <polyline points="15 3 21 3 21 9"></polyline>
                  <line x1="10" y1="14" x2="21" y2="3"></line>
                </svg>
              </a>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  assetsContainer.innerHTML = html;
}

// Render thumbnail view
function renderThumbnailView() {
  if (assets.length === 0) {
    assetsContainer.innerHTML = '<div class="loading">No assets to display</div>';
    return;
  }
  
  // Get columns from config based on current URL
  let columns: string[];
  const columnConfig = getColumnConfig();
  
  if (columnConfig === '*') {
    // Get all properties from metadata only
    const firstAsset = assets[0];
    if (firstAsset.metadata) {
      columns = Object.keys(firstAsset.metadata).filter(key => 
        typeof firstAsset.metadata[key] !== 'object' ||
        firstAsset.metadata[key] === null
      );
    } else {
      columns = ['name'];
    }
  } else {
    columns = Array.isArray(columnConfig) ? columnConfig : ['name'];
  }
  
  // Helper to get property value from metadata
  const getPropertyValue = (obj: any, path: string): string => {
    const value = obj.metadata?.[path];
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  };
  
  const html = `
    <div class="assets-grid" id="sortableList">
      ${assets.map(asset => `
        <div class="asset-card" data-id="${asset.id}">
          <a class="asset-link-icon" target="_blank" href="${currentParentUrl}/app/#/search/id:${asset.id}/name-asc/" title="Open asset in new tab">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
          <img src="${getAssetPreview(asset)}" alt="${getAssetName(asset)}" class="asset-card-thumbnail" />
          <div class="asset-card-name" title="${columns.length > 0 ? getPropertyValue(asset, columns[0]) : getAssetName(asset)}">${columns.length > 0 ? getPropertyValue(asset, columns[0]) : getAssetName(asset)}</div>
          <div class="asset-card-info">
            ${columns.slice(1).map(col => getPropertyValue(asset, col)).filter(v => v).join(' • ')}
          </div>
        </div>
      `).join('')}
    </div>
  `;
  assetsContainer.innerHTML = html;
}

// Update asset sort order in WoodWing Assets
async function updateAssetSortOrder(assetId: string, sortOrder: number) {
  try {
    await apiClient.update(assetId, {
      metadata: {
        explicitSortOrder: sortOrder
      }
    });
  } catch (error) {
    console.error(`Failed to update sort order for asset ${assetId}:`, error);
  }
}

// Initialize SortableJS
function initializeSortable() {
  const sortableList = document.getElementById('sortableList');
  if (!sortableList) return;
  
  sortableInstance = new Sortable(sortableList, {
    animation: 150,
    handle: viewMode === 'table' ? 'tr' : '.asset-card',
    ghostClass: 'sortable-ghost',
    onEnd: async (evt) => {
      // Reorder assets array
      const item = assets.splice(evt.oldIndex!, 1)[0];
      assets.splice(evt.newIndex!, 0, item);
      
      // Update explicitSortOrder for all assets (starting from 1)
      const updatePromises: Promise<void>[] = [];
      assets.forEach((asset, index) => {
        const newSortOrder = index + 1;
        const currentSortOrder = asset.metadata?.explicitSortOrder;
        
        // Only update if the sort order has changed
        if (currentSortOrder !== newSortOrder) {
          asset.metadata = asset.metadata || {};
          asset.metadata.explicitSortOrder = newSortOrder;
          updatePromises.push(updateAssetSortOrder(asset.id, newSortOrder));
        }
      });
      
      // Wait for all updates to complete
      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
      }
    }
  });
}

// Helper functions to get asset properties from metadata
function getAssetName(asset: any): string {
  return asset.metadata?.name || 'Unnamed';
}

function getAssetPreview(asset: any): string {
  // Preview/thumbnail URLs are at the top level, not in metadata
  return asset.thumbnailUrl || 
         asset.previewUrl ||
         'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="150" height="150"%3E%3Crect width="150" height="150" fill="%23f0f0f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-size="14" fill="%23999"%3ENo Preview%3C/text%3E%3C/svg%3E';
}

const loadFolderInfo = async () => {
    
  // Fetch and display assets
  await fetchAssets();
};

// Toggle between table and thumbnail view
function toggleView(mode: 'table' | 'thumbnails') {
  viewMode = mode;
  
  // Save view mode preference
  sessionStorage.setItem('viewMode', mode);
  
  if (mode === 'table') {
    tableViewBtn.classList.add('active');
    thumbnailViewBtn.classList.remove('active');
  } else {
    thumbnailViewBtn.classList.add('active');
    tableViewBtn.classList.remove('active');
  }
  
  renderAssets();
}

// Apply saved view mode to UI on load
if (viewMode === 'thumbnails') {
  thumbnailViewBtn.classList.add('active');
  tableViewBtn.classList.remove('active');
} else {
  tableViewBtn.classList.add('active');
  thumbnailViewBtn.classList.remove('active');
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
    
    // Capture the parent URL for column configuration
    try {
      if (window.location.ancestorOrigins && window.location.ancestorOrigins.length > 0) {
        currentParentUrl = window.location.ancestorOrigins[0];
      }
    } catch (e) {
      // Cannot determine ancestor URL
    }
    
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
