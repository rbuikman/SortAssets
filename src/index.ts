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
  console.log('=== Plugin initialization started ===');
  console.log('Window location:', window.location.href);
  console.log('Parent origin:', window.parent?.location?.origin || 'Cannot access parent origin');
  console.log('Ancestor origins:', window.location.ancestorOrigins);
  console.log('Is in iframe:', window.self !== window.top);
  console.log('Configured whitelist:', config.CLIENT_URL_WHITELIST);
  
  try {
    console.log('Attempting to connect to Assets SDK...');
    console.log('Starting AssetsPluginContext.get() with timeout of 5 seconds');
    
    // Increase timeout and add more logging
    const timeoutPromise = new Promise((_, reject) => {
      const timeoutId = setTimeout(() => {
        console.error('TIMEOUT: AssetsPluginContext.get() did not respond within 5 seconds');
        console.log('This usually means:');
        console.log('1. Plugin is not embedded in WoodWing Assets iframe');
        console.log('2. WoodWing Assets is not sending the context message');
        console.log('3. There is a communication issue between iframe and parent');
        reject(new Error('Timeout: Not embedded in WoodWing Assets'));
      }, 5000);
      
      // Log that timeout is set
      console.log('Timeout set:', timeoutId);
    });
    
    console.log('Calling AssetsPluginContext.get()...');
    const contextPromise = AssetsPluginContext.get(config.CLIENT_URL_WHITELIST);
    console.log('AssetsPluginContext.get() called, promise created');
    
    contextService = await Promise.race([
      contextPromise,
      timeoutPromise
    ]) as AssetsPluginContext;
    
    console.log('✓ Connected to Assets SDK successfully!');
    console.log('Context received:', contextService);
    console.log('Context data:', contextService?.context);
    
    apiClient = AssetsApiClient.fromPluginContext(contextService);
    console.log('API Client created:', apiClient);
    
    document.getElementById('update').onclick = function() {onUpdate()};
    await loadStatus();
    console.log('=== Plugin initialization complete ===');
  } catch (error) {
    console.error('=== Error during initialization ===');
    console.error('Error object:', error);
    console.error('Error message:', error?.message);
    console.error('Error stack:', error?.stack);
    
    // Check if it's a whitelist error
    const currentUrl = window.location.ancestorOrigins?.[0] || window.parent?.location?.origin || 'unknown';
    const errorMessage = error?.message || error?.toString() || 'Unknown error';
    
    console.log('Current URL for whitelist check:', currentUrl);
    console.log('Error message content:', errorMessage);
    
    if (errorMessage.includes('whitelist') || errorMessage.includes('not allowed') || errorMessage.includes('origin')) {
      // Whitelist configuration error
      isDemoMode = true;
      console.error('>>> WHITELIST ERROR DETECTED <<<');
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
      console.log('>>> RUNNING IN DEMO MODE <<<');
      console.log('Running in demo mode - not connected to WoodWing Assets');
      console.log('Error:', error);
      introDiv.innerHTML = '<strong>Demo Mode</strong><br>This plugin must be embedded in WoodWing Assets to work properly. Currently showing demo data.';
      document.getElementById('update').onclick = function() {onUpdate()};
      loadStatus();
    }
  }
})();
