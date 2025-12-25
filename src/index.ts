import { AssetsApiClient, AssetsPluginContext } from '@woodwing/assets-client-sdk';
import Sortable from 'sortablejs';
import './style.css';
import * as config from '../config.js';

const introDiv = document.getElementById('intro');
const assetsContainer = document.getElementById('assetsContainer');
const tableViewBtn = document.getElementById('tableViewBtn') as HTMLButtonElement;
const thumbnailViewBtn = document.getElementById('thumbnailViewBtn') as HTMLButtonElement;
const refreshBtn = document.getElementById('refreshBtn') as HTMLButtonElement;
const thumbnailSizeSlider = document.getElementById('thumbnailSizeSlider') as HTMLInputElement;

let apiClient: AssetsApiClient;
let contextService: AssetsPluginContext;
let viewMode: 'table' | 'thumbnails' = 'table';
let assets: any[] = [];
let sortableInstance: Sortable | null = null;
let currentParentUrl: string = '';
let thumbnailSize: number = 150;
let isEditMode: boolean = false;
let originalSortOrders: Map<string, number> = new Map();
let currentFolderPath: string = 'unknown';
let isResizing: boolean = false;
let currentResizeColumn: HTMLElement | null = null;
let startX: number = 0;
let startWidth: number = 0;
let columnWidths: Map<string, number> = new Map();

// Load saved column widths from localStorage
const savedColumnWidths = localStorage.getItem('sortassets_columnWidths');
if (savedColumnWidths) {
  try {
    const parsed = JSON.parse(savedColumnWidths);
    columnWidths = new Map(Object.entries(parsed));
  } catch (e) {
    console.error('Failed to parse saved column widths');
  }
}

// Load saved view mode from local storage
const savedViewMode = localStorage.getItem('sortassets_viewMode');
if (savedViewMode === 'table' || savedViewMode === 'thumbnails') {
  viewMode = savedViewMode;
}

// Load saved thumbnail size from local storage based on view mode
const storageKey = `sortassets_thumbnailSize_${viewMode}`;
const savedThumbnailSize = localStorage.getItem(storageKey);
if (savedThumbnailSize) {
  thumbnailSize = parseInt(savedThumbnailSize, 10);
  if (thumbnailSizeSlider) thumbnailSizeSlider.value = thumbnailSize.toString();
  // Apply saved size to CSS variable
  document.body.style.setProperty('--thumbnail-size', `${thumbnailSize}px`);
} else {
  // Set default and apply it
  document.body.style.setProperty('--thumbnail-size', `${thumbnailSize}px`);
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
  // Show loading message
  introDiv.innerHTML = '<span class="loading">Loading assets...</span>';
  assetsContainer.innerHTML = '<div class="loading">Loading...</div>';
  
  // Disable view toggle buttons during fetch
  tableViewBtn.disabled = true;
  thumbnailViewBtn.disabled = true;
  if (refreshBtn) refreshBtn.disabled = true;
  
  try {
    let folderSelection = contextService.context.activeTab.folderSelection;

    let folderPath = 'unknown';
      
      console.log('Folder selection from WoodWing:', folderSelection);
      console.log('Stored folder:', sessionStorage.getItem('sortassets_lastSelectedFolder'));
      
      // Check if a valid folder is selected (not empty or root)
      if (folderSelection && folderSelection.length > 0 && folderSelection[0].assetPath && folderSelection[0].assetPath !== '') {
        folderPath = folderSelection[0].assetPath;
        currentFolderPath = folderPath;
        // Store in session storage for future use
        sessionStorage.setItem('sortassets_lastSelectedFolder', folderPath);
        console.log('Saved folder to storage:', folderPath);
      } else {
        // Try to load from session storage
        const storedFolderPath = sessionStorage.getItem('sortassets_lastSelectedFolder');
        console.log('No valid folder selected, using stored folder:', storedFolderPath);
        if (storedFolderPath) {
          folderPath = storedFolderPath;
          currentFolderPath = folderPath;
        } else {
          introDiv.innerHTML = '<span class="error">No folder selected. Please select a folder in WoodWing Assets.</span>';
          // Re-enable buttons
          tableViewBtn.disabled = false;
          thumbnailViewBtn.disabled = false;
          if (refreshBtn) refreshBtn.disabled = false;
          return;
        }
      }
      
      // Query to get all assets in the folder, sorted by explicitSortOrder
      const query = `ancestorPaths:"${folderPath}" AND NOT assetType:collection`;
      const searchResponse = await apiClient.search({
        q: query,
        num: 100,
        sort: 'explicitSortOrder-asc,name',
        appendRequestSecret: true
      });
      
      assets = (searchResponse.hits || []);
    
    renderAssets();
    introDiv.innerHTML = `Sorting <b>${assets.length}</b> assets in folder ${folderPath}`;
  } catch (error: any) {
    let errorMessage = 'Error loading assets';
    
    // Try to extract detailed error message
    if (error?.data?.message) {
      errorMessage = error.data.message;
    } else if (error?.message) {
      errorMessage = error.message;
    }
    
    introDiv.innerHTML = `<span class="error">${errorMessage}</span>`;
    console.error('Error fetching assets:', error);
  } finally {
    // Re-enable view toggle buttons after fetch completes
    tableViewBtn.disabled = false;
    thumbnailViewBtn.disabled = false;
    if (refreshBtn) refreshBtn.disabled = false;
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

// Apply saved column widths to table
function applyColumnWidths() {
  const table = assetsContainer?.querySelector('.assets-table');
  if (!table) return;
  
  const headers = table.querySelectorAll('th[data-column]');
  headers.forEach((th: HTMLElement) => {
    const column = th.dataset.column;
    if (column && columnWidths.has(column)) {
      const width = columnWidths.get(column);
      th.style.width = `${width}px`;
      
      // Apply to all cells in this column
      const columnIndex = Array.from(th.parentElement.children).indexOf(th);
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cell = row.children[columnIndex] as HTMLElement;
        if (cell) cell.style.width = `${width}px`;
      });
    }
  });
}

// Initialize column resize functionality
function initializeColumnResize() {
  const table = assetsContainer?.querySelector('.assets-table');
  if (!table) return;
  
  const resizeHandles = table.querySelectorAll('.resize-handle');
  
  resizeHandles.forEach(handle => {
    handle.addEventListener('mousedown', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      
      const th = (e.target as HTMLElement).parentElement as HTMLElement;
      if (!th || !th.dataset.column) return;
      
      isResizing = true;
      currentResizeColumn = th;
      startX = e.pageX;
      startWidth = th.offsetWidth;
      
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    });
  });
  
  document.addEventListener('mousemove', (e: MouseEvent) => {
    if (!isResizing || !currentResizeColumn) return;
    
    const diff = e.pageX - startX;
    const newWidth = Math.max(50, startWidth + diff); // Minimum 50px
    
    currentResizeColumn.style.width = `${newWidth}px`;
    
    // Apply to all cells in this column
    const table = assetsContainer?.querySelector('.assets-table');
    if (table) {
      const columnIndex = Array.from(currentResizeColumn.parentElement.children).indexOf(currentResizeColumn);
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cell = row.children[columnIndex] as HTMLElement;
        if (cell) cell.style.width = `${newWidth}px`;
      });
    }
  });
  
  document.addEventListener('mouseup', () => {
    if (isResizing && currentResizeColumn) {
      // Save column width
      const column = currentResizeColumn.dataset.column;
      if (column) {
        const width = currentResizeColumn.offsetWidth;
        columnWidths.set(column, width);
        
        // Persist to localStorage
        const widthsObj = Object.fromEntries(columnWidths);
        localStorage.setItem('sortassets_columnWidths', JSON.stringify(widthsObj));
      }
    }
    
    isResizing = false;
    currentResizeColumn = null;
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
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
    let lastPart = col.includes('.') ? col.split('.').pop() : col;
    
    // Remove cf_ prefix if present
    if (lastPart.startsWith('cf_')) {
      lastPart = lastPart.substring(3);
    }
    
    const title = lastPart.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    
    // Add edit controls for explicitSortOrder column
    if (col === 'explicitSortOrder') {
      return `
        ${title}
        <button id="editBtn" class="header-icon-btn" title="Edit sort order" style="display: ${isEditMode ? 'none' : 'inline-flex'};">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button id="saveBtn" class="header-icon-btn save" title="Save changes" style="display: ${isEditMode ? 'inline-flex' : 'none'};">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
        <button id="cancelBtn" class="header-icon-btn cancel" title="Cancel" style="display: ${isEditMode ? 'inline-flex' : 'none'};">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
    }
    
    return title;
  };
  
  const html = `
    <table class="assets-table">
      <thead>
        <tr>
          <th></th>
          <th data-column="thumbnail">Thumbnail<span class="resize-handle"></span></th>
          ${columns.map(col => `<th data-column="${col}">${formatHeader(col)}<span class="resize-handle"></span></th>`).join('')}
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
            ${columns.map(col => {
              if (col === 'explicitSortOrder') {
                const value = getPropertyValue(asset, col);
                if (isEditMode) {
                  return `<td><input type="number" class="sort-order-input" data-asset-id="${asset.id}" data-original-value="${value}" value="${value}" min="1" /></td>`;
                } else {
                  return `<td>${value}</td>`;
                }
              } else {
                return `<td>${getPropertyValue(asset, col)}</td>`;
              }
            }).join('')}
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
  `;  assetsContainer.innerHTML = html;
  
  // Apply saved column widths
  applyColumnWidths();
  
  // Initialize resize handlers
  initializeColumnResize();
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
async function updateAssetSortOrder(assetId: string, sortOrder: number): Promise<string | null> {
  try {
    await apiClient.update(assetId, {
      metadata: JSON.stringify({
        explicitSortOrder: sortOrder
      })
    });
    return null; // Success
  } catch (error: any) {
    const errorMsg = error?.data?.message || error?.message || 'Unknown error';
    return `Asset ${assetId}: ${errorMsg}`;
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
      const updatePromises: Promise<string | null>[] = [];
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
      
      // Wait for all updates to complete and check for errors
      if (updatePromises.length > 0) {
        const results = await Promise.all(updatePromises);
        const errors = results.filter(r => r !== null);
        
        if (errors.length > 0) {
          introDiv.innerHTML = `<span class="error">Failed to update ${errors.length} asset(s):<br>${errors.join('<br>')}</span>`;
          console.error('Update errors:', errors);
        } else {
          introDiv.innerHTML = `Sorting <b>${assets.length}</b> assets - Sort order saved successfully`;
          // Reset to normal message after 3 seconds
          setTimeout(() => {
            if (introDiv.innerHTML.includes('Sort order saved')) {
              introDiv.innerHTML = `Sorting <b>${assets.length}</b> assets in folder ${currentFolderPath}`;
            }
          }, 3000);
        }
        
        // Update explicitSortOrder values in the HTML without full re-render
        if (viewMode === 'table') {
          // Update table rows
          const rows = document.querySelectorAll('#sortableList tr');
          rows.forEach((row, index) => {
            const asset = assets[index];
            if (asset && asset.metadata?.explicitSortOrder !== undefined) {
              const assetId = row.getAttribute('data-id');
              if (assetId === asset.id) {
                // Find the explicitSortOrder cell/input
                const input = row.querySelector('.sort-order-input') as HTMLInputElement;
                if (input) {
                  input.value = asset.metadata.explicitSortOrder.toString();
                  input.setAttribute('data-original-value', asset.metadata.explicitSortOrder.toString());
                } else {
                  // Find the cell containing explicitSortOrder (read-only mode)
                  const cells = row.querySelectorAll('td');
                  // Find which column is explicitSortOrder
                  const columnConfig = getColumnConfig();
                  const columns = Array.isArray(columnConfig) ? columnConfig : [];
                  const sortOrderIndex = columns.indexOf('explicitSortOrder');
                  if (sortOrderIndex !== -1) {
                    // +2 because of drag handle and preview columns
                    const cell = cells[sortOrderIndex + 2];
                    if (cell) {
                      cell.textContent = asset.metadata.explicitSortOrder.toString();
                    }
                  }
                }
              }
            }
          });
        } else {
          // Update thumbnail cards
          const cards = document.querySelectorAll('#sortableList .asset-card');
          cards.forEach((card, index) => {
            const asset = assets[index];
            if (asset && asset.metadata?.explicitSortOrder !== undefined) {
              const assetId = card.getAttribute('data-id');
              if (assetId === asset.id) {
                // Update the card info that might contain explicitSortOrder
                const infoDiv = card.querySelector('.asset-card-info');
                if (infoDiv) {
                  const columnConfig = getColumnConfig();
                  const columns = Array.isArray(columnConfig) ? columnConfig : [];
                  // Rebuild the info string
                  const getPropertyValue = (obj: any, path: string): string => {
                    const value = obj.metadata?.[path];
                    if (value === null || value === undefined) return '';
                    if (typeof value === 'object') return JSON.stringify(value);
                    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
                    return String(value);
                  };
                  infoDiv.textContent = columns.slice(1).map(col => getPropertyValue(asset, col)).filter(v => v).join(' • ');
                }
              }
            }
          });
        }
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
         'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIj48cmVjdCB3aWR0aD0iMTUwIiBoZWlnaHQ9IjE1MCIgZmlsbD0iI2YwZjBmMCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmb250LWZhbWlseT0iQXJpYWwiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiM5OTkiPk5vIFByZXZpZXc8L3RleHQ+PC9zdmc+';
}

const loadFolderInfo = async () => {
    
  // Fetch and display assets
  await fetchAssets();
};

// Toggle between table and thumbnail view
function toggleView(mode: 'table' | 'thumbnails') {
  viewMode = mode;
  
  // Save view mode preference
  localStorage.setItem('sortassets_viewMode', mode);
  
  // Load the appropriate thumbnail size for this view mode
  const storageKey = `sortassets_thumbnailSize_${mode}`;
  const savedSize = localStorage.getItem(storageKey);
  if (savedSize) {
    thumbnailSize = parseInt(savedSize, 10);
  } else {
    thumbnailSize = 150; // Default size
  }
  
  // Update slider and CSS variable
  if (thumbnailSizeSlider) thumbnailSizeSlider.value = thumbnailSize.toString();
  document.body.style.setProperty('--thumbnail-size', `${thumbnailSize}px`);
  
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

// Event listener for refresh button
if (refreshBtn) {
  refreshBtn.addEventListener('click', async () => {
    introDiv.innerHTML = '<span class="loading">Refreshing assets...</span>';
    await fetchAssets();
  });
}

// Event listeners for edit mode buttons
// Note: These buttons are now in the table header, so we need to use event delegation
document.addEventListener('click', (e) => {
  const target = e.target as HTMLElement;
  const button = target.closest('button');
  
  if (button?.id === 'editBtn') {
    isEditMode = true;
    
    // Store original values
    originalSortOrders.clear();
    assets.forEach(asset => {
      if (asset.metadata?.explicitSortOrder !== undefined) {
        originalSortOrders.set(asset.id, asset.metadata.explicitSortOrder);
      }
    });
    
    // Re-render to show inputs and update button visibility
    renderAssets();
  }
  
  if (button?.id === 'saveBtn') {
    (async () => {
      // Collect all changed values
      const sortOrderInputs = document.querySelectorAll('.sort-order-input') as NodeListOf<HTMLInputElement>;
      const updatePromises: Promise<string | null>[] = [];
      
      sortOrderInputs.forEach(input => {
        const assetId = input.getAttribute('data-asset-id');
        const originalValue = parseInt(input.getAttribute('data-original-value') || '0', 10);
        const newValue = parseInt(input.value, 10);
        
        if (assetId && !isNaN(newValue) && newValue > 0 && newValue !== originalValue) {
          // Update the asset in memory
          const asset = assets.find(a => a.id === assetId);
          if (asset) {
            asset.metadata = asset.metadata || {};
            asset.metadata.explicitSortOrder = newValue;
          }
          
          // Add to update queue
          updatePromises.push(updateAssetSortOrder(assetId, newValue));
        }
      });
      
      // Save all changes
      if (updatePromises.length > 0) {
        introDiv.innerHTML = '<span class="loading">Saving changes...</span>';
        const results = await Promise.all(updatePromises);
        const errors = results.filter(r => r !== null);
        
        if (errors.length > 0) {
          introDiv.innerHTML = `<span class="error">Failed to update ${errors.length} asset(s):<br>${errors.join('<br>')}</span>`;
        } else {
          introDiv.innerHTML = `Sorting <b>${assets.length}</b> assets - Changes saved successfully`;
          setTimeout(() => {
            if (introDiv.innerHTML.includes('Changes saved')) {
              introDiv.innerHTML = `Sorting <b>${assets.length}</b> assets in folder ${currentFolderPath}`;
            }
          }, 2000);
        }
      }
      
      // Exit edit mode
      isEditMode = false;
      originalSortOrders.clear();
      
      // Refresh the table to get latest data from server
      await fetchAssets();
    })();
  }
  
  if (button?.id === 'cancelBtn') {
    // Restore original values
    originalSortOrders.forEach((originalValue, assetId) => {
      const asset = assets.find(a => a.id === assetId);
      if (asset && asset.metadata) {
        asset.metadata.explicitSortOrder = originalValue;
      }
    });
    
    // Exit edit mode
    isEditMode = false;
    originalSortOrders.clear();
    
    // Re-render to show read-only values and update button visibility
    renderAssets();
  }
});

// Event listener for thumbnail size slider
if (thumbnailSizeSlider) {
  thumbnailSizeSlider.addEventListener('input', (e) => {
    const size = parseInt((e.target as HTMLInputElement).value, 10);
    thumbnailSize = size;
    
    // Update CSS variable
    document.body.style.setProperty('--thumbnail-size', `${size}px`);
    
    // Save preference for current view mode
    const storageKey = `sortassets_thumbnailSize_${viewMode}`;
    localStorage.setItem(storageKey, size.toString());
  });
}

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
    introDiv.innerHTML = '<span class="error">Please run this plugin from within Assets.</span>';
    assetsContainer.innerHTML = '';
    console.error('Plugin initialization error:', error);
  }
})();
