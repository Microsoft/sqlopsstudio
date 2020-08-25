/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import { SemVer } from 'semver';
import * as should from 'should';
import * as sinon from 'sinon';
import * as TypeMoq from 'typemoq';
import * as vscode from 'vscode';
import * as azdata from '../azdata';
import * as childProcess from '../common/childProcess';
import { HttpClient } from '../common/httpClient';
import * as utils from '../common/utils';
import * as loc from '../localizedConstants';
import * as constants from '../constants';

const outputChannelMock = TypeMoq.Mock.ofType<vscode.OutputChannel>();
const oldAzdata = new azdata.AzdataTool('', new SemVer('0.0.0'), outputChannelMock.object);

describe('azdata', function () {
	afterEach(function (): void {
		sinon.restore();
	});

	describe('findAzdata', function () {
		it('successful', async function (): Promise<void> {
			if (process.platform === 'win32') {
				// Mock searchForCmd to return a path to azdata.cmd
				sinon.stub(utils, 'searchForCmd').returns(Promise.resolve('C:\\path\\to\\azdata.cmd'));
			}
			// Mock call to --version to simulate azdata being installed
			sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve({ stdout: 'v1.0.0', stderr: '' }));
			await should(azdata.findAzdata(outputChannelMock.object)).not.be.rejected();
		});
		it('unsuccessful', async function (): Promise<void> {
			if (process.platform === 'win32') {
				// Mock searchForCmd to return a failure to find azdata.cmd
				sinon.stub(utils, 'searchForCmd').returns(Promise.reject(new Error('Could not find azdata')));
			} else {
				// Mock call to executeCommand to simulate azdata --version returning error
				sinon.stub(childProcess, 'executeCommand').returns(Promise.reject({ stdout: '', stderr: 'command not found: azdata' }));
			}
			await should(azdata.findAzdata(outputChannelMock.object)).be.rejected();
		});
	});

	describe('installAzdata', function (): void {
		it('successful install', async function (): Promise<void> {
			switch (process.platform) {
				case 'win32':
					await testWin32SuccessfulInstall();
					break;
				case 'darwin':
					await testDarwinSuccessfulInstall();
					break;
				case 'linux':
					await testLinuxSuccessfulInstall();
					break;
			}
		});

		if (process.platform === 'win32') {
			it('unsuccessful download - win32', async function (): Promise<void> {
				sinon.stub(HttpClient, 'downloadFile').rejects();
				const downloadPromise = azdata.installAzdata(outputChannelMock.object);
				await should(downloadPromise).be.rejected();
			});
		}

		it('unsuccessful install', async function (): Promise<void> {
			switch (process.platform) {
				case 'win32':
					await testWin32UnsuccessfulInstall();
					break;
				case 'darwin':
					await testDarwinUnsuccessfulInstall();
					break;
				case 'linux':
					await testLinuxUnsuccessfulInstall();
					break;
			}
		});
	});

	describe('upgradeAzdata', function (): void {
		beforeEach(function (): void {
			// const mock = TypeMoq.Mock.ofInstance(azdata.discoverLatestAvailableAzdataVersion)
			// 	.setup(x => x(TypeMoq.It.isAny()))
			// 	.returns(() => Promise.resolve(Promise.resolve(new SemVer('9999.999.999'))));
			// mock.
			sinon.stub(azdata, 'discoverLatestAvailableAzdataVersion').returns(Promise.resolve(new SemVer('9999.999.999')));
			sinon.stub(vscode.window, 'showInformationMessage').returns(Promise.resolve(<any>loc.yes));
		});

		it('successful upgrade', async function (): Promise<void> {
			const releaseJson = {
				win32: {
					'version': '9999.999.999',
					'link': 'https://download.com/azdata-20.0.1.msi'
				},
				darwin: {
					'version': '9999.999.999'
				},
				linux: {
					'version': '9999.999.999'
				}
			};
			switch (process.platform) {
				case 'win32':
					await testWin32SuccessfulUpgrade(releaseJson);
					break;

				case 'darwin':
					await testDarwinSuccessfulUpgrade();
					break;
				case 'linux':
					await testLinuxSuccessfulUpgrade(releaseJson);
					break;
			}
		});


		it('unsuccessful upgrade', async function (): Promise<void> {
			switch (process.platform) {
				case 'win32':
					await testWin32UnsuccessfulUpgrade();
					break;
				case 'darwin':
					await testDarwinUnsuccessfulUpgrade();
					break;

				case 'linux':
					await testLinuxUnsuccessfulUpgrade();
			}
		});

		describe('discoverLatestAvailableAzdataVersion', function (): void {
			this.timeout(20000);
			it(`finds latest available version of azdata successfully`, async function (): Promise<void> {
				// if the latest version is not discovered then the following call throws failing the test
				await azdata.discoverLatestAvailableAzdataVersion(outputChannelMock.object);
			});
		});
	});
});

async function testLinuxUnsuccessfulUpgrade() {
	const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').rejects();
	const upgradePromise = azdata.checkAndUpgradeAzdata(oldAzdata, outputChannelMock.object);
	await should(upgradePromise).be.rejected();
	should(executeSudoCommandStub.calledOnce).be.true();
}

async function testDarwinUnsuccessfulUpgrade() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').rejects();
	const upgradePromise = azdata.checkAndUpgradeAzdata(oldAzdata, outputChannelMock.object);
	await should(upgradePromise).be.rejected();
	should(executeCommandStub.calledOnce).be.true();
}

async function testWin32UnsuccessfulUpgrade() {
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	sinon.stub(childProcess, 'executeCommand').rejects();
	const upgradePromise = azdata.checkAndUpgradeAzdata(oldAzdata, outputChannelMock.object);
	await should(upgradePromise).be.rejected();
}

async function testLinuxSuccessfulUpgrade(releaseJson: { win32: { version: string; }; darwin: { version: string; }; linux: { version: string; }; }) {
	sinon.stub(HttpClient, 'getTextContent').returns(Promise.resolve(JSON.stringify(releaseJson)));
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve({ stdout: 'success', stderr: '' }));
	const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').returns(Promise.resolve({ stdout: 'success', stderr: '' }));
	await azdata.checkAndUpgradeAzdata(oldAzdata, outputChannelMock.object);
	should(executeSudoCommandStub.callCount).be.equal(6);
	should(executeCommandStub.calledOnce).be.true();
}

async function testDarwinSuccessfulUpgrade() {
	const brewInfoOutput = [{
		name: 'azdata-cli',
		full_name: 'microsoft/azdata-cli-release/azdata-cli',
		versions: {
			'stable': '9999.999.999',
			'devel': null,
			'head': null,
			'bottle': true
		}
	}];
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand')
		.onSecondCall() //second call is brew info azdata-cli --json which needs to return json of new available azdata versions.
		.callsFake(async (command: string, args: string[]) => {
			should(command).be.equal('brew');
			should(args).deepEqual(['info', 'azdata-cli', '--json']);
			return Promise.resolve({
				stderr: '',
				stdout: JSON.stringify(brewInfoOutput)
			});
		})
		.callsFake(async (_command: string, _args: string[]) => { // return success on all other command executions
			return Promise.resolve({ stdout: 'success', stderr: '' });
		});
	await azdata.checkAndUpgradeAzdata(oldAzdata, outputChannelMock.object);
	should(executeCommandStub.calledThrice);
}

async function testWin32SuccessfulUpgrade(releaseJson: { win32: { version: string; link: string; }; darwin: { version: string; }; linux: { version: string; }; }) {
	sinon.stub(HttpClient, 'getTextContent').returns(Promise.resolve(JSON.stringify(releaseJson)));
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').callsFake(async (command: string, args: string[]) => {
		should(command).be.equal('msiexec');
		should(args[0]).be.equal('/qn');
		should(args[1]).be.equal('/i');
		should(path.basename(args[2])).be.equal(constants.azdataUri);
		return { stdout: 'success', stderr: '' };
	});
	await azdata.checkAndUpgradeAzdata(oldAzdata, outputChannelMock.object);
	should(executeCommandStub.calledOnce).be.true();
}

async function testWin32SuccessfulInstall() {
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').callsFake(async (command: string, args: string[]) => {
		should(command).be.equal('msiexec');
		should(args[0]).be.equal('/qn');
		should(args[1]).be.equal('/i');
		should(path.basename(args[2])).be.equal(constants.azdataUri);
		return { stdout: 'success', stderr: '' };
	});
	await azdata.installAzdata(outputChannelMock.object);
	should(executeCommandStub.calledOnce).be.true();
}

async function testDarwinSuccessfulInstall() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').callsFake(async (command: string, _args: string[]) => {
		should(command).be.equal('brew');
		return { stdout: 'success', stderr: '' };
	});
	await azdata.installAzdata(outputChannelMock.object);
	should(executeCommandStub.calledThrice).be.true();
}

async function testLinuxSuccessfulInstall() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').returns(Promise.resolve({ stdout: 'success', stderr: '' }));
	const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').returns(Promise.resolve({ stdout: 'success', stderr: '' }));
	await azdata.installAzdata(outputChannelMock.object);
	should(executeSudoCommandStub.callCount).be.equal(6);
	should(executeCommandStub.calledOnce).be.true();
}

async function testLinuxUnsuccessfulInstall() {
	const executeSudoCommandStub = sinon.stub(childProcess, 'executeSudoCommand').rejects();
	const downloadPromise = azdata.installAzdata(outputChannelMock.object);
	await should(downloadPromise).be.rejected();
	should(executeSudoCommandStub.calledOnce).be.true();
}

async function testDarwinUnsuccessfulInstall() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').rejects();
	const downloadPromise = azdata.installAzdata(outputChannelMock.object);
	await should(downloadPromise).be.rejected();
	should(executeCommandStub.calledOnce).be.true();
}

async function testWin32UnsuccessfulInstall() {
	const executeCommandStub = sinon.stub(childProcess, 'executeCommand').rejects();
	sinon.stub(HttpClient, 'downloadFile').returns(Promise.resolve(__filename));
	const downloadPromise = azdata.installAzdata(outputChannelMock.object);
	await should(downloadPromise).be.rejected();
	should(executeCommandStub.calledOnce).be.true();
}
