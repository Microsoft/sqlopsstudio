/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import * as filters from 'vs/base/common/filters';
import { data } from './filters.perf.data';

const patterns = ['cci', 'ida', 'pos', 'CCI', 'enbled', 'callback', 'gGame', 'cons'];

const _enablePerf = false;

function perfSuite(name: string, callback: (this: Mocha.ISuiteCallbackContext) => void) {
	if (_enablePerf) {
		suite(name, callback);
	}
}

perfSuite('Performance - fuzzyMatch', function () {

	console.log(`Matching ${data.length} items against ${patterns.length} patterns...`);

	function perfTest(name: string, match: (pattern: string, word: string) => any) {
		test(name, function () {

			const t1 = Date.now();
			let count = 0;
			for (const pattern of patterns) {
				for (const item of data) {
					count += 1;
					match(pattern, item);
				}
			}
			console.log(name, Date.now() - t1, `${(count / (Date.now() - t1)).toPrecision(6)}/ms`);
		});
	}

	perfTest('matchesFuzzy', filters.matchesFuzzy);
	perfTest('fuzzyContiguousFilter', filters.fuzzyContiguousFilter);
	perfTest('fuzzyScore', filters.fuzzyScore);
	perfTest('fuzzyScoreGraceful', filters.fuzzyScoreGraceful);

});

