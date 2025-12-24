import { AssetsApiClient, AssetsPluginContext } from '@woodwing/assets-client-sdk';
import './style.css';
import * as config from '../config.js';

const folderDiv = document.getElementById('folderDiv');
const statusDiv = document.getElementById('statusDiv');
const statusList = document.getElementById('status');

let apiClient: AssetsApiClient;
let contextService: AssetsPluginContext;

const loadStatus = () => {
  const folderSelection = contextService.context.activeTab.folderSelection;
  folderDiv.innerHTML = '<b>Folder</b>: ' + folderSelection[0].name;

  const newStatus:[] = config.NEW_STATUS;
  let htmlOption:string = '';
  newStatus.forEach( function (status) {
    htmlOption += '<option value="' + status +'">' + status + '</option>';
  });  
  statusList.innerHTML = htmlOption;
  statusList.hidden = false;
  statusDiv.innerHTML = '<b>Status</b>: ' + statusDiv.innerHTML;
};

async function onUpdate() {
  const folderSelection = contextService.context.activeTab.folderSelection;
  const status = (<HTMLSelectElement>document.getElementById('status')).value;
  const query = 'ancestorPaths:"' + folderSelection[0].assetPath + '" -status:"' + status + '"';
  const metadata = { 'status': status };

  await apiClient.updatebulk(query, metadata);
  contextService.close();
}

(async () => {
  contextService = await AssetsPluginContext.get(config.CLIENT_URL_WHITELIST);
  apiClient = AssetsApiClient.fromPluginContext(contextService);
  apiClient = apiClient;
  document.getElementById('update').onclick = function() {onUpdate()};
  await loadStatus();
  document.getElementById("update").hidden = false;
})();
