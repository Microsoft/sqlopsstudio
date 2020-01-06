/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

'use strict';

import * as vscode from 'vscode';
import * as childProcess from 'child_process';

const ExecScriptsTimeoutInSeconds = 600000;
export class ProcessService {

	public timeout = ExecScriptsTimeoutInSeconds;

	public async execScripts(exeFilePath: string, scripts: string[], outputChannel?: vscode.OutputChannel): Promise<void> {
		return new Promise<void>((resolve, reject) => {

			const scriptExecution = childProcess.spawn(exeFilePath);
			let timer: NodeJS.Timeout;
			let output: string;
			scripts.forEach(script => {
				scriptExecution.stdin.write(`${script}\n`);
			});
			scriptExecution.stdin.end();

			// Add listeners to print stdout and stderr if an output channel was provided
			if (outputChannel) {
				scriptExecution.stdout.on('data', data => {
					this.outputDataChunk(data, outputChannel, '    stdout: ');
					output = output + data.toString();
				});
				scriptExecution.stderr.on('data', data => {
					this.outputDataChunk(data, outputChannel, '    stderr: ');
					output = output + data.toString();
				});
			}

			scriptExecution.on('exit', (code) => {
				if (timer) {
					timer.unref();
				}
				if (code === 0) {
					resolve();
				} else {
					reject(`Process exited with code: ${code}. output: ${output}`);
				}

			});
			timer = setTimeout(() => {
				try {
					scriptExecution.kill();
				} catch (error) {
					console.log(error);
				}
			}, this.timeout);
		});
	}

	public async executeBufferedCommand(cmd: string, outputChannel?: vscode.OutputChannel): Promise<string> {
		return new Promise<string>((resolve, reject) => {
			if (outputChannel) {
				outputChannel.appendLine(`    > ${cmd}`);
			}

			let child = childProcess.exec(cmd, {
				timeout: this.timeout
			}, (err, stdout) => {
				if (err) {
					reject(err);
				} else {
					resolve(stdout);
				}
			});

			// Add listeners to print stdout and stderr if an output channel was provided
			if (outputChannel) {
				child.stdout.on('data', data => { this.outputDataChunk(data, outputChannel, '    stdout: '); });
				child.stderr.on('data', data => { this.outputDataChunk(data, outputChannel, '    stderr: '); });
			}
		});
	}

	private outputDataChunk(data: string | Buffer, outputChannel: vscode.OutputChannel, header: string): void {
		data.toString().split(/\r?\n/)
			.forEach(line => {
				outputChannel.appendLine(header + line);
			});
	}
}
