/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { extHostNamedCustomer } from 'vs/workbench/api/common/extHostCustomers';
import { MainContext, MainThreadKeytarShape, IExtHostContext } from 'vs/workbench/api/common/extHost.protocol';
import { ICredentialsService } from 'vs/workbench/services/credentials/common/credentials';

@extHostNamedCustomer(MainContext.MainThreadKeytar)
export class MainThreadKeytar implements MainThreadKeytarShape {

	constructor(
		_extHostContext: IExtHostContext,
		@ICredentialsService private readonly _credentialsService: ICredentialsService,
	) { }

	async $getPassword(service: string, account: string): Promise<string | null> {
		return this._credentialsService.getPassword(service, account);
	}

	async $setPassword(service: string, account: string, password: string): Promise<void> {
		return this._credentialsService.setPassword(service, account, password);
	}

	async $deletePassword(service: string, account: string): Promise<boolean> {
		return this._credentialsService.deletePassword(service, account);
	}

	async $findPassword(service: string): Promise<string | null> {
		return this._credentialsService.findPassword(service);
	}

	dispose(): void {
		//
	}
}
