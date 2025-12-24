import { AssetsApiClient, AssetsPluginContext } from '@woodwing/assets-client-sdk';
import './style.css';
import * as config from '../config.js';

const folderDiv = document.getElementById('folderDiv');
const statusList = document.getElementById('status');
const statusLabel = document.getElementById('statusLabel');
const introDiv = document.getElementById('intro');

let apiClient: AssetsApiClient;
let contextService: AssetsPluginContext;
let isDemoMode = false;

const loadStatus = () => {
  console.log('loadStatus called, isDemoMode:', isDemoMode);
  let folderSelection;
  
  if (isDemoMode) {
    // Demo mode for standalone testing
    folderSelection = [{ name: 'Demo Folder', assetPath: '/demo/folder' }];
  } else {
    folderSelection = contextService.context.activeTab.folderSelection;
  }
  
  folderDiv.innerHTML = '<b>Folder</b>: ' + folderSelection[0].name;

  const newStatus:[] = config.NEW_STATUS;
  console.log('Status options:', newStatus);
  let htmlOption:string = '';
  newStatus.forEach( function (status) {
    htmlOption += '<option value="' + status +'">' + status + '</option>';
  });  
  statusList.innerHTML = htmlOption;
  statusLabel.innerHTML = '<b>Status</b>: ';
  console.log('Status dropdown populated with', newStatus.length, 'options');
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
  console.log('Plugin initialization started');
  try {
    console.log('Attempting to connect to Assets SDK...');
    
    // Add timeout to prevent hanging when not embedded in Assets
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Timeout: Not embedded in WoodWing Assets')), 2000)
    );
    
    contextService = await Promise.race([
      AssetsPluginContext.get(config.CLIENT_URL_WHITELIST),
      timeoutPromise
    ]) as AssetsPluginContext;
    
    console.log('Connected to Assets SDK successfully');
    apiClient = AssetsApiClient.fromPluginContext(contextService);
    document.getElementById('update').onclick = function() {onUpdate()};
    await loadStatus();
  } catch (error) {
    console.error('Error during initialization:', error);
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
