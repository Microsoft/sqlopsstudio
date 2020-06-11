/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Application } from '../../../../../automation';

export function setup() {
	describe('Query Editor', () => {

		it('can open, connect and execute file', async function () {
			const app = this.app as Application;
			await app.workbench.quickaccess.openFile('test.sql');
			await app.workbench.queryEditor.commandBar.clickButton(3);
			await app.workbench.connectionDialog.waitForConnectionDialog();
			await app.workbench.connectionDialog.setProvider('Sqlite');
			await app.workbench.connectionDialog.setTarget('File', 'chinook.db');
			await app.workbench.connectionDialog.connect();
			await app.workbench.queryEditor.commandBar.clickButton(1);
			await app.workbench.queryEditor.waitForResults();
			await app.workbench.quickaccess.runCommand('workbench.action.closeActiveEditor');
		});

		it('can new file, connect and execute', async function () {
			const app = this.app as Application;
			await app.workbench.queryEditors.newUntitledQuery();
			const untitled = 'SQLQuery_1';
			await app.workbench.editor.waitForTypeInEditor(untitled, 'select * from employees');
			await app.workbench.queryEditor.commandBar.clickButton(3);
			await app.workbench.connectionDialog.waitForConnectionDialog();
			await app.workbench.connectionDialog.setProvider('Sqlite');
			await app.workbench.connectionDialog.setTarget('File', 'chinook.db');
			await app.workbench.connectionDialog.connect();
			await app.workbench.queryEditor.commandBar.clickButton(1);
			await app.workbench.queryEditor.waitForResults();
			await app.workbench.quickaccess.runCommand('workbench.action.closeActiveEditor');
		});
	});
}
