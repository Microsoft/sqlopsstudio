/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdata from 'azdata';
import * as vscode from 'vscode';
import * as path from 'path';
import { MigrationLocalStorage } from '../models/migrationLocalStorage';
import * as loc from '../models/strings';
import { MigrationStatusDialog } from '../dialog/migrationStatusDialog';

interface IActionMetadata {
	title?: string,
	description?: string,
	link?: string,
	iconPath?: { light: string | vscode.Uri; dark: string | vscode.Uri },
	command?: string;
}

const maxWidth = 800;

export class DashboardWidget {

	private _migrationStatusCardsContainer!: azdata.FlexContainer;
	private _view!: azdata.ModelView;
	/**
	 * Creates new instance of dashboard
	 */
	constructor(private _root: string) {
	}

	public register(): Promise<void> {
		//Migrations.clearMigrations();
		return new Promise<void>(resolve => {
			azdata.ui.registerModelViewProvider('migration.dashboard', async (view) => {
				this._view = view;
				const container = view.modelBuilder.flexContainer().withLayout({
					flexFlow: 'column',
					width: '100%',
					height: '100%'
				}).component();
				const header = this.createHeader(view);

				const tasksContainer = await this.createTasks(view);

				container.addItem(header, {
					CSSStyles: {
						'background-image': `url(${vscode.Uri.file(this.asAbsolutePath('images/background.svg'))})`,
						'width': `1100px`,
						'height': '300px',
						'background-size': '100%',
					}
				});
				header.addItem(tasksContainer, {
					CSSStyles: {
						'width': `${maxWidth}px`,
						'height': '150px',
					}
				});

				header.addItem(await this.createFooter(view), {
					CSSStyles: {
						'margin-top': '20px'
					}
				});

				const mainContainer = view.modelBuilder.flexContainer()
					.withLayout({
						flexFlow: 'column',
						width: '100%',
						height: '100%',
						position: 'absolute'
					}).component();
				mainContainer.addItem(container, {
					CSSStyles: { 'padding-top': '25px', 'padding-left': '5px' }
				});
				await view.initializeModel(mainContainer);

				this.refreshMigrations();
				resolve();
			});
		});
	}

	private createHeader(view: azdata.ModelView): azdata.FlexContainer {
		const header = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
		}).component();
		const titleComponent = view.modelBuilder.text().withProperties({
			value: loc.DASHBOARD_TITLE,
			CSSStyles: {
				'font-size': '36px',
				'font-family': 'Segoe UI'
			}
		}).component();
		const descComponent = view.modelBuilder.text().withProperties({
			value: loc.DASHBOARD_DESCRIPTION,
			CSSStyles: {
				'font-size': '12px',
			}
		}).component();
		header.addItems([titleComponent, descComponent], {
			CSSStyles: {
				'width': `${maxWidth}px`,
				'padding-left': '20px'
			}
		});

		return header;
	}

	private asAbsolutePath(filePath: string): string {
		return path.join(this._root || '', filePath);
	}

	private async createTasks(view: azdata.ModelView): Promise<azdata.Component> {
		const tasksContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: '100%',
			height: '50px',
		}).component();

		const migrateButtonMetadata: IActionMetadata = {
			title: loc.DASHBOARD_MIGRATE_TASK_BUTTON_TITLE,
			description: loc.DASHBOARD_MIGRATE_TASK_BUTTON_DESCRIPTION,
			iconPath: {
				dark: this.asAbsolutePath('images/migration.svg'),
				light: this.asAbsolutePath('images/migration.svg'),
			},
			command: 'sqlmigration.start'
		};
		const migrateButton = this.createTaskButton(view, migrateButtonMetadata);

		const preRequisiteListHTMLTemplate =
			`
			<span style="font-size: 14px;">Things you need before starting migration:</span><br>
			<ul style="padding:0 0 0 10px;font-size:12px;">
			<li>Azure account details</li>
			<li>Azure SQL Managed Instance or SQL Server on Azure Virtual Machine</li>
			<li>Backup location details</li>
			</ul>
			`;

		const preRequisiteListElement = view.modelBuilder.dom().withProps({
			html: preRequisiteListHTMLTemplate
		}).component();

		const preRequisiteLearnMoreLink = view.modelBuilder.hyperlink().withProps({
			label: loc.LEARN_MORE,
			url: '',
			CSSStyles: {
				'padding-left': '10px'
			}
		}).component();

		const preReqContainer = view.modelBuilder.flexContainer().withItems([
			preRequisiteListElement
		]).withLayout({
			flexFlow: 'column'
		}).component();

		preReqContainer.addItem(preRequisiteLearnMoreLink, {
			CSSStyles: {
				'padding-left': '10px'
			}
		});


		tasksContainer.addItem(migrateButton, {
			CSSStyles: {
				'margin-top': '20px',
				'padding': '10px'
			}
		});
		tasksContainer.addItems([preReqContainer], {
			CSSStyles: {
				'padding': '10px'
			}
		});

		return tasksContainer;
	}

	private createTaskButton(view: azdata.ModelView, taskMetaData: IActionMetadata): azdata.Component {
		const maxHeight: number = 84;
		const maxWidth: number = 236;
		const buttonContainer = view.modelBuilder.button().withProperties<azdata.ButtonProperties>({
			buttonType: azdata.ButtonType.Informational,
			description: taskMetaData.description,
			height: maxHeight,
			iconHeight: 32,
			iconPath: taskMetaData.iconPath,
			iconWidth: 32,
			label: taskMetaData.title,
			title: taskMetaData.title,
			width: maxWidth,
		}).component();
		buttonContainer.onDidClick(async () => {
			if (buttonContainer.enabled && taskMetaData.command) {
				await vscode.commands.executeCommand(taskMetaData.command);
			}
		});
		return view.modelBuilder.divContainer().withItems([buttonContainer]).component();
	}

	private async refreshMigrations(): Promise<void> {
		this._migrationStatusCardsContainer.clearItems();
		const currentConnection = (await azdata.connection.getCurrentConnection());
		const getMigrations = MigrationLocalStorage.getMigrations(currentConnection);
		getMigrations.forEach((migration) => {
			const button = this._view.modelBuilder.button().withProps({
				label: `Migration to ${migration.targetManagedInstance.name} using controller ${migration.migrationContext.name}`
			}).component();

			button.onDidClick(async (e) => {
				await new MigrationStatusDialog(migration).initialize();
			});
			this._migrationStatusCardsContainer.addItem(
				button
			);
		});
	}

	private async createFooter(view: azdata.ModelView): Promise<azdata.Component> {
		const footerContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth,
			height: '500px',
			justifyContent: 'flex-start'
		}).component();
		const statusContainer = await this.createMigrationStatusContainer(view);
		const videoLinksContainer = this.createVideoLinks(view);
		footerContainer.addItem(statusContainer);
		footerContainer.addItem(videoLinksContainer, {
			CSSStyles: {
				'padding-left': '10px',
			}
		});

		return footerContainer;
	}

	private async createMigrationStatusContainer(view: azdata.ModelView): Promise<azdata.FlexContainer> {
		const statusContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '400px',
			height: '250px',
			justifyContent: 'flex-start',
		}).withProps({
			CSSStyles: {
				'border': '1px solid rgba(0, 0, 0, 0.1)',
				'padding': '15px'
			}
		}).component();

		const statusContainerTitle = view.modelBuilder.text().withProps({
			value: loc.DATABASE_MIGRATION_STATUS,
			CSSStyles: {
				'font-size': '18px',
				'font-weight': 'bold',
				'margin': '0px',
				'width': '290px'
			}
		}).component();

		const viewAllButton = view.modelBuilder.hyperlink().withProps({
			label: loc.VIEW_ALL,
			url: ''
		}).component();

		const refreshButton = view.modelBuilder.hyperlink().withProps({
			label: loc.REFRESH,
			url: '',
			CSSStyles: {
				'text-align': 'right'
			}
		}).component();

		refreshButton.onDidClick((e) => {
			this.refreshMigrations();
		});

		const buttonContainer = view.modelBuilder.flexContainer().withLayout({
			justifyContent: 'flex-end',
		}).component();

		buttonContainer.addItem(viewAllButton, {
			flex: 'auto',
			CSSStyles: {
				'border-right': '1px solid rgba(0, 0, 0, 0.7)',
				'width': '40px',
			}
		});

		buttonContainer.addItem(refreshButton, {
			flex: 'auto',
			CSSStyles: {
				'margin-left': '5px',
				'width': '25px'
			}
		});

		const header = view.modelBuilder.flexContainer().withItems(
			[
				statusContainerTitle,
				buttonContainer
			]
		).withLayout({
			flexFlow: 'row'
		}).component();



		this._migrationStatusCardsContainer = view.modelBuilder.flexContainer().withLayout({ flexFlow: 'column' }).component();

		statusContainer.addItem(
			header, {
			CSSStyles: {
				'padding': '0px',
				'padding-right': '5px',
				'padding-top': '10px',
				'height': '10px',
				'margin': '0px'
			}
		}
		);

		statusContainer.addItem(this._migrationStatusCardsContainer, {
			CSSStyles: {
				'margin-top': '30px'
			}
		});

		return statusContainer;
	}

	private createVideoLinks(view: azdata.ModelView): azdata.Component {
		//const maxWidth = 400;
		const linksContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: '400px',
			height: '250px',
			justifyContent: 'flex-start',
		}).withProps({
			CSSStyles: {
				'border': '1px solid rgba(0, 0, 0, 0.1)',
				'padding': '15px'
			}
		}).component();
		const titleComponent = view.modelBuilder.text().withProperties({
			value: loc.HELP_TITLE,
			CSSStyles: {
				'font-size': '18px',
				'font-weight': 'bold',
				'margin': '0px'
			}
		}).component();

		linksContainer.addItems([titleComponent], {
			CSSStyles: {
				'padding': '0px',
				'padding-right': '5px',
				'padding-top': '10px',
				'height': '10px',
				'margin': '0px'
			}
		});

		const links = [{
			title: loc.HELP_LINK1_TITLE,
			description: loc.HELP_LINK1_DESCRIPTION,
			link: 'www.microsoft.com'
		}];

		const styles = {
			'margin-top': '10px',
			'padding': '10px 10px 10px 0'
		};
		linksContainer.addItems(links.map(l => this.createLink(view, l)), {
			CSSStyles: styles
		});

		const videosContainer = this.createVideoLinkContainers(view, [
			{
				iconPath: { light: 'images/aiMlSqlServer.svg', dark: 'images/aiMlSqlServer.svg' },
				description: loc.HELP_VIDEO1_TITLE,
				link: 'https://www.youtube.com/watch?v=sE99cSoFOHs'
			},
			{
				iconPath: { light: 'images/sqlServerMl.svg', dark: 'images/sqlServerMl.svg' },
				description: loc.HELP_VIDEO2_TITLE,
				link: 'https://www.youtube.com/watch?v=R4GCBoxADyQ'
			}
		]);

		const viewPanelStyle = {
			'padding': '10px 5px 10px 10px',
			'margin-top': '-15px'
		};
		linksContainer.addItem(videosContainer, {
			CSSStyles: viewPanelStyle
		});

		return linksContainer;
	}

	private createLink(view: azdata.ModelView, linkMetaData: IActionMetadata): azdata.Component {
		const maxWidth = 400;
		const labelsContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			justifyContent: 'flex-start'
		}).component();
		const descriptionComponent = view.modelBuilder.text().withProperties({
			value: linkMetaData.description,
			width: maxWidth,
			CSSStyles: {
				'font-size': '12px',
				'line-height': '16px',
				'margin': '0px'
			}
		}).component();
		const linkContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth + 10,
			justifyContent: 'flex-start'
		}).component();
		const linkComponent = view.modelBuilder.hyperlink().withProps({
			label: linkMetaData.title!,
			url: linkMetaData.link!,
			showLinkIcon: true,
			CSSStyles: {
				'font-size': '14px',
				'margin': '0px'
			}
		}).component();
		linkContainer.addItem(linkComponent, {
			CSSStyles: {
				'font-size': '14px',
				'line-height': '18px',
				'padding': '0 5px 0 0',
			}
		});
		labelsContainer.addItems([linkContainer, descriptionComponent], {
			CSSStyles: {
				'padding': '5px 0 0 0',
			}
		});

		return labelsContainer;
	}

	private createVideoLinkContainers(view: azdata.ModelView, links: IActionMetadata[]): azdata.Component {
		const maxWidth = 400;
		const videosContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'row',
			width: maxWidth,
		}).component();

		links.forEach(link => {
			const videoContainer = this.createVideoLink(view, link);

			videosContainer.addItem(videoContainer);
		});

		return videosContainer;
	}

	private createVideoLink(view: azdata.ModelView, linkMetaData: IActionMetadata): azdata.Component {
		const maxWidth = 150;
		const videosContainer = view.modelBuilder.flexContainer().withLayout({
			flexFlow: 'column',
			width: maxWidth,
			justifyContent: 'flex-start'
		}).component();
		const video1Container = view.modelBuilder.divContainer().withProperties({
			clickable: true,
			width: maxWidth,
			height: '100px'
		}).component();
		const descriptionComponent = view.modelBuilder.text().withProperties({
			value: linkMetaData.description,
			width: maxWidth,
			height: '50px',
			CSSStyles: {
				'font-size': '13px',
				'margin': '0px'
			}
		}).component();
		video1Container.onDidClick(async () => {
			if (linkMetaData.link) {
				await vscode.env.openExternal(vscode.Uri.parse(linkMetaData.link));
			}
		});
		videosContainer.addItem(video1Container, {
			CSSStyles: {
				'background-image': `url(${vscode.Uri.file(this.asAbsolutePath(linkMetaData.iconPath?.light as string || ''))})`,
				'background-repeat': 'no-repeat',
				'background-position': 'top',
				'width': `${maxWidth}px`,
				'height': '104px',
				'background-size': `${maxWidth}px 120px`
			}
		});
		videosContainer.addItem(descriptionComponent);
		return videosContainer;
	}
}
