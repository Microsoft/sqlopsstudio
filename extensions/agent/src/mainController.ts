/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as nls from 'vscode-nls';
import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AlertDialog } from './dialogs/alertDialog';
import { JobDialog } from './dialogs/jobDialog';
import { OperatorDialog } from './dialogs/operatorDialog';
import { ProxyDialog } from './dialogs/proxyDialog';
import { JobStepDialog } from './dialogs/jobStepDialog';
import { PickScheduleDialog } from './dialogs/pickScheduleDialog';
import { JobData } from './data/jobData';
import { AgentUtils } from './agentUtils';
import { NotebookDialog, NotebookDialogOptions } from './dialogs/notebookDialog';
import { promisify } from 'util';
import { stringify } from 'querystring';

const localize = nls.loadMessageBundle();

/**
 * The main controller class that initializes the extension
 */
export class MainController {

	protected _context: vscode.ExtensionContext;
	private jobDialog: JobDialog;
	private jobStepDialog: JobStepDialog;
	private alertDialog: AlertDialog;
	private operatorDialog: OperatorDialog;
	private proxyDialog: ProxyDialog;
	private notebookDialog: NotebookDialog;

	// PUBLIC METHODS //////////////////////////////////////////////////////
	public constructor(context: vscode.ExtensionContext) {
		this._context = context;
	}

	public static showNotYetImplemented(): void {
		vscode.window.showInformationMessage(
			localize('mainController.notImplemented', "This feature is under development.  Check-out the latest insiders build if you'd like to try out the most recent changes!"));
	}

	/**
	 * Activates the extension
	 */
	public activate(): void {
		vscode.commands.registerCommand('agent.openJobDialog', async (ownerUri: string, jobInfo: azdata.AgentJobInfo) => {
			if (!this.jobDialog || (this.jobDialog && !this.jobDialog.isOpen)) {
				this.jobDialog = new JobDialog(ownerUri, jobInfo);
			}
			if (!this.jobDialog.isOpen) {
				this.jobDialog.dialogName ? await this.jobDialog.openDialog(this.jobDialog.dialogName) : await this.jobDialog.openDialog();
			}
		});
		vscode.commands.registerCommand('agent.openNewStepDialog', (ownerUri: string, server: string, jobInfo: azdata.AgentJobInfo, jobStepInfo: azdata.AgentJobStepInfo) => {
			AgentUtils.getAgentService().then(async (agentService) => {
				let jobData: JobData = new JobData(ownerUri, jobInfo, agentService);
				let dialog = new JobStepDialog(ownerUri, server, jobData, jobStepInfo, false);
				dialog.dialogName ? await dialog.openDialog(dialog.dialogName) : await dialog.openDialog();
			});
		});
		vscode.commands.registerCommand('agent.openPickScheduleDialog', async (ownerUri: string, jobName: string) => {
			let dialog = new PickScheduleDialog(ownerUri, jobName);
			await dialog.showDialog();
		});
		vscode.commands.registerCommand('agent.openAlertDialog', async (ownerUri: string, jobInfo: azdata.AgentJobInfo, alertInfo: azdata.AgentAlertInfo) => {
			if (!this.alertDialog || (this.alertDialog && !this.alertDialog.isOpen)) {
				await AgentUtils.getAgentService().then(async (agentService) => {
					let jobData: JobData = new JobData(ownerUri, jobInfo, agentService);
					this.alertDialog = new AlertDialog(ownerUri, jobData, alertInfo, false);
				});
			}
			if (!this.alertDialog.isOpen) {
				this.alertDialog.dialogName ? await this.alertDialog.openDialog(this.alertDialog.dialogName) : await this.alertDialog.openDialog();
			}
		});
		vscode.commands.registerCommand('agent.openOperatorDialog', async (ownerUri: string, operatorInfo: azdata.AgentOperatorInfo) => {
			if (!this.operatorDialog || (this.operatorDialog && !this.operatorDialog.isOpen)) {
				this.operatorDialog = new OperatorDialog(ownerUri, operatorInfo);
			}
			if (!this.operatorDialog.isOpen) {
				this.operatorDialog.dialogName ? await this.operatorDialog.openDialog(this.operatorDialog.dialogName) : await this.operatorDialog.openDialog();
			}
		});
		vscode.commands.registerCommand('agent.openProxyDialog', async (ownerUri: string, proxyInfo: azdata.AgentProxyInfo, credentials: azdata.CredentialInfo[]) => {
			if (!this.proxyDialog || (this.proxyDialog && !this.proxyDialog.isOpen)) {
				this.proxyDialog = new ProxyDialog(ownerUri, proxyInfo, credentials);
			}
			if (!this.proxyDialog.isOpen) {
				this.proxyDialog.dialogName ? await this.proxyDialog.openDialog(this.proxyDialog.dialogName) : await this.proxyDialog.openDialog();
			}
			this.proxyDialog.dialogName ? await this.proxyDialog.openDialog(this.proxyDialog.dialogName) : await this.proxyDialog.openDialog();
		});
		vscode.commands.registerCommand('agent.openNotebookEditorFromJsonString', async (filename: string, jsonNotebook: string) => {
			const tempfilePath = path.join(os.tmpdir(), filename + '.ipynb');

			if (await promisify(fs.exists)(tempfilePath)) {
				await promisify(fs.unlink)(tempfilePath);
			}
			try {
				await promisify(fs.writeFile)(tempfilePath, jsonNotebook);
				let uri = vscode.Uri.parse(`untitled:${path.basename(tempfilePath)}`);
				vscode.workspace.openTextDocument(tempfilePath).then((document) => {
					let initialContent = document.getText();
					azdata.nb.showNotebookDocument(uri, {
						preview: false,
						initialContent: initialContent,
						initialDirtyState: false
					});
				});
			}
			catch (e) {
				console.log(e);
			}
		});
		vscode.commands.registerCommand('agent.openNotebookDialog', async (ownerUri: any, notebookInfo: azdata.AgentNotebookInfo) => {

			/*
			There are four entry points to this commands:
			1. Explorer context menu:
				The first arg becomes a vscode URI
				the second argument is undefined
			2. Notebook toolbar:
				both the args are undefined
			3. Agent New Notebook Action
				the first arg is database OwnerUri
				the second arg is undefined
			4. Agent Edit Notebook Action
				the first arg is database OwnerUri
				the second arg is notebookInfo from database
			*/
			if (!ownerUri && !notebookInfo) {
				//notebook editor

				ownerUri = await this.getNotebookConnectionOwnerUri();
				if (!ownerUri) {
					return;
				}
				let currentNotebook = azdata.nb.activeNotebookEditor;
				let currentFilePath = currentNotebook.document.fileName;
				this.notebookDialog = new NotebookDialog(ownerUri, <NotebookDialogOptions>{ filePath: currentFilePath });
				await this.notebookDialog.openDialog();
			}
			else if (!(typeof ownerUri === 'string')) {
				let currentFilePath = ownerUri.fsPath;
				ownerUri = await this.getNotebookConnectionOwnerUri();
				if (!ownerUri) {
					return;
				}
				this.notebookDialog = new NotebookDialog(ownerUri, <NotebookDialogOptions>{ filePath: currentFilePath });
				await this.notebookDialog.openDialog();
			}
			else {
				if (!this.notebookDialog || (this.notebookDialog && !this.notebookDialog.isOpen)) {
					this.notebookDialog = new NotebookDialog(ownerUri, <NotebookDialogOptions>{ notebookInfo: notebookInfo });
				}
			}
			if (!this.notebookDialog.isOpen) {
				this.notebookDialog.dialogName ? await this.notebookDialog.openDialog(this.notebookDialog.dialogName) : await this.notebookDialog.openDialog();
			}
		});
	}

	public async getNotebookConnectionOwnerUri(): Promise<string> {
		let connections = await azdata.connection.getConnections(true);
		let sqlConnectionsPresent: boolean = false;
		if (!connections || connections.length === 0) {
			azdata.connection.openConnectionDialog();
			//vscode.window.showErrorMessage('No Active Connections');
			return;
		}
		for (let i = 0; i < connections.length; i++) {
			if (connections[i].providerId === 'MSSQL') {
				sqlConnectionsPresent = true;
				break;
			}
		}
		if (!sqlConnectionsPresent) {
			vscode.window.showErrorMessage('No Active Sql Connections');
			return;
		}
		let connectionNames: azdata.connection.ConnectionProfile[] = [];
		let connectionDisplayString: string[] = [];
		for (let i = 0; i < connections.length; i++) {
			let currentConnectionString = connections[i].serverName + ' (' + connections[i].userName + ')';
			connectionNames.push(connections[i]);
			connectionDisplayString.push(currentConnectionString);
		}
		let connectionName = await vscode.window.showQuickPick(connectionDisplayString, { placeHolder: 'Select a connection' });
		if (connectionDisplayString.indexOf(connectionName) !== -1) {
			let OwnerUri = await azdata.connection.getUriForConnection(connections[connectionDisplayString.indexOf(connectionName)].connectionId);
			return OwnerUri;
		}
		else {
			vscode.window.showErrorMessage('Please select a valid connection');
		}

	}

	/**
	 * Deactivates the extension
	 */
	public deactivate(): void {
	}
}
