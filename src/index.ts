import { AssetsApiClient, AssetsPluginContext } from '@woodwing/assets-client-sdk';
import './style.css';
import * as config from '../config.js';

const folderDiv = document.getElementById('folderDiv');
const statusDiv = document.getElementById('statusDiv');
const statusList = document.getElementById('status');
const introDiv = document.getElementById('intro');

let apiClient: AssetsApiClient;
let contextService: AssetsPluginContext;
let isDemoMode = false;

const loadStatus = () => {
  let folderSelection;
  
  if (isDemoMode) {
    // Demo mode for standalone testing
    folderSelection = [{ name: 'Demo Folder', assetPath: '/demo/folder' }];
  } else {
    folderSelection = contextService.context.activeTab.folderSelection;
  }
  
  folderDiv.innerHTML = '<b>Folder</b>: ' + folderSelection[0].name;

  const newStatus:[] = config.NEW_STATUS;
  let htmlOption:string = '';
  newStatus.forEach( function (status) {
    htmlOption += '<option value="' + status +'">' + status + '</option>';
  });  
  statusList.innerHTML = htmlOption;
  statusDiv.innerHTML = '<b>Status</b>: ' + statusDiv.innerHTML;
};

async function onUpdate() {
  if (isDemoMode) {
    alert('Demo mode: This would update assets in the selected folder with the chosen status.');
    return;
  }
  
  const folderSelection = contextService.context.activeTab.folderSelection;
  const status = (<HTMLSelectElement>document.getElementById('status')).value;
  const query = 'ancestorPaths:"' + folderSelection[0].assetPath + '" -status:"' + status + '"';
  const metadata = { 'status': status };

  await apiClient.updatebulk(query, metadata);
  contextService.close();
}

(async () => {
  try {
    contextService = await AssetsPluginContext.get(config.CLIENT_URL_WHITELIST);
    apiClient = AssetsApiClient.fromPluginContext(contextService);
    document.getElementById('update').onclick = function() {onUpdate()};
    await loadStatus();
  } catch (error) {
    // Check if it's a whitelist error
    const currentUrl = window.location.ancestorOrigins?.[0] || window.parent?.location?.origin || 'unknown';
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    if (errorMessage.includes('whitelist') || errorMessage.includes('not allowed') || errorMessage.includes('origin')) {
      // Whitelist configuration error
      isDemoMode = true;
      console.error('Whitelist error:', error);
      console.log('Current parent URL:', currentUrl);
      console.log('Configured whitelist:', config.CLIENT_URL_WHITELIST);
      
      introDiv.innerHTML = `
        <strong style="color: red;">Configuration Error</strong><br>
        <p>The plugin cannot connect to WoodWing Assets.</p>
        <p><strong>Parent URL:</strong> ${currentUrl}</p>
        <p>Please add this URL to the <code>CLIENT_URL_WHITELIST</code> in config.js</p>
        <p><small>See browser console for more details.</small></p>
      `;
      document.getElementById('update').onclick = function() {
        alert('Cannot update: Plugin not connected to WoodWing Assets.\n\nParent URL: ' + currentUrl + '\n\nAdd this URL to CLIENT_URL_WHITELIST in config.js');
      };
      loadStatus();
    } else {
      // Running in standalone mode (not embedded in WoodWing Assets)
      isDemoMode = true;
      console.log('Running in demo mode - not connected to WoodWing Assets');
      console.log('Error:', error);
      introDiv.innerHTML = '<strong>Demo Mode</strong><br>This plugin must be embedded in WoodWing Assets to work properly. Currently showing demo data.';
      document.getElementById('update').onclick = function() {onUpdate()};
      loadStatus();
    }
  }
})();
