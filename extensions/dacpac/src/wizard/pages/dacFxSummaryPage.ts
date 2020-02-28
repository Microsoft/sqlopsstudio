/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as loc from '../../localizedConstants';
import { DacFxDataModel } from '../api/models';
import { DataTierApplicationWizard, Operation } from '../dataTierApplicationWizard';
import { BasePage } from '../api/basePage';

export class DacFxSummaryPage extends BasePage {

	protected readonly wizardPage: azdata.window.WizardPage;
	protected readonly instance: DataTierApplicationWizard;
	protected readonly model: DacFxDataModel;
	protected readonly view: azdata.ModelView;

	private form: azdata.FormContainer;
	private table: azdata.TableComponent;
	private loader: azdata.LoadingComponent;

	public constructor(instance: DataTierApplicationWizard, wizardPage: azdata.window.WizardPage, model: DacFxDataModel, view: azdata.ModelView) {
		super();
		this.instance = instance;
		this.wizardPage = wizardPage;
		this.model = model;
		this.view = view;
	}

	async start(): Promise<boolean> {
		this.table = this.view.modelBuilder.table().withProperties({
			title: loc.summaryTableTitle
		}).component();
		this.loader = this.view.modelBuilder.loadingComponent().withItem(this.table).component();
		this.form = this.view.modelBuilder.formContainer().withFormItems(
			[
				{
					component: this.table,
					title: ''
				}
			]
		).component();
		await this.view.initializeModel(this.form);
		return true;
	}

	async onPageEnter(): Promise<boolean> {
		this.populateTable();
		this.loader.loading = false;
		if (this.model.upgradeExisting && this.instance.selectedOperation === Operation.deploy) {
			this.instance.wizard.generateScriptButton.hidden = false;
		}

		this.instance.wizard.doneButton.focused = true;

		return true;
	}

	async onPageLeave(): Promise<boolean> {
		this.instance.wizard.generateScriptButton.hidden = true;
		return true;
	}

	public setupNavigationValidator(): void {
		this.instance.registerNavigationValidator(() => {
			if (this.loader.loading) {
				return false;
			}
			return true;
		});
	}

	private populateTable() {
		let data = [];
		let targetServer = loc.targetServer;
		let targetDatabase = loc.targetDatabase;
		let sourceServer = loc.sourceServer;
		let sourceDatabase = loc.sourceDatabase;
		let fileLocation = loc.fileLocation;

		switch (this.instance.selectedOperation) {
			case Operation.deploy: {
				data = [
					[targetServer, this.model.serverName],
					[fileLocation, this.model.filePath],
					[targetDatabase, this.model.database]];
				break;
			}
			case Operation.extract: {
				data = [
					[sourceServer, this.model.serverName],
					[sourceDatabase, this.model.database],
					[loc.version, this.model.version],
					[fileLocation, this.model.filePath]];
				break;
			}
			case Operation.import: {
				data = [
					[targetServer, this.model.serverName],
					[fileLocation, this.model.filePath],
					[targetDatabase, this.model.database]];
				break;
			}
			case Operation.export: {
				data = [
					[sourceServer, this.model.serverName],
					[sourceDatabase, this.model.database],
					[fileLocation, this.model.filePath]];
				break;
			}
			case Operation.generateDeployScript: {
				data = [
					[targetServer, this.model.serverName],
					[fileLocation, this.model.filePath],
					[targetDatabase, this.model.database]];
				break;
			}
		}

		this.table.updateProperties({
			data: data,
			columns: [
				{
					value: loc.setting,
					cssClass: 'align-with-header'
				},
				{
					value: loc.value,
					cssClass: 'align-with-header'
				}],
			width: 700,
			height: 200,
			moveFocusOutWithTab: true
		});
	}
}
