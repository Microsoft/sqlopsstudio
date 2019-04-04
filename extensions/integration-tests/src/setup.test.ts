/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import 'mocha';
import * as vscode from 'vscode';
import { context } from './testContext';
import assert = require('assert');
import { getEnvironmentVariable, EnvironmentVariable_BDC_SERVER, EnvironmentVariable_BDC_USERNAME, EnvironmentVariable_BDC_PASSWORD, EnvironmentVariable_AZURE_PASSWORD, EnvironmentVariable_AZURE_SERVER, EnvironmentVariable_AZURE_USERNAME, EnvironmentVariable_STANDALONE_PASSWORD, EnvironmentVariable_STANDALONE_SERVER, EnvironmentVariable_STANDALONE_USERNAME, EnvironmentVariable_PYTHON_PATH } from './utils';

assert(getEnvironmentVariable(EnvironmentVariable_BDC_SERVER) !== undefined &&
	getEnvironmentVariable(EnvironmentVariable_BDC_USERNAME) !== undefined &&
	getEnvironmentVariable(EnvironmentVariable_BDC_PASSWORD) !== undefined &&
	getEnvironmentVariable(EnvironmentVariable_AZURE_PASSWORD) !== undefined &&
	getEnvironmentVariable(EnvironmentVariable_AZURE_SERVER) !== undefined &&
	getEnvironmentVariable(EnvironmentVariable_AZURE_USERNAME) !== undefined &&
	getEnvironmentVariable(EnvironmentVariable_STANDALONE_PASSWORD) !== undefined &&
	getEnvironmentVariable(EnvironmentVariable_STANDALONE_SERVER) !== undefined &&
	getEnvironmentVariable(EnvironmentVariable_STANDALONE_USERNAME) !== undefined &&
	getEnvironmentVariable(EnvironmentVariable_PYTHON_PATH) !== undefined, 'Required environment variables are not set, if you see this error in the build pipeline, make sure the environment variables are set properly in the build definition, otherwise for local dev environment make sure you follow the instructions in the readme file.');

if (!context.RunTest) {
	suite('integration test setup', () => {
		test('test setup', async function () {
			//Prepare the environment and make it ready for testing
			await vscode.commands.executeCommand('test.setupIntegrationTest');
			//Reload the window, this is required for some changes made by the 'test.setupIntegrationTest' to work
			await vscode.commands.executeCommand('workbench.action.reloadWindow');
		});
	});
}