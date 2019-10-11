/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { EOL } from 'os';
import * as path from 'path';
import { SemVer } from 'semver';
import * as nls from 'vscode-nls';
import { Command, OsType, ToolType } from '../../interfaces';
import { IPlatformService } from '../platformService';
import { ToolBase } from './toolBase';

const localize = nls.loadMessageBundle();
const installationRoot = '~/.local/bin';

export class AzdataTool extends ToolBase {
	constructor(platformService: IPlatformService) {
		super(platformService);
	}

	get name(): string {
		return 'azdata';
	}

	get description(): string {
		return localize('resourceDeployment.AzdataDescription', "A command-line utility written in Python that enables cluster administrators to bootstrap and manage the big data cluster via REST APIs");
	}

	get type(): ToolType {
		return ToolType.Azdata;
	}

	get displayName(): string {
		return localize('resourceDeployment.AzdataDisplayName', "azdata");
	}

	get homePage(): string {
		return 'https://docs.microsoft.com/sql/big-data-cluster/deploy-install-azdata';
	}

	protected get versionCommand(): Command {
		return {
			command: 'azdata -v'
		};
	}

	protected getVersionFromOutput(output: string): SemVer | undefined {
		let version: SemVer | undefined = undefined;
		if (output && output.split(EOL).length > 0) {
			version = new SemVer(output.split(EOL)[0].replace(/ /g, ''));
		}
		return version;
	}

	get autoInstallSupported(): boolean {
		return true;
	}

	protected async getInstallationPath(): Promise<string | null> {
		switch (this.osType) {
			case OsType.linux:
				return installationRoot;
			default:
				return path.join(await this.getPip3InstallLocation('azdata-cli'), '..', 'Scripts');
		}
	}

	get installationCommands(): Command[] {
		switch (this.osType) {
			case OsType.linux: return [
				{
					sudo: true,
					comment: 'updating repository information ...',
					command: 'apt-get update'
				},
				{
					sudo: true,
					comment: 'getting packages needed for installation ...',
					command: 'apt-get install gnupg ca-certificates curl apt-transport-https lsb-release -y'
				},
				{
					sudo: true,
					comment: 'downloading and installing the signing key ...',
					command: 'wget -qO- https://packages.microsoft.com/keys/microsoft.asc | apt-key add -'
				},
				{
					sudo: true,
					comment: `adding the ${this.name} repository information ...`,
					command: 'add-apt-repository "$(wget -qO- https://packages.microsoft.com/config/ubuntu/16.04/mssql-server-preview.list)"'
				},
				{
					sudo: true,
					comment: 'updating repository information ...',
					command: 'apt-get update'
				},
				{
					sudo: true,
					comment: `installing ${this.name} ...`,
					command: 'apt-get install -y azdata-cli'
				}
			];
			// all other platforms and distributions
			default: return [
				{
					sudo: false,
					comment: 'uninstalling mssqlctl ctp 3.1 ...',
					command: 'pip3 uninstall -r https://private-repo.microsoft.com/python/ctp3.1/mssqlctl/requirements.txt -y'
				},
				{
					sudo: false,
					comment: 'uninstalling mssqlctl ctp 3.2 ...',
					command: 'pip3 uninstall -r https://azdatacli.blob.core.windows.net/python/azdata/2019-ctp3.2/requirements.txt -y'
				},
				{
					sudo: false,
					comment: `installing ${this.name} ...`,
					command: 'pip3 install -r https://aka.ms/azdata --user'
				}

			];
		}
	}
}
