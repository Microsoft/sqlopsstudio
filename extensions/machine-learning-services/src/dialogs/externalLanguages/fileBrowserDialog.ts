/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as constants from '../../common/constants';

export class FileBrowserDialog {

	private _selectedPathTextBox: azdata.InputBoxComponent | undefined;
	private _fileBrowserDialog: azdata.window.Dialog | undefined;
	private _fileBrowserTree: azdata.FileBrowserTreeComponent | undefined;

	private _onPathSelected: vscode.EventEmitter<string> = new vscode.EventEmitter<string>();
	public readonly onPathSelected: vscode.Event<string> = this._onPathSelected.event;

	constructor(private ownerUri: string) {
	}

	/**
	 * Opens a dialog to manage packages used by notebooks.
	 */
	public showDialog(): void {
		let fileBrowserTitle = '';
		this._fileBrowserDialog = azdata.window.createModelViewDialog(fileBrowserTitle);
		let fileBrowserTab = azdata.window.createTab(constants.extLangFileBrowserTabTitle);
		this._fileBrowserDialog.content = [fileBrowserTab];
		fileBrowserTab.registerContent(async (view) => {
			this._fileBrowserTree = view.modelBuilder.fileBrowserTree()
				.withProperties({ ownerUri: this.ownerUri, width: 420, height: 700 })
				.component();
			this._selectedPathTextBox = view.modelBuilder.inputBox()
				.withProperties({ inputType: 'text' })
				.component();
			this._fileBrowserTree.onDidChange((args) => {
				if (this._selectedPathTextBox) {
					this._selectedPathTextBox.value = args.fullPath;
				}
			});

			let fileBrowserContainer = view.modelBuilder.formContainer()
				.withFormItems([{
					component: this._fileBrowserTree,
					title: ''
				}, {
					component: this._selectedPathTextBox,
					title: constants.extLangSelectedPath
				}
				]).component();
			view.initializeModel(fileBrowserContainer);
		});
		this._fileBrowserDialog.okButton.onClick(() => {
			if (this._selectedPathTextBox) {
				let selectedPath = this._selectedPathTextBox.value || '';
				this._onPathSelected.fire(selectedPath);
			}
		});

		this._fileBrowserDialog.cancelButton.onClick(() => {
			this._onPathSelected.fire('');
		});
		this._fileBrowserDialog.okButton.label = constants.extLangOkButtonText;
		this._fileBrowserDialog.cancelButton.label = constants.extLangCancelButtonText;
		azdata.window.openDialog(this._fileBrowserDialog);
	}
}
