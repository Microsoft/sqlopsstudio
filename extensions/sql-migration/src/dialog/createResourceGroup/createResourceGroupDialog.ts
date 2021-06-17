/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import { azureResource } from 'azureResource';
import { EventEmitter } from 'events';
import { createResourceGroup, getResourceGroups } from '../../api/azure';
import * as constants from '../../constants/strings';

export class CreateResourceGroupDialog {
	private _dialogObject!: azdata.window.Dialog;
	private _view!: azdata.ModelView;
	private _creationEvent: EventEmitter = new EventEmitter;

	constructor(private _azureAccount: azdata.Account, private _subscription: azureResource.AzureResourceSubscription, private _location: string) {
		this._dialogObject = azdata.window.createModelViewDialog(
			'',
			'CreateResourceGroupDialog',
			360,
			'callout',
			'below',
			false,
			true,
			<azdata.window.IDialogProperties>{
				height: 20,
				width: 20,
				xPos: 0,
				yPos: 0
			}
		);
	}

	async initialize(): Promise<azureResource.AzureResourceResourceGroup> {
		let tab = azdata.window.createTab('');
		await tab.registerContent(async (view: azdata.ModelView) => {
			this._view = view;

			const resourceGroupDescription = view.modelBuilder.text().withProps({
				value: constants.RESOURCE_GROUP_DESCRIPTION,
				CSSStyles: {
					'font-size': '13px',
					'margin-bottom': '10px'
				}
			}).component();
			const nameLabel = view.modelBuilder.text().withProps({
				value: constants.NAME,
				CSSStyles: {
					'font-size': '13px',
					'font-weight': 'bold',
				}
			}).component();

			const resoruceGroupName = view.modelBuilder.inputBox().withValidation(c => {
				let valid = false;
				if (c.value!.length > 0 && c.value!.length <= 90 && /^[-\w\._\(\)]+$/.test(c.value!)) {
					valid = true;
				}
				okButton.enabled = valid;
				return valid;
			}).component();

			const okButton = view.modelBuilder.button().withProps({
				label: constants.OK,
				width: '80px',
				enabled: false
			}).component();

			okButton.onDidClick(async e => {
				okButton.enabled = false;
				cancelButton.enabled = false;
				loading.loading = true;
				try {
					const resourceGroup = await createResourceGroup(this._azureAccount, this._subscription, resoruceGroupName.value!, this._location);
					let isResourceGroupCreated = false;
					let i = 0;
					while (!isResourceGroupCreated && i < 5) {
						const resourceGroups = await getResourceGroups(this._azureAccount, this._subscription);
						isResourceGroupCreated = (resourceGroups.findIndex(r => r.name === resoruceGroupName.value!) !== -1);
						await new Promise(resolve => setTimeout(resolve, 1000));
						i++;
					}
					this._creationEvent.emit('done', resourceGroup);
				} catch (e) {
					vscode.window.showErrorMessage(e.toString());
					cancelButton.enabled = true;
					resoruceGroupName.validate();
				} finally {
					loading.loading = false;
				}
			});

			const cancelButton = view.modelBuilder.button().withProps({
				label: constants.CANCEL,
				width: '80px'
			}).component();

			cancelButton.onDidClick(e => {
				this._creationEvent.emit('done', undefined);
			});

			const loading = view.modelBuilder.loadingComponent().withProps({
				loading: false
			}).component();


			const buttonContainer = view.modelBuilder.flexContainer().withProps({
				CSSStyles: {
					'margin-top': '5px'
				}
			}).component();

			buttonContainer.addItem(okButton, {
				flex: '0',
				CSSStyles: {
					'width': '80px'
				}
			});

			buttonContainer.addItem(cancelButton, {
				flex: '0',
				CSSStyles: {
					'margin-left': '8px',
					'width': '80px'
				}
			});

			buttonContainer.addItem(loading, {
				flex: '0',
				CSSStyles: {
					'margin-left': '8px'
				}
			});

			const container = this._view.modelBuilder.flexContainer().withLayout({
				flexFlow: 'column'
			}).withItems([
				resourceGroupDescription,
				nameLabel,
				resoruceGroupName,
				buttonContainer
			]).component();

			const formBuilder = view.modelBuilder.formContainer().withFormItems(
				[
					{
						component: container
					}
				],
				{
					horizontal: false
				}
			);
			const form = formBuilder.withLayout({ width: '100%' }).withProps({
				CSSStyles: {
					'padding': '0px !important'
				}
			}).component();
			return view.initializeModel(form);
		});
		this._dialogObject.okButton.label = 'Apply';
		this._dialogObject.content = [tab];
		azdata.window.openDialog(this._dialogObject);
		return new Promise((resolve) => {
			this._creationEvent.once('done', async (resourceGroup: azureResource.AzureResourceResourceGroup) => {
				azdata.window.closeDialog(this._dialogObject);
				resolve(resourceGroup);
			});
		});
	}
}
