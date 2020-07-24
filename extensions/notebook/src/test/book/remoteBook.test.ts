/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { RemoteBookDialog } from '../../dialog/remoteBookDialog';
import { RemoteBookDialogModel } from '../../dialog/remoteBookDialogModel';
import { IRelease, RemoteBookController } from '../../book/remoteBookController';
import * as should from 'should';
import * as request from 'request';
import * as sinon from 'sinon';
import * as utils from '../../common/utils';
import * as vscode from 'vscode';
import { MockExtensionContext } from '../common/stubs';
import { AppContext } from '../../common/appContext';
import * as loc from '../../common/localizedConstants';

describe('Add Remote Book Dialog', function () {
	let mockExtensionContext: vscode.ExtensionContext = new MockExtensionContext();
	let appContext = new AppContext(mockExtensionContext);
	let model = new RemoteBookDialogModel();
	let controller = new RemoteBookController(model, appContext.outputChannel);
	let dialog = new RemoteBookDialog(controller);
	let sinonTest: sinon.SinonStub;

	beforeEach(function (): void {
		sinonTest = sinon.stub(request, 'get');
	});

	afterEach(function (): void {
		sinonTest.restore();
	});

	it('Should open dialog successfully ', async function (): Promise<void> {
		const spy = sinon.spy(dialog, 'createDialog');
		await dialog.createDialog();
		should(spy.calledOnce).be.true();
	});

	it('Verify that errorMessage is thrown, when fetchReleases call returns empty', async function (): Promise<void> {
		let expectedBody = JSON.stringify([]);
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases');
		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		try {
			let result = await controller.getReleases(expectedURL);
			should(result.length).be.equal(0, 'Result should be equal to the expectedBody');
		}
		catch (err) {
			should(err.message).be.equals(loc.msgReleaseNotFound);
			should(model.releases.length).be.equal(0);
		}
	});

	it('Should get the books with the same format as the user OS platform', async function (): Promise<void> {
		let expectedBody = JSON.stringify([
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/1',
				name: 'test-1.1-EN.zip',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1-EN.zip',

			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/2',
				name: 'test-1.1-ES.zip',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/2/test-1.1-ES.zip',
			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/1',
				name: 'test-1.1-EN.tgz',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1-EN.tgz',

			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/2',
				name: 'test-1.1-ES.tar.gz',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/2/test-1.1-ES.tar.gz',
			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/3',
				name: 'test-1.1-FR.tgz',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1-FR.tgz',
			}
		]);
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases/1/assets');
		let expectedRelease: IRelease = {
			name: 'Test Release',
			assetsUrl: expectedURL
		};
		let sinonTestUtils = sinon.stub(utils, 'getOSPlatform').returns((utils.Platform.Linux));

		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		let result = await controller.getAssets(expectedRelease);
		should(result.length).be.equal(3, 'Should get the files based on the OS platform');
		result.forEach(asset => {
			should(asset).have.property('name');
			should(asset).have.property('url');
			should(asset).have.property('browserDownloadUrl');
			should(asset.format).be.oneOf(['tgz', 'tar.gz']);
		});
		sinonTestUtils.restore();
	});

	it('Should throw an error if the book object does not follow the name-version-lang format', async function (): Promise<void> {
		let expectedBody = JSON.stringify([
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/1',
				name: 'test-1.1.zip',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.1.zip',

			},
			{
				url: 'https://api.github.com/repos/microsoft/test/releases/1/assets/2',
				name: 'test-1.2.zip',
				browser_download_url: 'https://api.github.com/repos/microsoft/test/releases/download/1/test-1.2.zip',
			},
		]);
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases/1/assets');
		let expectedRelease: IRelease = {
			name: 'Test Release',
			assetsUrl: expectedURL
		};
		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		try {
			let result = await controller.getAssets(expectedRelease);
			should(result.length).be.equal(0, 'Should be empty when the naming convention is not being followed');
		}
		catch (err) {
			should(err.message).be.equals(loc.msgBookNotFound);
			should(model.releases.length).be.equal(0);
		}
	});

	it('Should throw an error if no books are found', async function (): Promise<void> {
		let expectedBody = JSON.stringify([]);
		let expectedURL = new URL('https://api.github.com/repos/microsoft/test/releases/1/assets');
		let expectedRelease: IRelease = {
			name: 'Test Release',
			assetsUrl: expectedURL
		};
		sinonTest.yields(null, { statusCode: 200 }, expectedBody);

		try {
			let result = await controller.getAssets(expectedRelease);
			should(result.length).be.equal(0, 'Should be empty since no assets were returned');
		}
		catch (err) {
			should(err.message).be.equals(loc.msgBookNotFound);
			should(model.releases.length).be.equal(0);
		}
	});
});

