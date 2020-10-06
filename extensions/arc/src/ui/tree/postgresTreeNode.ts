/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ResourceType } from 'arc';
import * as vscode from 'vscode';
import { ControllerModel } from '../../models/controllerModel';
import { PostgresModel } from '../../models/postgresModel';
import { PostgresDashboard } from '../dashboards/postgres/postgresDashboard';
import { ResourceTreeNode } from './resourceTreeNode';

/**
 * The TreeNode for displaying an Postgres Server group
 */
export class PostgresTreeNode extends ResourceTreeNode {

	constructor(model: PostgresModel, private _controllerModel: ControllerModel, private _context: vscode.ExtensionContext) {
		super(model.info.name, vscode.TreeItemCollapsibleState.None, ResourceType.postgresInstances, model);
	}

	public async openDashboard(): Promise<void> {
		const postgresDashboard = new PostgresDashboard(this._context, this._controllerModel, this.model as PostgresModel);
		await postgresDashboard.showDashboard();
	}
}
