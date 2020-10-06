/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceType } from 'arc';
import * as vscode from 'vscode';
import { ControllerModel } from '../../models/controllerModel';
import { MiaaModel } from '../../models/miaaModel';
import { MiaaDashboard } from '../dashboards/miaa/miaaDashboard';
import { ResourceTreeNode } from './resourceTreeNode';

/**
 * The TreeNode for displaying a SQL Managed Instance on Azure Arc
 */
export class MiaaTreeNode extends ResourceTreeNode {

	constructor(model: MiaaModel, private _controllerModel: ControllerModel) {
		super(model.info.name, vscode.TreeItemCollapsibleState.None, ResourceType.sqlManagedInstances, model);
	}

	public async openDashboard(): Promise<void> {
		const miaaDashboard = new MiaaDashboard(this._controllerModel, this.model as MiaaModel);
		await miaaDashboard.showDashboard();
	}
}
