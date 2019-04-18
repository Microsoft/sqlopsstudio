/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import { IssueReporterModel } from 'vs/code/electron-browser/issue/issueReporterModel';
import { normalizeGitHubUrl } from 'vs/code/electron-browser/issue/issueReporterUtil';
import { IssueType } from 'vs/platform/issue/common/issue';

suite('IssueReporter', () => {

	test('sets defaults to include all data', () => {
		const issueReporterModel = new IssueReporterModel();
		assert.deepEqual(issueReporterModel.getData(), {
			allExtensions: [],
			includeSystemInfo: true,
			includeWorkspaceInfo: true,
			includeProcessInfo: true,
			includeExtensions: true,
			includeSearchedExtensions: true,
			includeSettingsSearchDetails: true,
			issueType: 0
		});
	});

	// {{SQL CARBON EDIT}}
	test('serializes model skeleton when no data is provided', () => {
		const issueReporterModel = new IssueReporterModel({});
		assert.equal(issueReporterModel.serialize(),
			`
Issue Type: <b>Bug</b>

undefined

Azure Data Studio version: undefined
OS version: undefined

Extensions: none
<!-- generated by issue reporter -->`);
	});

	test('serializes GPU information when data is provided', () => {
		const issueReporterModel = new IssueReporterModel({
			issueType: 0,
			systemInfo: {
				os: 'Darwin',
				cpus: 'Intel(R) Core(TM) i7-7700HQ CPU @ 2.80GHz (8 x 2800)',
				memory: '16.00GB',
				vmHint: '0%',
				processArgs: '',
				screenReader: 'no',
				remoteData: [],
				gpuStatus: {
					'2d_canvas': 'enabled',
					'checker_imaging': 'disabled_off'
				}
			}
		});
		assert.equal(issueReporterModel.serialize(),
			// {{SQL CARBON EDIT}}
			`
Issue Type: <b>Bug</b>

undefined

Azure Data Studio version: undefined
OS version: undefined

<details>
<summary>System Info</summary>

|Item|Value|
|---|---|
|CPUs|Intel(R) Core(TM) i7-7700HQ CPU @ 2.80GHz (8 x 2800)|
|GPU Status|2d_canvas: enabled<br>checker_imaging: disabled_off|
|Load (avg)|undefined|
|Memory (System)|16.00GB|
|Process Argv||
|Screen Reader|no|
|VM|0%|
</details>Extensions: none
<!-- generated by issue reporter -->`);
	});

	// {{SQL CARBON EDIT}} - remove VS Code test that isn't valid in ADS context

	test('should normalize GitHub urls', () => {
		[
			'https://github.com/repo',
			'https://github.com/repo/',
			'https://github.com/repo.git',
			'https://github.com/repo/issues',
			'https://github.com/repo/issues/',
			'https://github.com/repo/issues/new',
			'https://github.com/repo/issues/new/'
		].forEach(url => {
			assert.equal('https://github.com/repo', normalizeGitHubUrl(url));
		});
	});

	test('should have support for filing on extensions for bugs, performance issues, and feature requests', () => {
		[
			IssueType.Bug,
			IssueType.FeatureRequest,
			IssueType.PerformanceIssue
		].forEach(type => {
			const issueReporterModel = new IssueReporterModel({
				issueType: type,
				fileOnExtension: true
			});

			assert.equal(issueReporterModel.fileOnExtension(), true);
		});

		[
			IssueType.SettingsSearchIssue
		].forEach(type => {
			const issueReporterModel = new IssueReporterModel({
				issueType: type,
				fileOnExtension: true
			});

			assert.equal(issueReporterModel.fileOnExtension(), false);
		});
	});
});
