/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export class DataCache<T> {

	millisecondsToLive: number;
	getValueFunction: (...args: any[]) => T;
	cache: T;
	fetchDate: Date;

	constructor(getValueFunction: (...args: any[]) => T, secondsToLive: number) {
		this.millisecondsToLive = secondsToLive * 1000;
		this.getValueFunction = getValueFunction;
		this.cache = undefined;
		this.fetchDate = new Date(0);
	}

	public isCacheExpired(): boolean {
		return (this.fetchDate.getTime() + this.millisecondsToLive) < new Date().getTime();
	}

	public getData(...args: any[]): T {
		if (!this.cache || this.isCacheExpired()) {
			console.log('expired - fetching new data');
			let data = this.getValueFunction(...args);
			this.cache = data;
			this.fetchDate = new Date();
			return data;
		} else {
			console.log('cache hit');
			return this.cache;
		}
	}

	public resetCache(): void {
		this.fetchDate = new Date(0);
	}
}
