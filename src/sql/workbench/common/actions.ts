/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IConnectionManagementService } from 'sql/platform/connection/common/connectionManagement';
import * as TaskUtilities from 'sql/workbench/browser/taskUtilities';
import { IQueryEditorService } from 'sql/workbench/services/queryEditor/common/queryEditorService';
import { IConnectionProfile } from 'sql/platform/connection/common/interfaces';
import { IScriptingService } from 'sql/platform/scripting/common/scriptingService';
import { IRestoreDialogController } from 'sql/platform/restore/common/restoreService';
import { IAngularEventingService, AngularEventType } from 'sql/platform/angularEventing/common/angularEventingService';
import { IInsightsDialogService } from 'sql/workbench/services/insights/browser/insightsDialogService';
import { IObjectExplorerService } from 'sql/workbench/services/objectExplorer/common/objectExplorerService';
import { IErrorMessageService } from 'sql/platform/errorMessage/common/errorMessageService';
import { IBackupUiService } from 'sql/workbench/services/backup/common/backupUiService';
import { Task } from 'sql/platform/tasks/browser/tasksRegistry';

import { ObjectMetadata } from 'azdata';

import { Action } from 'vs/base/common/actions';
import { IWindowsService } from 'vs/platform/windows/common/windows';
import * as nls from 'vs/nls';
import { IEditorService } from 'vs/workbench/services/editor/common/editorService';
import { ServicesAccessor } from 'vs/platform/instantiation/common/instantiation';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { IConfigurationService } from 'vs/platform/configuration/common/configuration';
import { mssqlProviderName } from 'sql/platform/connection/common/constants';
import { IInsightsConfig } from 'sql/platform/dashboard/browser/insightRegistry';

export interface BaseActionContext {
	object?: ObjectMetadata;
	profile?: IConnectionProfile;
}

export interface InsightActionContext extends BaseActionContext {
	insight: IInsightsConfig;
}

export interface ManageActionContext extends BaseActionContext {
	uri: string;
}

export const BackupFeatureName = 'backup';

export class BackupAction extends Task {
	public static readonly ID = BackupFeatureName;
	public static readonly LABEL = nls.localize('backupAction.backup', "Backup");
	public static readonly ICON = BackupFeatureName;

	constructor() {
		super({
			id: BackupAction.ID,
			title: BackupAction.LABEL,
			iconPath: undefined,
			iconClass: BackupAction.ICON
		});
	}

	runTask(accessor: ServicesAccessor, profile: IConnectionProfile): void | Promise<void> {
		const configurationService = accessor.get<IConfigurationService>(IConfigurationService);
		const previewFeaturesEnabled: boolean = configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (!previewFeaturesEnabled) {
			return accessor.get<INotificationService>(INotificationService).info(nls.localize('backup.isPreviewFeature', "You must enable preview features in order to use backup"));
		}

		const connectionManagementService = accessor.get<IConnectionManagementService>(IConnectionManagementService);
		if (!profile) {
			const objectExplorerService = accessor.get<IObjectExplorerService>(IObjectExplorerService);
			const workbenchEditorService = accessor.get<IEditorService>(IEditorService);
			profile = TaskUtilities.getCurrentGlobalConnection(objectExplorerService, connectionManagementService, workbenchEditorService);
		}
		if (profile) {
			const serverInfo = connectionManagementService.getServerInfo(profile.id);
			if (serverInfo && serverInfo.isCloud && profile.providerName === mssqlProviderName) {
				return accessor.get<INotificationService>(INotificationService).info(nls.localize('backup.commandNotSupported', "Backup command is not supported for Azure SQL databases."));
			}

			if (!profile.databaseName && profile.providerName === mssqlProviderName) {
				return accessor.get<INotificationService>(INotificationService).info(nls.localize('backup.commandNotSupportedForServer', "Backup command is not supported in Server Context. Please select a Database and try again."));
			}
		}

		TaskUtilities.showBackup(
			profile,
			accessor.get<IBackupUiService>(IBackupUiService)
		).then();
	}
}

export const RestoreFeatureName = 'restore';

export class RestoreAction extends Task {
	public static readonly ID = RestoreFeatureName;
	public static readonly LABEL = nls.localize('restoreAction.restore', "Restore");
	public static readonly ICON = RestoreFeatureName;

	constructor() {
		super({
			id: RestoreAction.ID,
			title: RestoreAction.LABEL,
			iconPath: undefined,
			iconClass: RestoreAction.ICON
		});
	}

	runTask(accessor: ServicesAccessor, profile: IConnectionProfile): void | Promise<void> {
		const configurationService = accessor.get<IConfigurationService>(IConfigurationService);
		const previewFeaturesEnabled: boolean = configurationService.getValue('workbench')['enablePreviewFeatures'];
		if (!previewFeaturesEnabled) {
			return accessor.get<INotificationService>(INotificationService).info(nls.localize('restore.isPreviewFeature', "You must enable preview features in order to use restore"));
		}

		let connectionManagementService = accessor.get<IConnectionManagementService>(IConnectionManagementService);
		if (!profile) {
			const objectExplorerService = accessor.get<IObjectExplorerService>(IObjectExplorerService);
			const workbenchEditorService = accessor.get<IEditorService>(IEditorService);
			profile = TaskUtilities.getCurrentGlobalConnection(objectExplorerService, connectionManagementService, workbenchEditorService);
		}
		if (profile) {
			const serverInfo = connectionManagementService.getServerInfo(profile.id);
			if (serverInfo && serverInfo.isCloud && profile.providerName === mssqlProviderName) {
				return accessor.get<INotificationService>(INotificationService).info(nls.localize('restore.commandNotSupported', "Restore command is not supported for Azure SQL databases."));
			}
		}

		TaskUtilities.showRestore(
			profile,
			accessor.get<IRestoreDialogController>(IRestoreDialogController)
		).then();
	}
}

export class ManageAction extends Action {
	public static ID = 'manage';
	public static LABEL = nls.localize('manage', "Manage");

	constructor(
		id: string, label: string,
		@IConnectionManagementService protected _connectionManagementService: IConnectionManagementService,
		@IAngularEventingService protected _angularEventingService: IAngularEventingService
	) {
		super(id, label);
	}

	run(actionContext: ManageActionContext): Promise<boolean> {
		return this._connectionManagementService.connect(actionContext.profile, actionContext.uri, { showDashboard: true, saveTheConnection: false, params: undefined, showConnectionDialogOnError: false, showFirewallRuleOnError: true }).then(
			() => {
				this._angularEventingService.sendAngularEvent(actionContext.uri, AngularEventType.NAV_DATABASE);
				return true;
			}
		);
	}
}

export class InsightAction extends Action {
	public static ID = 'showInsight';
	public static LABEL = nls.localize('showDetails', "Show Details");

	constructor(
		id: string, label: string,
		@IInsightsDialogService protected _insightsDialogService: IInsightsDialogService
	) {
		super(id, label);
	}

	run(actionContext: InsightActionContext): Promise<boolean> {
		this._insightsDialogService.show(actionContext.insight, actionContext.profile);
		return Promise.resolve(true);
	}
}

export class ConfigureDashboardAction extends Task {
	public static readonly ID = 'configureDashboard';
	public static readonly LABEL = nls.localize('configureDashboard', "Learn How To Configure The Dashboard");
	public static readonly ICON = 'configure-dashboard';
	private static readonly configHelpUri = 'https://aka.ms/sqldashboardconfig';

	constructor() {
		super({
			id: ConfigureDashboardAction.ID,
			title: ConfigureDashboardAction.LABEL,
			iconPath: undefined,
			iconClass: ConfigureDashboardAction.ICON
		});
	}

	runTask(accessor: ServicesAccessor): Promise<void> {
		return accessor.get<IWindowsService>(IWindowsService).openExternal(ConfigureDashboardAction.configHelpUri).then();
	}
}
