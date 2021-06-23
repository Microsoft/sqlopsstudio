/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';

// Contains vs strings that are nonnative to vscode that need to be translated.

// vs\code\electron-sandbox\issue\issueReporterMain.ts
export const issueReporterMainAzuredatastudio = localize('azuredatastudio', "Azure Data Studio");

// vs\platform\update\common\update.config.contribution.ts
export const updateConfigContributionDefault = localize('default', "Enable automatic update checks. Azure Data Studio will check for updates automatically and periodically.");
export const updateConfigContributionEnableWindowsBackgroundUpdates = localize('enableWindowsBackgroundUpdates', "Enable to download and install new Azure Data Studio Versions in the background on Windows");
export const updateConfigContributionShowReleaseNotes = localize('showReleaseNotes', "Show Release Notes after an update. The Release Notes are opened in a new web browser window.");

// vs\workbench\api\common\menusExtensionPoint.ts
export const menusExtensionPointDashboardToolbar = localize('dashboard.toolbar', "The dashboard toolbar action menu");
export const menusExtensionPointNotebookCellTitle = localize('notebook.cellTitle', "The notebook cell title menu");
export const menusExtensionPointNotebookTitle = localize('notebook.title', "The notebook title menu");
export const menusExtensionPointNotebookToolbar = localize('notebook.toolbar', "The notebook toolbar menu");
export const menusExtensionPointDataExplorerAction = localize('dataExplorer.action', "The dataexplorer view container title action menu");
export const menusExtensionPointDataExplorerContext = localize('dataExplorer.context', "The dataexplorer item context menu");
export const menusExtensionPointObjectExplorerContext = localize('objectExplorer.context', "The object explorer item context menu");
export const menusExtensionPointConnectionDialogBrowseTreeContext = localize('connectionDialogBrowseTree.context', "The connection dialog's browse tree context menu");
export const menusExtensionPointDataGridContext = localize('dataGrid.context', "The data grid item context menu");

// vs\workbench\contrib\extensions\browser\extensions.contribution.ts
export const extensionsContributionExtensionsPolicy = localize('extensionsPolicy', "Sets the security policy for downloading extensions.");
export const extensionsContributionInstallVSIXActionAllowNone = localize('InstallVSIXAction.allowNone', 'Your extension policy does not allow installing extensions. Please change your extension policy and try again.');
export function extensionsContributionInstallVSIXActionSuccessReload(extension: string): string { return localize('InstallVSIXAction.successReload', "Completed installing {0} extension from VSIX. Please reload Azure Data Studio to enable it.", extension); }

// vs\workbench\contrib\watermark\browser\extensionsActions.ts
export const extensionsActionsPostUninstallTooltip = localize('postUninstallTooltip', "Please reload Azure Data Studio to complete the uninstallation of this extension.");
export const extensionsActionsPostUpdateTooltip = localize('postUpdateTooltip', "Please reload Azure Data Studio to enable the updated extension.");
export const extensionsActionsEnableLocally = localize('enable locally', "Please reload Azure Data Studio to enable this extension locally.");
export const extensionsActionsPostEnableTooltip = localize('postEnableTooltip', "Please reload Azure Data Studio to enable this extension.");
export const extensionsActionsPostDisableTooltip = localize('postDisableTooltip', "Please reload Azure Data Studio to disable this extension.");
export function extensionsActionsUninstallExtensionComplete(extension: string): string { return localize('uninstallExtensionComplete', "Please reload Azure Data Studio to complete the uninstallation of the extension {0}.", extension); }
export function extensionsActionsEnableRemote(remoteServer: string): string { return localize('enable remote', "Please reload Azure Data Studio to enable this extension in {0}.", remoteServer); }
export function extensionsActionsInstallExtensionCompletedAndReloadRequired(extension: string): string { return localize('installExtensionCompletedAndReloadRequired', "Installing extension {0} is completed. Please reload Azure Data Studio to enable it.", extension); }
export function extensionsActionsReinstallActionSuccessReload(extension: string): string { return localize('ReinstallAction.successReload', "Please reload Azure Data Studio to complete reinstalling the extension {0}.", extension); }

// vs\workbench\contrib\extensions\browser\extensionsViewlets.ts
export const extensionsViewletRecommendedExtensions = localize('recommendedExtensions', "Marketplace");

// vs\workbench\contrib\extensions\browser\extensionsViews.ts
export const extensionsViewsScenarioTypeUndefined = localize('scenarioTypeUndefined', 'The scenario type for extension recommendations must be provided.');

// vs\workbench\contrib\extensions\browser\extensionsWorkbenchService.ts
export function extensionsWorkbenchServiceIncompatible(extension: string, version: string) { return localize('incompatible', "Unable to install extension '{0}' as it is not compatible with Azure Data Studio '{1}'.", extension, version); }

// vs\workbench\contrib\files\browser\fileActions.contribution.ts
export const fileActionsContributionNewQuery = localize('newQuery', "New Query");
export const fileActionsContributionMiNewQuery = localize({ key: 'miNewQuery', comment: ['&& denotes a mnemonic'] }, "New &&Query");
export const fileActionsContributionMiNewNotebook = localize({ key: 'miNewNotebook', comment: ['&& denotes a mnemonic'] }, "&&New Notebook");

// vs\workbench\contrib\files\browser\files.contribution.ts
export const filesContributionMaxMemoryForLargeFilesMB = localize('maxMemoryForLargeFilesMB', "Controls the memory available to Azure Data Studio after restart when trying to open large files. Same effect as specifying `--max-memory=NEWSIZE` on the command line.");

// vs\workbench\contrib\localizations\browser\localizations.contribution.ts
export function localizationsContributionUpdateLocale(locale: string): string { return localize('updateLocale', "Would you like to change Azure Data Studio's UI language to {0} and restart?", locale); }
export function localizationsContributionActivateLanguagePack(locale: string): string { return localize('activateLanguagePack', "In order to use Azure Data Studio in {0}, Azure Data Studio needs to restart.", locale); }

// vs\workbench\contrib\watermark\browser\watermark.ts
export const watermarkNewSqlFile = localize('watermark.newSqlFile', "New SQL File");
export const watermarkNewNotebook = localize('watermark.newNotebook', "New Notebook");

// vs/workbench/electron-sandbox/desktop.contribution.ts
export const desktopContributionMiinstallVsix = localize({ key: 'miinstallVsix', comment: ['&& denotes a mnemonic'] }, "Install Extension from VSIX Package");
