/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type * as azdataType from 'azdata';
import { DataSource } from './dataSources';
import * as constants from '../../common/constants';

/**
 * Contains information about a SQL connection string data source`
 */
export class SqlConnectionDataSource extends DataSource {
	readonly connectionString: string;
	readonly connectionStringComponents: { [id: string]: string } = {};

	public static get type() {
		return 'sql_connection_string';
	}

	public get type(): string {
		return SqlConnectionDataSource.type;
	}

	public get typeFriendlyName(): string {
		return constants.sqlConnectionStringFriendly;
	}

	public get server(): string {
		return this.getSetting(constants.dataSourceSetting);
	}

	public get database(): string {
		return this.getSetting(constants.initialCatalogSetting);
	}

	public get integratedSecurity(): boolean {
		return this.getSetting(constants.integratedSecuritySetting)?.toLowerCase() === 'true';
	}

	public get azureMFA(): boolean {
		return this.getSetting(constants.authenticationSetting)?.toLowerCase().includes(constants.activeDirectoryInteractive);
	}

	public get authType(): string {
		if (this.azureMFA) {
			return constants.azureMfaAuth;
		} else if (this.integratedSecurity) {
			return constants.integratedAuth;
		} else {
			return constants.sqlAuth;
		}
	}

	public get username(): string {
		return this.getSetting(constants.userIdSetting);
	}

	public get password(): string {
		// TODO: secure password storage; https://github.com/microsoft/azuredatastudio/issues/10561
		return this.getSetting(constants.passwordSetting);
	}

	constructor(name: string, connectionString: string) {
		super(name);

		// TODO: do we have a common construct for connection strings?
		this.connectionString = connectionString;

		const components = this.connectionString.split(';').filter(c => c !== '');
		for (const component of components) {
			const split = component.split('=');

			if (split.length !== 2) {
				throw new Error(constants.invalidSqlConnectionString);
			}

			this.connectionStringComponents[split[0].toLocaleLowerCase()] = split[1];
		}
	}

	public getSetting(settingName: string): string {
		return this.connectionStringComponents[settingName.toLocaleLowerCase()];
	}

	public static fromJson(json: DataSourceJson): SqlConnectionDataSource {
		return new SqlConnectionDataSource(json.name, (json.data as unknown as SqlConnectionDataSourceJson).connectionString);
	}

	public getConnectionProfile(): azdataType.IConnectionProfile {
		const connProfile: azdataType.IConnectionProfile = {
			serverName: this.server,
			databaseName: this.database,
			connectionName: this.name,
			userName: this.username,
			password: this.password,
			authenticationType: this.authType,
			savePassword: false,
			providerName: 'MSSQL',
			saveProfile: true,
			id: this.name + '-dataSource',
			options: []
		};

		return connProfile;
	}
}

/**
 * JSON structure for a SQL connection string data source
 */
interface SqlConnectionDataSourceJson {
	connectionString: string;
}
