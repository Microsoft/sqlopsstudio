/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as sqlops from 'sqlops';

import { Action } from 'vs/base/common/actions';
import { TPromise } from 'vs/base/common/winjs.base';
import { localize } from 'vs/nls';
import { IContextViewProvider } from 'vs/base/browser/ui/contextview/contextview';

import { SelectBox } from 'sql/base/browser/ui/selectBox/selectBox';
import { INotebookModel } from 'sql/parts/notebook/models/modelInterfaces';
import { CellTypes, CellType } from 'sql/parts/notebook/models/contracts';
import { NotebookComponent } from 'sql/parts/notebook/notebook.component';
import { INotificationService, Severity } from 'vs/platform/notification/common/notification';
import { NotificationService } from 'vs/workbench/services/notification/common/notificationService';

const msgLoading = localize('loading', 'Loading kernels...');

//Action to add a cell to notebook based on cell type(code/markdown).
export class AddCellAction extends Action {
	public cellType: CellType;

	constructor(
		id: string, label: string, cssClass: string
	) {
		super(id, label, cssClass);
	}
	public run(context: NotebookComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				context.addCell(this.cellType);
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}

export class TrustedAction extends Action {
	private static readonly trustLabel = localize('trustLabel', 'Trusted');
	private static readonly notTrustLabel = localize('untrustLabel', 'Not Trusted');
	private static readonly alreadyTrustedMsg = localize('alreadyTrustedMsg', 'Notebook is already trusted.');

	constructor(
		id: string, isTrusted: boolean
	) {
		if (isTrusted) {
			super(id, TrustedAction.trustLabel, 'notebook-button icon-trusted');
		}
		else {
			super(id, TrustedAction.notTrustLabel, 'notebook-button icon-notTrusted');
		}
	}
	public run(context: NotebookComponent): TPromise<boolean> {
		return new TPromise<boolean>((resolve, reject) => {
			try {
				if (context._model.trustedMode) {
					 let notificationService = new NotificationService();
					 notificationService.notify({severity: Severity.Info, message: TrustedAction.alreadyTrustedMsg});
				}
				else {
					context.updateModelTrustDetails(!context._model.trustedMode);
					this._setLabel(TrustedAction.trustLabel);
					this._setClass('notebook-button icon-trusted');
				}
				resolve(true);
			} catch (e) {
				reject(e);
			}
		});
	}
}


export class KernelsDropdown extends SelectBox {
	private model: INotebookModel;
	constructor(contextViewProvider: IContextViewProvider, modelRegistered: Promise<INotebookModel>
	) {
		super( [msgLoading], msgLoading, contextViewProvider);
		if (modelRegistered) {
			modelRegistered
			.then((model) => this.updateModel(model))
			.catch((err) => {
				// No-op for now
			});
		}

		this.onDidSelect(e => this.doChangeKernel(e.selected));
	}

	updateModel(model: INotebookModel): void {
		this.model = model;
		model.kernelsChanged((defaultKernel) => {
			this.updateKernel(defaultKernel);
		});
		if (model.clientSession) {
			model.clientSession.kernelChanged((changedArgs: sqlops.nb.IKernelChangedArgs) => {
				if (changedArgs.newValue) {
					this.updateKernel(changedArgs.newValue);
				}
			});
		}
	}

	// Update SelectBox values
	private updateKernel(defaultKernel: sqlops.nb.IKernelSpec) {
		let specs = this.model.specs;
		if (specs && specs.kernels) {
			let index = specs.kernels.findIndex((kernel => kernel.name === defaultKernel.name));
			this.setOptions(specs.kernels.map(kernel => kernel.display_name), index);
		}
	}

	public doChangeKernel(displayName: string): void {
		this.model.changeKernel(displayName);
	}
}

export class AttachToDropdown extends SelectBox {
	constructor(contextViewProvider: IContextViewProvider
	) {
		let options: string[] = ['localhost'];
		super(options, 'localhost', contextViewProvider);
	}
}