/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as azdataExt from 'azdata-ext';
import * as azurecore from 'azurecore';
import * as vscode from 'vscode';

export interface IApiService {
	readonly azurecoreApi: azurecore.IExtension;
	readonly azdataApi: azdataExt.IExtension;
}

class ApiService implements IApiService {
	constructor() { }
	public get azurecoreApi() { return vscode.extensions.getExtension(azurecore.extension.name)?.exports; }
	public get azdataApi() { return vscode.extensions.getExtension(azdataExt.extension.name)?.exports; }
}

export const apiService: IApiService = new ApiService();
