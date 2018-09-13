/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from 'vs/nls';
import * as paths from 'vs/base/common/paths';
import { TPromise } from 'vs/base/common/winjs.base';
import { forEach } from 'vs/base/common/collections';
import { IDisposable, dispose, Disposable } from 'vs/base/common/lifecycle';
import { match } from 'vs/base/common/glob';
import * as json from 'vs/base/common/json';
import {
	IExtensionManagementService, IExtensionGalleryService, IExtensionTipsService, ExtensionRecommendationReason, LocalExtensionType, EXTENSION_IDENTIFIER_PATTERN,
	IExtensionsConfigContent, RecommendationChangeNotification, IExtensionRecommendation, ExtensionRecommendationSource, IExtensionManagementServerService, InstallOperation
} from 'vs/platform/extensionManagement/common/extensionManagement';
import { IModelService } from 'vs/editor/common/services/modelService';
import { ITextModel } from 'vs/editor/common/model';
import { IStorageService, StorageScope } from 'vs/platform/storage/common/storage';
import product from 'vs/platform/node/product';
import { IInstantiationService } from 'vs/platform/instantiation/common/instantiation';
import { ShowRecommendedExtensionsAction, InstallWorkspaceRecommendedExtensionsAction, InstallRecommendedExtensionAction } from 'vs/workbench/parts/extensions/electron-browser/extensionsActions';
import Severity from 'vs/base/common/severity';
import { IWorkspaceContextService, IWorkspaceFolder, IWorkspace, IWorkspaceFoldersChangeEvent, WorkbenchState } from 'vs/platform/workspace/common/workspace';
import { IFileService } from 'vs/platform/files/common/files';
// {{SQL CARBON EDIT}}
import { IExtensionsConfiguration, ConfigurationKey, ShowRecommendationsOnlyOnDemandKey, IExtensionsViewlet, ExtensionsPolicyKey, ExtensionsPolicy } from 'vs/workbench/parts/extensions/common/extensions';
import { IConfigurationService, ConfigurationTarget } from 'vs/platform/configuration/common/configuration';
import { ITelemetryService } from 'vs/platform/telemetry/common/telemetry';
import * as pfs from 'vs/base/node/pfs';
import * as os from 'os';
import { flatten, distinct, shuffle, coalesce } from 'vs/base/common/arrays';
import { IEnvironmentService } from 'vs/platform/environment/common/environment';
import { guessMimeTypes, MIME_UNKNOWN } from 'vs/base/common/mime';
import { IExtensionService } from 'vs/workbench/services/extensions/common/extensions';
import { getHashedRemotesFromUri } from 'vs/workbench/parts/stats/node/workspaceStats';
import { IRequestService } from 'vs/platform/request/node/request';
import { asJson } from 'vs/base/node/request';
import { isNumber } from 'vs/base/common/types';
import { IViewletService } from 'vs/workbench/services/viewlet/browser/viewlet';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { Emitter, Event } from 'vs/base/common/event';
import { assign } from 'vs/base/common/objects';
import URI from 'vs/base/common/uri';
import { areSameExtensions, getGalleryExtensionIdFromLocal } from 'vs/platform/extensionManagement/common/extensionManagementUtil';
import { IExperimentService, ExperimentActionType, ExperimentState } from 'vs/workbench/parts/experiments/node/experimentService';

const milliSecondsInADay = 1000 * 60 * 60 * 24;
const choiceNever = localize('neverShowAgain', "Don't Show Again");
const searchMarketplace = localize('searchMarketplace', "Search Marketplace");
const processedFileExtensions: string[] = [];

interface IDynamicWorkspaceRecommendations {
	remoteSet: string[];
	recommendations: string[];
}

function caseInsensitiveGet<T>(obj: { [key: string]: T }, key: string): T | undefined {
	if (!obj) {
		return undefined;
	}
	for (const _key in obj) {
		if (Object.hasOwnProperty.call(obj, _key) && _key.toLowerCase() === key.toLowerCase()) {
			return obj[_key];
		}
	}
	return undefined;
}

export class ExtensionTipsService extends Disposable implements IExtensionTipsService {

	_serviceBrand: any;

	private _fileBasedRecommendations: { [id: string]: { recommendedTime: number, sources: ExtensionRecommendationSource[] }; } = Object.create(null);
	// {{SQL CARBON EDIT}}
	private _recommendations: string[] = [];
	private _exeBasedRecommendations: { [id: string]: string; } = Object.create(null);
	private _availableRecommendations: { [pattern: string]: string[] } = Object.create(null);
	private _allWorkspaceRecommendedExtensions: IExtensionRecommendation[] = [];
	private _dynamicWorkspaceRecommendations: string[] = [];
	private _experimentalRecommendations: { [id: string]: string } = Object.create(null);
	private _allIgnoredRecommendations: string[] = [];
	private _globallyIgnoredRecommendations: string[] = [];
	private _workspaceIgnoredRecommendations: string[] = [];
	private _extensionsRecommendationsUrl: string;
	private _disposables: IDisposable[] = [];
	public loadWorkspaceConfigPromise: TPromise<any>;
	private proactiveRecommendationsFetched: boolean = false;

	private readonly _onRecommendationChange: Emitter<RecommendationChangeNotification> = new Emitter<RecommendationChangeNotification>();
	onRecommendationChange: Event<RecommendationChangeNotification> = this._onRecommendationChange.event;
	private sessionSeed: number;

	constructor(
		@IExtensionGalleryService private readonly _galleryService: IExtensionGalleryService,
		@IModelService private readonly _modelService: IModelService,
		@IStorageService private storageService: IStorageService,
		@IExtensionManagementService private extensionsService: IExtensionManagementService,
		@IInstantiationService private instantiationService: IInstantiationService,
		@IFileService private fileService: IFileService,
		@IWorkspaceContextService private contextService: IWorkspaceContextService,
		@IConfigurationService private configurationService: IConfigurationService,
		@ITelemetryService private telemetryService: ITelemetryService,
		@IEnvironmentService private environmentService: IEnvironmentService,
		@IExtensionService private extensionService: IExtensionService,
		@IRequestService private requestService: IRequestService,
		@IViewletService private viewletService: IViewletService,
		@INotificationService private notificationService: INotificationService,
		@IExtensionManagementService private extensionManagementService: IExtensionManagementService,
		@IExtensionManagementServerService private extensionManagementServiceService: IExtensionManagementServerService,
		@IExperimentService private experimentService: IExperimentService,
	) {
		super();

		// {{SQL CARBON EDIT}}
		let extensionPolicy: string = this.configurationService.getValue<string>(ExtensionsPolicyKey);
		if (!this.isEnabled() || extensionPolicy === ExtensionsPolicy.allowNone) {
			return;
		}

		if (product.extensionsGallery && product.extensionsGallery.recommendationsUrl) {
			this._extensionsRecommendationsUrl = product.extensionsGallery.recommendationsUrl;
		}

		this.sessionSeed = +new Date();

		let globallyIgnored = <string[]>JSON.parse(this.storageService.get('extensionsAssistant/ignored_recommendations', StorageScope.GLOBAL, '[]'));
		this._globallyIgnoredRecommendations = globallyIgnored.map(id => id.toLowerCase());

		this.fetchCachedDynamicWorkspaceRecommendations();
		this.fetchFileBasedRecommendations();
		this.fetchExperimentalRecommendations();
		if (!this.configurationService.getValue<boolean>(ShowRecommendationsOnlyOnDemandKey)) {
			this.fetchProactiveRecommendations(true);
		}

		// {{SQL CARBON EDIT}} disable extension recommendation prompt
		this.loadWorkspaceConfigPromise = this.getWorkspaceRecommendations();
		// .then(() => {
		// 	this.promptWorkspaceRecommendations();
		// 	this._modelService.onModelAdded(this.promptFiletypeBasedRecommendations, this, this._disposables);
		// 	this._modelService.getModels().forEach(model => this.promptFiletypeBasedRecommendations(model));
		// });

		this._register(this.contextService.onDidChangeWorkspaceFolders(e => this.onWorkspaceFoldersChanged(e)));
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (!this.proactiveRecommendationsFetched && !this.configurationService.getValue<boolean>(ShowRecommendationsOnlyOnDemandKey)) {
				this.fetchProactiveRecommendations();
			}
		}));
		this._register(this.extensionManagementService.onDidInstallExtension(e => {
			if (e.gallery && e.operation === InstallOperation.Install) {
				const extRecommendations = this.getAllRecommendationsWithReason() || {};
				const recommendationReason = extRecommendations[e.gallery.identifier.id.toLowerCase()];
				if (recommendationReason) {
					/* __GDPR__
						"extensionGallery:install:recommendations" : {
							"recommendationReason": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
							"${include}": [
								"${GalleryExtensionTelemetryData}"
							]
						}
					*/
					this.telemetryService.publicLog('extensionGallery:install:recommendations', assign(e.gallery.telemetryData, { recommendationReason: recommendationReason.reasonId }));
				}
			}
		}));
	}

	private fetchProactiveRecommendations(calledDuringStartup?: boolean): TPromise<void> {
		let fetchPromise = TPromise.as(null);
		if (!this.proactiveRecommendationsFetched) {
			this.proactiveRecommendationsFetched = true;

			// Executable based recommendations carry out a lot of file stats, so run them after 10 secs
			// So that the startup is not affected

			fetchPromise = new TPromise((c, e) => {
				setTimeout(() => {
					TPromise.join([this.fetchExecutableRecommendations(), this.fetchDynamicWorkspaceRecommendations()]).then(() => c(null));
				}, calledDuringStartup ? 10000 : 0);
			});

		}
		return fetchPromise;
	}

	private isEnabled(): boolean {
		return this._galleryService.isEnabled() && !this.environmentService.extensionDevelopmentPath;
	}

	getAllRecommendationsWithReason(): { [id: string]: { reasonId: ExtensionRecommendationReason, reasonText: string }; } {
		let output: { [id: string]: { reasonId: ExtensionRecommendationReason, reasonText: string }; } = Object.create(null);

		if (!this.proactiveRecommendationsFetched) {
			return output;
		}

		forEach(this._experimentalRecommendations, entry => output[entry.key.toLowerCase()] = {
			reasonId: ExtensionRecommendationReason.Experimental,
			reasonText: entry.value
		});

		if (this.contextService.getWorkspace().folders && this.contextService.getWorkspace().folders.length === 1) {
			const currentRepo = this.contextService.getWorkspace().folders[0].name;

			this._dynamicWorkspaceRecommendations.forEach(id => output[id.toLowerCase()] = {
				reasonId: ExtensionRecommendationReason.DynamicWorkspace,
				reasonText: localize('dynamicWorkspaceRecommendation', "This extension may interest you because it's popular among users of the {0} repository.", currentRepo)
			});
		}

		forEach(this._exeBasedRecommendations, entry => output[entry.key.toLowerCase()] = {
			reasonId: ExtensionRecommendationReason.Executable,
			reasonText: localize('exeBasedRecommendation', "This extension is recommended because you have {0} installed.", entry.value)
		});

		forEach(this._fileBasedRecommendations, entry => output[entry.key.toLowerCase()] = {
			reasonId: ExtensionRecommendationReason.File,
			reasonText: localize('fileBasedRecommendation', "This extension is recommended based on the files you recently opened.")
		});


		this._allWorkspaceRecommendedExtensions.forEach(({ extensionId }) => output[extensionId.toLowerCase()] = {
			reasonId: ExtensionRecommendationReason.Workspace,
			reasonText: localize('workspaceRecommendation', "This extension is recommended by users of the current workspace.")
		});

		// {{SQL CARBON EDIT}}
		this._recommendations.forEach(x => output[x.toLowerCase()] = {
			reasonId: ExtensionRecommendationReason.Executable,
			reasonText: localize('defaultRecommendations', "This extension is recommended by Azure Data Studio.")
		});

		for (const id of this._allIgnoredRecommendations) {
			delete output[id];
		}

		return output;
	}

	getAllIgnoredRecommendations(): { global: string[], workspace: string[] } {
		return {
			global: this._globallyIgnoredRecommendations,
			workspace: this._workspaceIgnoredRecommendations
		};
	}

	getWorkspaceRecommendations(): TPromise<IExtensionRecommendation[]> {
		if (!this.isEnabled()) { return TPromise.as([]); }
		return this.fetchWorkspaceRecommendations()
			.then(() => this._allWorkspaceRecommendedExtensions.filter(rec => this.isExtensionAllowedToBeRecommended(rec.extensionId)));
	}

	private fetchWorkspaceRecommendations(): TPromise<void> {

		if (!this.isEnabled) { return TPromise.as(null); }

		return this.fetchExtensionRecommendationContents()
			.then(result => this.validateExtensions(result.map(({ contents }) => contents))
				.then(({ invalidExtensions, message }) => {

					if (invalidExtensions.length > 0 && this.notificationService) {
						this.notificationService.warn(`The below ${invalidExtensions.length} extension(s) in workspace recommendations have issues:\n${message}`);
					}

					const seenUnWantedRecommendations: { [id: string]: boolean } = {};

					this._allWorkspaceRecommendedExtensions = [];
					this._workspaceIgnoredRecommendations = [];

					for (const contentsBySource of result) {
						if (contentsBySource.contents.unwantedRecommendations) {
							for (const r of contentsBySource.contents.unwantedRecommendations) {
								const unwantedRecommendation = r.toLowerCase();
								if (!seenUnWantedRecommendations[unwantedRecommendation] && invalidExtensions.indexOf(unwantedRecommendation) === -1) {
									this._workspaceIgnoredRecommendations.push(unwantedRecommendation);
									seenUnWantedRecommendations[unwantedRecommendation] = true;
								}
							}
						}

						if (contentsBySource.contents.recommendations) {
							for (const r of contentsBySource.contents.recommendations) {
								const extensionId = r.toLowerCase();
								if (invalidExtensions.indexOf(extensionId) === -1) {
									let recommendation = this._allWorkspaceRecommendedExtensions.filter(r => r.extensionId === extensionId)[0];
									if (!recommendation) {
										recommendation = { extensionId, sources: [] };
										this._allWorkspaceRecommendedExtensions.push(recommendation);
									}
									if (recommendation.sources.indexOf(contentsBySource.source) === -1) {
										recommendation.sources.push(contentsBySource.source);
									}
								}
							}
						}
					}
					this._allIgnoredRecommendations = distinct([...this._globallyIgnoredRecommendations, ...this._workspaceIgnoredRecommendations]);
				}));
	}

	private fetchExtensionRecommendationContents(): TPromise<{ contents: IExtensionsConfigContent, source: ExtensionRecommendationSource }[]> {
		const workspace = this.contextService.getWorkspace();
		return TPromise.join<{ contents: IExtensionsConfigContent, source: ExtensionRecommendationSource }>([
			this.resolveWorkspaceExtensionConfig(workspace).then(contents => contents ? { contents, source: workspace } : null),
			...workspace.folders.map(workspaceFolder => this.resolveWorkspaceFolderExtensionConfig(workspaceFolder).then(contents => contents ? { contents, source: workspaceFolder } : null))
		]).then(contents => coalesce(contents));
	}

	private resolveWorkspaceExtensionConfig(workspace: IWorkspace): TPromise<IExtensionsConfigContent | null> {
		if (!workspace.configuration) {
			return TPromise.as(null);
		}

		return this.fileService.resolveContent(workspace.configuration)
			.then(content => <IExtensionsConfigContent>(json.parse(content.value)['extensions']), err => null);
	}

	private resolveWorkspaceFolderExtensionConfig(workspaceFolder: IWorkspaceFolder): TPromise<IExtensionsConfigContent | null> {
		// {{SQL CARBON EDIT}}
		const extensionsJsonUri = workspaceFolder.toResource(paths.join('.sqlops', 'extensions.json'));

		return this.fileService.resolveFile(extensionsJsonUri)
			.then(() => this.fileService.resolveContent(extensionsJsonUri))
			.then(content => <IExtensionsConfigContent>json.parse(content.value), err => null);
	}

	private async validateExtensions(contents: IExtensionsConfigContent[]): TPromise<{ invalidExtensions: string[], message: string }> {
		const extensionsContent: IExtensionsConfigContent = {
			recommendations: distinct(flatten(contents.map(content => content.recommendations || []))),
			unwantedRecommendations: distinct(flatten(contents.map(content => content.unwantedRecommendations || [])))
		};

		const regEx = new RegExp(EXTENSION_IDENTIFIER_PATTERN);

		const invalidExtensions = [];
		let message = '';

		const regexFilter = (ids: string[]) => {
			return ids.filter((element, position) => {
				if (ids.indexOf(element) !== position) {
					// This is a duplicate entry, it doesn't hurt anybody
					// but it shouldn't be sent in the gallery query
					return false;
				} else if (!regEx.test(element)) {
					invalidExtensions.push(element.toLowerCase());
					message += `${element} (bad format) Expected: <provider>.<name>\n`;
					return false;
				}
				return true;
			});
		};

		const filteredWanted = regexFilter(extensionsContent.recommendations || []).map(x => x.toLowerCase());

		if (filteredWanted.length) {
			try {
				let validRecommendations = (await this._galleryService.query({ names: filteredWanted })).firstPage
					.map(extension => extension.identifier.id.toLowerCase());

				if (validRecommendations.length !== filteredWanted.length) {
					filteredWanted.forEach(element => {
						if (validRecommendations.indexOf(element.toLowerCase()) === -1) {
							invalidExtensions.push(element.toLowerCase());
							message += `${element} (not found in marketplace)\n`;
						}
					});
				}
			} catch (e) {
				console.warn('Error querying extensions gallery', e);
			}
		}
		return { invalidExtensions, message };
	}

	private isExtensionAllowedToBeRecommended(id: string): boolean {
		return this._allIgnoredRecommendations.indexOf(id.toLowerCase()) === -1;
	}

	private onWorkspaceFoldersChanged(event: IWorkspaceFoldersChangeEvent): void {
		if (event.added.length) {
			const oldWorkspaceRecommended = this._allWorkspaceRecommendedExtensions;
			this.getWorkspaceRecommendations()
				.then(currentWorkspaceRecommended => {
					// Suggest only if at least one of the newly added recommendations was not suggested before
					if (currentWorkspaceRecommended.some(current => oldWorkspaceRecommended.every(old => current.extensionId !== old.extensionId))) {
						this.promptWorkspaceRecommendations();
					}
				});
		}
		this._dynamicWorkspaceRecommendations = [];
	}

	getFileBasedRecommendations(): IExtensionRecommendation[] {
		return Object.keys(this._fileBasedRecommendations)
			.sort((a, b) => {
				if (this._fileBasedRecommendations[a].recommendedTime === this._fileBasedRecommendations[b].recommendedTime) {
					if (!product.extensionImportantTips || caseInsensitiveGet(product.extensionImportantTips, a)) {
						return -1;
					}
					if (caseInsensitiveGet(product.extensionImportantTips, b)) {
						return 1;
					}
				}
				return this._fileBasedRecommendations[a].recommendedTime > this._fileBasedRecommendations[b].recommendedTime ? -1 : 1;
			})
			.filter(extensionId => this.isExtensionAllowedToBeRecommended(extensionId))
			.map(extensionId => (<IExtensionRecommendation>{ extensionId, sources: this._fileBasedRecommendations[extensionId].sources }));
	}

	getOtherRecommendations(): TPromise<IExtensionRecommendation[]> {
		// {{SQL CARBON EDIT}}
		let recommendations = Object.keys(this._exeBasedRecommendations).concat(this._recommendations);
		shuffle(recommendations, this.sessionSeed);
		return TPromise.as(recommendations.map(extensionId => {
			const sources: ExtensionRecommendationSource[] = [];
			if (this._exeBasedRecommendations[extensionId]) {
				sources.push('executable');
			}
			if (this._dynamicWorkspaceRecommendations.indexOf(extensionId) !== -1) {
				sources.push('dynamic');
			}
			return (<IExtensionRecommendation>{ extensionId, sources });
		}));
	}

	getKeymapRecommendations(): IExtensionRecommendation[] {
		return (product.keymapExtensionTips || [])
			.filter(extensionId => this.isExtensionAllowedToBeRecommended(extensionId))
			.map(extensionId => (<IExtensionRecommendation>{ extensionId, sources: ['application'] }));
	}

	getAllRecommendations(): TPromise<IExtensionRecommendation[]> {
		if (!this.proactiveRecommendationsFetched) {
			return TPromise.as([]);
		}
		return TPromise.join([
			this.getWorkspaceRecommendations(),
			TPromise.as(this.getFileBasedRecommendations()),
			this.getOtherRecommendations(),
			TPromise.as(this.getKeymapRecommendations())
		]).then(result => flatten(result).filter(e => this.isExtensionAllowedToBeRecommended(e.extensionId)));
	}

	private fetchFileBasedRecommendations() {
		const extensionTips = product.extensionTips;
		// {{SQL CARBON EDIT}}
		this._recommendations = product.recommendedExtensions;
		if (!extensionTips) {
			return;
		}

		// group ids by pattern, like {**/*.md} -> [ext.foo1, ext.bar2]
		this._availableRecommendations = Object.create(null);
		forEach(extensionTips, entry => {
			let { key: id, value: pattern } = entry;
			let ids = this._availableRecommendations[pattern];
			if (!ids) {
				this._availableRecommendations[pattern] = [id.toLowerCase()];
			} else {
				ids.push(id.toLowerCase());
			}
		});

		forEach(product.extensionImportantTips, entry => {
			let { key: id, value } = entry;
			const { pattern } = value;
			let ids = this._availableRecommendations[pattern];
			if (!ids) {
				this._availableRecommendations[pattern] = [id.toLowerCase()];
			} else {
				ids.push(id.toLowerCase());
			}
		});

		const allRecommendations: string[] = flatten((Object.keys(this._availableRecommendations).map(key => this._availableRecommendations[key])));

		// retrieve ids of previous recommendations
		const storedRecommendationsJson = JSON.parse(this.storageService.get('extensionsAssistant/recommendations', StorageScope.GLOBAL, '[]'));

		if (Array.isArray<string>(storedRecommendationsJson)) {
			for (let id of <string[]>storedRecommendationsJson) {
				if (allRecommendations.indexOf(id) > -1) {
					this._fileBasedRecommendations[id.toLowerCase()] = { recommendedTime: Date.now(), sources: ['cached'] };
				}
			}
		} else {
			const now = Date.now();
			forEach(storedRecommendationsJson, entry => {
				if (typeof entry.value === 'number') {
					const diff = (now - entry.value) / milliSecondsInADay;
					if (diff <= 7 && allRecommendations.indexOf(entry.key) > -1) {
						this._fileBasedRecommendations[entry.key.toLowerCase()] = { recommendedTime: entry.value, sources: ['cached'] };
					}
				}
			});
		}
	}

	private getMimeTypes(path: string): TPromise<string[]> {
		return this.extensionService.whenInstalledExtensionsRegistered().then(() => {
			return guessMimeTypes(path);
		});
	}

	private promptFiletypeBasedRecommendations(model: ITextModel): void {
		let hasSuggestion = false;

		const uri = model.uri;
		if (!uri || !this.fileService.canHandleResource(uri)) {
			return;
		}

		let fileExtension = paths.extname(uri.path);
		if (fileExtension) {
			if (processedFileExtensions.indexOf(fileExtension) > -1) {
				return;
			}
			processedFileExtensions.push(fileExtension);
		}

		// re-schedule this bit of the operation to be off
		// the critical path - in case glob-match is slow
		setImmediate(() => {

			let recommendationsToSuggest: string[] = [];
			const now = Date.now();
			forEach(this._availableRecommendations, entry => {
				let { key: pattern, value: ids } = entry;
				if (match(pattern, uri.path)) {
					for (let id of ids) {
						if (caseInsensitiveGet(product.extensionImportantTips, id)) {
							recommendationsToSuggest.push(id);
						}
						const filedBasedRecommendation = this._fileBasedRecommendations[id.toLowerCase()] || { recommendedTime: now, sources: [] };
						filedBasedRecommendation.recommendedTime = now;
						if (!filedBasedRecommendation.sources.some(s => s instanceof URI && s.toString() === uri.toString())) {
							filedBasedRecommendation.sources.push(uri);
						}
						this._fileBasedRecommendations[id.toLowerCase()] = filedBasedRecommendation;
					}
				}
			});

			this.storageService.store(
				'extensionsAssistant/recommendations',
				JSON.stringify(Object.keys(this._fileBasedRecommendations).reduce((result, key) => { result[key] = this._fileBasedRecommendations[key].recommendedTime; return result; }, {})),
				StorageScope.GLOBAL
			);

			const config = this.configurationService.getValue<IExtensionsConfiguration>(ConfigurationKey);
			if (config.ignoreRecommendations || config.showRecommendationsOnlyOnDemand) {
				return;
			}

			const importantRecommendationsIgnoreList = <string[]>JSON.parse(this.storageService.get('extensionsAssistant/importantRecommendationsIgnore', StorageScope.GLOBAL, '[]'));
			recommendationsToSuggest = recommendationsToSuggest.filter(id => importantRecommendationsIgnoreList.indexOf(id) === -1 && this.isExtensionAllowedToBeRecommended(id));

			const server = this.extensionManagementServiceService.getExtensionManagementServer(model.uri);
			const importantTipsPromise = recommendationsToSuggest.length === 0 ? TPromise.as(null) : server.extensionManagementService.getInstalled(LocalExtensionType.User).then(local => {
				const localExtensions = local.map(e => `${e.manifest.publisher.toLowerCase()}.${e.manifest.name.toLowerCase()}`);
				recommendationsToSuggest = recommendationsToSuggest.filter(id => localExtensions.every(local => local !== id.toLowerCase()));
				if (!recommendationsToSuggest.length) {
					return;
				}
				const id = recommendationsToSuggest[0];
				const name = caseInsensitiveGet(product.extensionImportantTips, id)['name'];

				// Indicates we have a suggested extension via the whitelist
				hasSuggestion = true;

				let message = localize('reallyRecommended2', "The '{0}' extension is recommended for this file type.", name);
				// Temporary fix for the only extension pack we recommend. See https://github.com/Microsoft/vscode/issues/35364
				if (id === 'vscjava.vscode-java-pack') {
					message = localize('reallyRecommendedExtensionPack', "The '{0}' extension pack is recommended for this file type.", name);
				}

				this.notificationService.prompt(Severity.Info, message,
					[{
						label: localize('install', 'Install'),
						run: () => {
							/* __GDPR__
							"extensionRecommendations:popup" : {
								"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
								"extensionId": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" }
							}
							*/
							this.telemetryService.publicLog('extensionRecommendations:popup', { userReaction: 'install', extensionId: name });

							const installAction = this.instantiationService.createInstance(InstallRecommendedExtensionAction, id, server);
							installAction.run().then(() => installAction.dispose());
						}
					}, {
						label: localize('showRecommendations', "Show Recommendations"),
						run: () => {
							/* __GDPR__
								"extensionRecommendations:popup" : {
									"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
									"extensionId": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" }
								}
							*/
							this.telemetryService.publicLog('extensionRecommendations:popup', { userReaction: 'show', extensionId: name });

							const recommendationsAction = this.instantiationService.createInstance(ShowRecommendedExtensionsAction, ShowRecommendedExtensionsAction.ID, localize('showRecommendations', "Show Recommendations"));
							recommendationsAction.run();
							recommendationsAction.dispose();
						}
					}, {
						label: choiceNever,
						isSecondary: true,
						run: () => {
							importantRecommendationsIgnoreList.push(id);
							this.storageService.store(
								'extensionsAssistant/importantRecommendationsIgnore',
								JSON.stringify(importantRecommendationsIgnoreList),
								StorageScope.GLOBAL
							);
							/* __GDPR__
								"extensionRecommendations:popup" : {
									"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
									"extensionId": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" }
								}
							*/
							this.telemetryService.publicLog('extensionRecommendations:popup', { userReaction: 'neverShowAgain', extensionId: name });
							this.promptIgnoreExtensionRecommendations();
						}
					}],
					() => {
						/* __GDPR__
							"extensionRecommendations:popup" : {
								"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
								"extensionId": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" }
							}
						*/
						this.telemetryService.publicLog('extensionRecommendations:popup', { userReaction: 'cancelled', extensionId: name });
					}
				);
			});

			const mimeTypesPromise = this.getMimeTypes(uri.fsPath);
			TPromise.join([importantTipsPromise, mimeTypesPromise]).then(result => {

				const fileExtensionSuggestionIgnoreList = <string[]>JSON.parse(this.storageService.get
					('extensionsAssistant/fileExtensionsSuggestionIgnore', StorageScope.GLOBAL, '[]'));
				const mimeTypes = result[1];

				if (fileExtension) {
					fileExtension = fileExtension.substr(1); // Strip the dot
				}

				if (hasSuggestion ||
					!fileExtension ||
					mimeTypes.length !== 1 ||
					mimeTypes[0] !== MIME_UNKNOWN ||
					fileExtensionSuggestionIgnoreList.indexOf(fileExtension) > -1
				) {
					return;
				}

				const keywords = this.getKeywordsForExtension(fileExtension);
				this._galleryService.query({ text: `tag:"__ext_${fileExtension}" ${keywords.map(tag => `tag:"${tag}"`)}` }).then(pager => {
					if (!pager || !pager.firstPage || !pager.firstPage.length) {
						return;
					}

					this.notificationService.prompt(
						Severity.Info,
						localize('showLanguageExtensions', "The Marketplace has extensions that can help with '.{0}' files", fileExtension),
						[{
							label: searchMarketplace,
							run: () => {
								/* __GDPR__
									"fileExtensionSuggestion:popup" : {
										"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
										"fileExtension": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" }
									}
								*/
								this.telemetryService.publicLog('fileExtensionSuggestion:popup', { userReaction: 'ok', fileExtension: fileExtension });
								this.viewletService.openViewlet('workbench.view.extensions', true)
									.then(viewlet => viewlet as IExtensionsViewlet)
									.then(viewlet => {
										viewlet.search(`ext:${fileExtension}`);
										viewlet.focus();
									});
							}
						}, {
							label: choiceNever,
							isSecondary: true,
							run: () => {
								fileExtensionSuggestionIgnoreList.push(fileExtension);
								this.storageService.store(
									'extensionsAssistant/fileExtensionsSuggestionIgnore',
									JSON.stringify(fileExtensionSuggestionIgnoreList),
									StorageScope.GLOBAL
								);
								/* __GDPR__
									"fileExtensionSuggestion:popup" : {
										"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
										"fileExtension": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" }
									}
								*/
								this.telemetryService.publicLog('fileExtensionSuggestion:popup', { userReaction: 'neverShowAgain', fileExtension: fileExtension });
							}
						}],
						() => {
							/* __GDPR__
								"fileExtensionSuggestion:popup" : {
									"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
									"fileExtension": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" }
								}
							*/
							this.telemetryService.publicLog('fileExtensionSuggestion:popup', { userReaction: 'cancelled', fileExtension: fileExtension });
						}
					);
				});
			});
		});
	}

	private promptWorkspaceRecommendations(): void {
		const storageKey = 'extensionsAssistant/workspaceRecommendationsIgnore';
		const config = this.configurationService.getValue<IExtensionsConfiguration>(ConfigurationKey);
		const filteredRecs = this._allWorkspaceRecommendedExtensions.filter(rec => this.isExtensionAllowedToBeRecommended(rec.extensionId));

		if (filteredRecs.length === 0
			|| config.ignoreRecommendations
			|| config.showRecommendationsOnlyOnDemand
			|| this.storageService.getBoolean(storageKey, StorageScope.WORKSPACE, false)) {
			return;
		}

		return this.extensionsService.getInstalled(LocalExtensionType.User).done(local => {
			const recommendations = filteredRecs.filter(({ extensionId }) => local.every(local => !areSameExtensions({ id: extensionId }, { id: getGalleryExtensionIdFromLocal(local) })));

			if (!recommendations.length) {
				return TPromise.as(void 0);
			}

			return new TPromise<void>(c => {
				this.notificationService.prompt(
					Severity.Info,
					localize('workspaceRecommended', "This workspace has extension recommendations."),
					[{
						label: localize('installAll', "Install All"),
						run: () => {
							/* __GDPR__
							"extensionWorkspaceRecommendations:popup" : {
								"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
							}
							*/
							this.telemetryService.publicLog('extensionWorkspaceRecommendations:popup', { userReaction: 'install' });

							const installAllAction = this.instantiationService.createInstance(InstallWorkspaceRecommendedExtensionsAction, InstallWorkspaceRecommendedExtensionsAction.ID, localize('installAll', "Install All"), recommendations);
							installAllAction.run();
							installAllAction.dispose();

							c(void 0);
						}
					}, {
						label: localize('showRecommendations', "Show Recommendations"),
						run: () => {
							/* __GDPR__
								"extensionWorkspaceRecommendations:popup" : {
									"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
								}
							*/
							this.telemetryService.publicLog('extensionWorkspaceRecommendations:popup', { userReaction: 'show' });

							const showAction = this.instantiationService.createInstance(ShowRecommendedExtensionsAction, ShowRecommendedExtensionsAction.ID, localize('showRecommendations', "Show Recommendations"));
							showAction.run();
							showAction.dispose();

							c(void 0);
						}
					}, {
						label: choiceNever,
						isSecondary: true,
						run: () => {
							/* __GDPR__
								"extensionWorkspaceRecommendations:popup" : {
									"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
								}
							*/
							this.telemetryService.publicLog('extensionWorkspaceRecommendations:popup', { userReaction: 'neverShowAgain' });
							this.storageService.store(storageKey, true, StorageScope.WORKSPACE);

							c(void 0);
						}
					}],
					() => {
						/* __GDPR__
							"extensionWorkspaceRecommendations:popup" : {
								"userReaction" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
							}
						*/
						this.telemetryService.publicLog('extensionWorkspaceRecommendations:popup', { userReaction: 'cancelled' });

						c(void 0);
					}
				);
			});
		});
	}

	private promptIgnoreExtensionRecommendations() {
		this.notificationService.prompt(
			Severity.Info,
			localize('ignoreExtensionRecommendations', "Do you want to ignore all extension recommendations?"),
			[{
				label: localize('ignoreAll', "Yes, Ignore All"),
				run: () => this.setIgnoreRecommendationsConfig(true)
			}, {
				label: localize('no', "No"),
				run: () => this.setIgnoreRecommendationsConfig(false)
			}]
		);
	}

	private fetchExecutableRecommendations(): TPromise<any> {
		const homeDir = os.homedir();
		let foundExecutables: Set<string> = new Set<string>();

		let findExecutable = (exeName: string, path: string) => {
			return pfs.fileExists(path).then(exists => {
				if (exists && !foundExecutables.has(exeName)) {
					foundExecutables.add(exeName);
					(product.exeBasedExtensionTips[exeName]['recommendations'] || [])
						.forEach(extensionId => {
							if (product.exeBasedExtensionTips[exeName]['friendlyName']) {
								this._exeBasedRecommendations[extensionId.toLowerCase()] = product.exeBasedExtensionTips[exeName]['friendlyName'];
							}
						});
				}
			});
		};

		let promises: TPromise<any>[] = [];
		// Loop through recommended extensions
		forEach(product.exeBasedExtensionTips, entry => {
			if (typeof entry.value !== 'object' || !Array.isArray(entry.value['recommendations'])) {
				return;
			}

			let exeName = entry.key;
			if (process.platform === 'win32') {
				let windowsPath = entry.value['windowsPath'];
				if (!windowsPath || typeof windowsPath !== 'string') {
					return;
				}
				windowsPath = windowsPath.replace('%USERPROFILE%', process.env['USERPROFILE'])
					.replace('%ProgramFiles(x86)%', process.env['ProgramFiles(x86)'])
					.replace('%ProgramFiles%', process.env['ProgramFiles'])
					.replace('%APPDATA%', process.env['APPDATA']);
				promises.push(findExecutable(exeName, windowsPath));
			} else {
				promises.push(findExecutable(exeName, paths.join('/usr/local/bin', exeName)));
				promises.push(findExecutable(exeName, paths.join(homeDir, exeName)));
			}
		});

		return TPromise.join(promises);
	}

	private setIgnoreRecommendationsConfig(configVal: boolean) {
		this.configurationService.updateValue('extensions.ignoreRecommendations', configVal, ConfigurationTarget.USER);
		if (configVal) {
			const ignoreWorkspaceRecommendationsStorageKey = 'extensionsAssistant/workspaceRecommendationsIgnore';
			this.storageService.store(ignoreWorkspaceRecommendationsStorageKey, true, StorageScope.WORKSPACE);
		}
	}

	private fetchCachedDynamicWorkspaceRecommendations() {
		if (this.contextService.getWorkbenchState() !== WorkbenchState.FOLDER) {
			return;
		}

		const storageKey = 'extensionsAssistant/dynamicWorkspaceRecommendations';
		let storedRecommendationsJson = {};
		try {
			storedRecommendationsJson = JSON.parse(this.storageService.get(storageKey, StorageScope.WORKSPACE, '{}'));
		} catch (e) {
			this.storageService.remove(storageKey, StorageScope.WORKSPACE);
		}

		if (Array.isArray(storedRecommendationsJson['recommendations'])
			&& isNumber(storedRecommendationsJson['timestamp'])
			&& storedRecommendationsJson['timestamp'] > 0
			&& (Date.now() - storedRecommendationsJson['timestamp']) / milliSecondsInADay < 14) {
			this._dynamicWorkspaceRecommendations = storedRecommendationsJson['recommendations'];
			/* __GDPR__
				"dynamicWorkspaceRecommendations" : {
					"count" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
					"cache" : { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true }
				}
			*/
			this.telemetryService.publicLog('dynamicWorkspaceRecommendations', { count: this._dynamicWorkspaceRecommendations.length, cache: 1 });
		}
	}

	private fetchDynamicWorkspaceRecommendations(): TPromise<void> {
		if (this.contextService.getWorkbenchState() !== WorkbenchState.FOLDER
			|| !this.fileService.canHandleResource(this.contextService.getWorkspace().folders[0].uri)
			|| this._dynamicWorkspaceRecommendations.length
			|| !this._extensionsRecommendationsUrl) {
			return TPromise.as(null);
		}

		const storageKey = 'extensionsAssistant/dynamicWorkspaceRecommendations';
		const workspaceUri = this.contextService.getWorkspace().folders[0].uri;
		return TPromise.join([getHashedRemotesFromUri(workspaceUri, this.fileService, false), getHashedRemotesFromUri(workspaceUri, this.fileService, true)]).then(([hashedRemotes1, hashedRemotes2]) => {
			const hashedRemotes = (hashedRemotes1 || []).concat(hashedRemotes2 || []);
			if (!hashedRemotes.length) {
				return null;
			}

			return this.requestService.request({ type: 'GET', url: this._extensionsRecommendationsUrl }).then(context => {
				if (context.res.statusCode !== 200) {
					return TPromise.as(null);
				}
				return asJson(context).then((result) => {
					const allRecommendations: IDynamicWorkspaceRecommendations[] = Array.isArray(result['workspaceRecommendations']) ? result['workspaceRecommendations'] : [];
					if (!allRecommendations.length) {
						return;
					}

					let foundRemote = false;
					for (let i = 0; i < hashedRemotes.length && !foundRemote; i++) {
						for (let j = 0; j < allRecommendations.length && !foundRemote; j++) {
							if (Array.isArray(allRecommendations[j].remoteSet) && allRecommendations[j].remoteSet.indexOf(hashedRemotes[i]) > -1) {
								foundRemote = true;
								this._dynamicWorkspaceRecommendations = allRecommendations[j].recommendations.filter(id => this.isExtensionAllowedToBeRecommended(id)) || [];
								this.storageService.store(storageKey, JSON.stringify({
									recommendations: this._dynamicWorkspaceRecommendations,
									timestamp: Date.now()
								}), StorageScope.WORKSPACE);
								/* __GDPR__
									"dynamicWorkspaceRecommendations" : {
										"count" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" },
										"cache" : { "classification": "SystemMetaData", "purpose": "FeatureInsight" }
									}
								*/
								this.telemetryService.publicLog('dynamicWorkspaceRecommendations', { count: this._dynamicWorkspaceRecommendations.length, cache: 0 });
							}
						}
					}
				});
			});
		});
	}

	private fetchExperimentalRecommendations() {
		// // {{SQL CARBON EDIT}} disable experiements
		// this.experimentService.getExperimentsByType(ExperimentActionType.AddToRecommendations).then(experiments => {
		// 	(experiments || []).forEach(experiment => {
		// 		if (experiment.state === ExperimentState.Run && experiment.action.properties && Array.isArray(experiment.action.properties.recommendations) && experiment.action.properties.recommendationReason) {
		// 			experiment.action.properties.recommendations.forEach(id => {
		// 				this._experimentalRecommendations[id] = experiment.action.properties.recommendationReason;
		// 			});
		// 		}
		// 	});
		// });
	}

	getKeywordsForExtension(extension: string): string[] {
		const keywords = product.extensionKeywords || {};
		return keywords[extension] || [];
	}

	toggleIgnoredRecommendation(extensionId: string, shouldIgnore: boolean) {
		const lowerId = extensionId.toLowerCase();
		if (shouldIgnore) {
			const reason = this.getAllRecommendationsWithReason()[lowerId];
			if (reason && reason.reasonId) {
				/* __GDPR__
					"extensionsRecommendations:ignoreRecommendation" : {
						"recommendationReason": { "classification": "SystemMetaData", "purpose": "FeatureInsight", "isMeasurement": true },
						"extensionId": { "classification": "PublicNonPersonalData", "purpose": "FeatureInsight" }
					}
				*/
				this.telemetryService.publicLog('extensionsRecommendations:ignoreRecommendation', { id: extensionId, recommendationReason: reason.reasonId });
			}
		}

		this._globallyIgnoredRecommendations = shouldIgnore ?
			distinct([...this._globallyIgnoredRecommendations, lowerId].map(id => id.toLowerCase())) :
			this._globallyIgnoredRecommendations.filter(id => id !== lowerId);

		this.storageService.store('extensionsAssistant/ignored_recommendations', JSON.stringify(this._globallyIgnoredRecommendations), StorageScope.GLOBAL);
		this._allIgnoredRecommendations = distinct([...this._globallyIgnoredRecommendations, ...this._workspaceIgnoredRecommendations]);

		this._onRecommendationChange.fire({ extensionId: extensionId, isRecommended: !shouldIgnore });
	}

	dispose() {
		this._disposables = dispose(this._disposables);
	}
}
