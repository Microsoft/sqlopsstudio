/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as assert from 'assert';
import * as azdata from 'azdata';
import * as sinon from 'sinon';
import { TestConfigurationService } from 'sql/platform/connection/test/common/testConfigurationService';
import { AddCellAction, ClearAllOutputsAction, CollapseCellsAction, KernelsDropdown, msgChanging, NewNotebookAction, NoKernelName, RunAllCellsAction, TrustedAction } from 'sql/workbench/contrib/notebook/browser/notebookActions';
import { ClientSessionStub as stubs_ClientSessionStub, ContextViewProviderStub, NotebookComponentStub, NotebookModelStub as stubs_NotebookModelStub } from 'sql/workbench/contrib/notebook/test/stubs';
import { NotebookEditorStub } from 'sql/workbench/contrib/notebook/test/testCommon';
import { ICellModel, INotebookModel } from 'sql/workbench/services/notebook/browser/models/modelInterfaces';
import { IStandardKernelWithProvider } from 'sql/workbench/services/notebook/browser/models/notebookUtils';
import { INotebookEditor } from 'sql/workbench/services/notebook/browser/notebookService';
import { CellType } from 'sql/workbench/services/notebook/common/contracts';
import * as TypeMoq from 'typemoq';
import { TestCommandService } from 'vs/editor/test/browser/editorTestServices';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { IConfigurationService, IConfigurationChangeEvent, IConfigurationOverrides } from 'vs/platform/configuration/common/configuration';
import { TestInstantiationService } from 'vs/platform/instantiation/test/common/instantiationServiceMock';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { TestNotificationService } from 'vs/platform/notification/test/common/testNotificationService';
import { workbenchInstantiationService } from 'vs/workbench/test/browser/workbenchTestServices';
import { Emitter } from 'vs/base/common/event';

class ClientSessionStub extends stubs_ClientSessionStub {
	private _errorState: boolean = false;
	setErrorState = (value: boolean) => this._errorState = value;
	get isInErrorState(): boolean {
		return this._errorState;
	}
	get kernel(): azdata.nb.IKernel {
		return <azdata.nb.IKernel>{
			name: 'StandardKernel1'
		};
	}
}
class NotebookModelStub extends stubs_NotebookModelStub {
	private _clientSession: ClientSessionStub = new ClientSessionStub();
	public kernelChangedEmitter: Emitter<azdata.nb.IKernelChangedArgs> = new Emitter<azdata.nb.IKernelChangedArgs>();

	public get kernelChanged() {
		return this.kernelChangedEmitter.event;
	}

	public get clientSession(): ClientSessionStub {
		return this._clientSession;
	}

	private _standardKernelsMap: Map<string, IStandardKernelWithProvider> = new Map<string, IStandardKernelWithProvider>(
		[
			// The name and displayName are set to same value
			// for ease of expected result calculation for kernelDropdown.updateKernel tests.
			[
				'StandardKernel1',
				{
					name: 'StandardKernel1',
					displayName: 'StandardKernel1',
					connectionProviderIds: ['Kernel1 connection 1', 'Kernel1 connection2'],
					notebookProvider: 'kernel provider1'
				}
			],
			[
				'StandardKernel2',
				{
					name: 'StandardKernel2',
					displayName: 'StandardKernel2',
					connectionProviderIds: ['Kernel1 connection 2', 'Kernel1 connection2'],
					notebookProvider: 'kernel provider2'
				}
			]
		]
	);

	public standardKernelsDisplayName(): string[] {
		return [...this._standardKernelsMap.values()].map(x => x.displayName);
	}

	public get specs(): azdata.nb.IAllKernels | undefined {
		return {
			defaultKernel: 'SpecKernel1',
			// The name and displayName are set to same value
			// for ease of expected result calculation for kernelDropdown.updateKernel tests.
			kernels: [
				{
					name: 'SpecKernel1',
					language: 'SpecLanguage1',
					display_name: 'SpecKernel1'
				},
				{
					name: 'SpecKernel2',
					language: 'SpecLanguage2',
					display_name: 'SpecKernel2'
				}
			]
		};
	}

	public getStandardKernelFromName(name: string): IStandardKernelWithProvider {
		return this._standardKernelsMap.get(name);
	}
}

suite('Notebook Actions', function (): void {
	test('Add Cell Action', async function (): Promise<void> {
		let testCellType: CellType = 'code';
		let actualCellType: CellType;

		let action = new AddCellAction('TestId', 'TestLabel', 'TestClass');
		action.cellType = testCellType;

		// Normal use case
		let mockNotebookComponent = TypeMoq.Mock.ofType<INotebookEditor>(NotebookComponentStub);
		mockNotebookComponent.setup(c => c.addCell(TypeMoq.It.isAny(), TypeMoq.It.isAnyNumber())).returns(cellType => {
			actualCellType = cellType;
		});

		assert.doesNotThrow(() => action.run(mockNotebookComponent.object));
		assert.strictEqual(actualCellType, testCellType);

		// Handle error case
		mockNotebookComponent.reset();
		mockNotebookComponent.setup(c => c.addCell(TypeMoq.It.isAny(), TypeMoq.It.isAnyNumber())).throws(new Error('Test Error'));
		await assert.rejects(action.run(mockNotebookComponent.object));
	});

	test('Clear All Outputs Action', async function (): Promise<void> {
		let action = new ClearAllOutputsAction('TestId', true);

		// Normal use case
		let mockNotebookComponent = TypeMoq.Mock.ofType<INotebookEditor>(NotebookComponentStub);
		mockNotebookComponent.setup(c => c.clearAllOutputs()).returns(() => Promise.resolve(true));

		let result = await action.run(mockNotebookComponent.object);
		assert.ok(result, 'Clear All Outputs Action should succeed');
		mockNotebookComponent.verify(c => c.clearAllOutputs(), TypeMoq.Times.once());

		// Handle failure case
		mockNotebookComponent.reset();
		mockNotebookComponent.setup(c => c.clearAllOutputs()).returns(() => Promise.resolve(false));

		result = await action.run(mockNotebookComponent.object);
		assert.strictEqual(result, false, 'Clear All Outputs Action should have failed');
		mockNotebookComponent.verify(c => c.clearAllOutputs(), TypeMoq.Times.once());
	});

	test('Trusted Action', async function (): Promise<void> {
		let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		mockNotification.setup(n => n.notify(TypeMoq.It.isAny()));

		let action = new TrustedAction('TestId', true);
		assert.strictEqual(action.trusted, false, 'Should not be trusted by default');

		// Normal use case
		let contextStub = <INotebookEditor>{
			model: <INotebookModel>{
				trustedMode: false
			}
		};
		let result = await action.run(contextStub);
		assert.ok(result, 'Trusted Action should succeed');
		assert.strictEqual(action.trusted, true, 'Should be trusted after toggling trusted state');

		// Should toggle trusted to false on subsequent action
		result = await action.run(contextStub);
		assert.ok(result, 'Trusted Action should succeed again');
		assert.strictEqual(action.trusted, false, 'Should toggle trusted to false');
	});

	test('Run All Cells Action', async function (): Promise<void> {
		let mockNotification = TypeMoq.Mock.ofType<INotificationService>(TestNotificationService);
		mockNotification.setup(n => n.notify(TypeMoq.It.isAny()));

		let action = new RunAllCellsAction('TestId', 'TestLabel', 'TestClass', mockNotification.object);

		// Normal use case
		let mockNotebookComponent = TypeMoq.Mock.ofType<INotebookEditor>(NotebookComponentStub);
		mockNotebookComponent.setup(c => c.runAllCells()).returns(() => Promise.resolve(true));

		let result = await action.run(mockNotebookComponent.object);
		assert.ok(result, 'Run All Cells Action should succeed');
		mockNotebookComponent.verify(c => c.runAllCells(), TypeMoq.Times.once());

		// Handle errors
		mockNotebookComponent.reset();
		mockNotebookComponent.setup(c => c.runAllCells()).returns(() => { throw new Error('Test Error'); });

		result = await action.run(mockNotebookComponent.object);
		assert.strictEqual(result, false, 'Run All Cells Action should fail on error');
	});

	test('Collapse Cells Action', async function (): Promise<void> {
		let action = new CollapseCellsAction('TestId', true);
		assert.strictEqual(action.isCollapsed, false, 'Should not be collapsed by default');

		let context = <INotebookEditor>{
			cells: [<ICellModel>{
				isCollapsed: false
			}, <ICellModel>{
				isCollapsed: true
			}, <ICellModel>{
				isCollapsed: false
			}]
		};

		// Collapse cells case
		let result = await action.run(context);
		assert.ok(result, 'Collapse Cells Action should succeed');

		assert.strictEqual(action.isCollapsed, true, 'Action should be collapsed after first toggle');
		context.cells.forEach(cell => {
			assert.strictEqual(cell.isCollapsed, true, 'Cells should be collapsed after first toggle');
		});

		// Toggle cells to uncollapsed
		result = await action.run(context);
		assert.ok(result, 'Collapse Cells Action should succeed');

		assert.strictEqual(action.isCollapsed, false, 'Action should not be collapsed after second toggle');
		context.cells.forEach(cell => {
			assert.strictEqual(cell.isCollapsed, false, 'Cells should not be collapsed after second toggle');
		});
	});

	test('New Notebook Action', async function (): Promise<void> {
		let actualCmdId: string;

		let mockCommandService = TypeMoq.Mock.ofType<ICommandService>(TestCommandService);
		mockCommandService.setup(s => s.executeCommand(TypeMoq.It.isAny(), TypeMoq.It.isAny()))
			.returns((commandId) => {
				actualCmdId = commandId;
				return Promise.resolve(true);
			});

		let action = new NewNotebookAction('TestId', 'TestLabel', mockCommandService.object, undefined);
		action.run(undefined);

		assert.strictEqual(actualCmdId, NewNotebookAction.INTERNAL_NEW_NOTEBOOK_CMD_ID);
	});


	suite('Kernels dropdown', async () => {
		let kernelsDropdown: KernelsDropdown;
		let contextViewProvider: ContextViewProviderStub;
		let container: HTMLElement;
		let notebookModel: NotebookModelStub;
		let configurationService: TestConfigurationService;
		let notebookEditor: NotebookEditorStub;
		let sandbox: sinon.SinonSandbox;
		let setOptionsSpy: sinon.SinonSpy;

		setup(async () => {
			sandbox = sinon.sandbox.create();
			container = document.createElement('div');
			contextViewProvider = new ContextViewProviderStub();
			const instantiationService = <TestInstantiationService>workbenchInstantiationService();
			configurationService = new TestConfigurationService();
			instantiationService.set(IConfigurationService, configurationService);
			notebookModel = new NotebookModelStub();
			notebookEditor = new NotebookEditorStub({ model: notebookModel });
			await notebookEditor.modelReady;
			kernelsDropdown = new KernelsDropdown(container, contextViewProvider, notebookEditor.modelReady, configurationService);
			setOptionsSpy = sandbox.spy(kernelsDropdown, 'setOptions');
		});

		teardown(() => {
			sandbox.restore();
		});

		suite('updateKernel', () => {
			suite(`kernel not defined or ready and showAllKernels is true`, () => {
				for (const kernel of [undefined, { isReady: false }] as azdata.nb.IKernel[]) {
					for (const clientSessionErrorState of [true, false]) {
						test(`verify for kernel:${JSON.stringify(kernel)} and notebookModel's clientSession error state: ${clientSessionErrorState}`, () => {
							sandbox.stub(configurationService, 'getValue').returns(true); // returns true for all configuration values.
							const e: IConfigurationChangeEvent = <IConfigurationChangeEvent>{
								affectsConfiguration(_configuration: string, _overrides?: IConfigurationOverrides) {
									return true;
								}
							};
							configurationService.onDidChangeConfigurationEmitter.fire(e); //reconfigure kernelDropdown object based on config changes
							const expectedSetOptionsArgs = {
								kernels: [NoKernelName, ...notebookModel.specs.kernels.map(x => x.display_name), ...notebookModel.standardKernelsDisplayName()], // these are the kernels fed into the update method via the notebookModelStub object
								selected: 0 // the selected value is NoKernelName value when no kernel is defined or is ready.
							};
							verifyUpdateKernelForNoKernelCase(notebookModel, kernelsDropdown, kernel, setOptionsSpy, expectedSetOptionsArgs, clientSessionErrorState);
						});
					}
				}
			});

			suite(`kernel not defined or ready and showAllKernels is false`, () => {
				for (const kernel of [undefined, { isReady: false }] as azdata.nb.IKernel[]) {
					for (const clientSessionErrorState of [true, false]) {
						test(`verify for kernel:${JSON.stringify(kernel)} and notebookModel's clientSession error state: ${clientSessionErrorState}`, () => {
							const expectedSetOptionsArgs = {
								kernels: [NoKernelName, ...notebookModel.standardKernelsDisplayName()], // these are the kernels fed into the update method via the notebookModelStub object
								selected: 0 // the selected value is NoKernelName value when no kernel is defined or is ready.
							};
							verifyUpdateKernelForNoKernelCase(notebookModel, kernelsDropdown, kernel, setOptionsSpy, expectedSetOptionsArgs, clientSessionErrorState);
						});
					}
				}
			});

			suite(`kernel defined and ready and showAllKernels is true`, () => {
				for (const kernel of [{ name: 'StandardKernel1', isReady: true }, { name: 'SpecKernel1', isReady: true }, { name: 'Unknown', isReady: true }] as azdata.nb.IKernel[]) {
					test(`verify for kernel: '${kernel.name}'`, () => {
						sandbox.stub(configurationService, 'getValue').returns(true); // returns true for all configuration values.
						const e: IConfigurationChangeEvent = <IConfigurationChangeEvent>{
							affectsConfiguration(_configuration: string, _overrides?: IConfigurationOverrides) {
								return true;
							}
						};
						configurationService.onDidChangeConfigurationEmitter.fire(e); //reconfigure kernelDropdown object based on config changes
						testDefinedAndReadyKernelForTrueShowKernels(notebookModel, kernel, kernelsDropdown, setOptionsSpy);
					});
				}
			});

			suite(`kernel defined and ready and showAllKernels is false`, () => {
				for (const kernel of [{ name: 'StandardKernel1', isReady: true }, { name: 'SpecKernel1', isReady: true }, { name: undefined, isReady: true }] as azdata.nb.IKernel[]) {
					test(`verify for kernel with name: '${kernel.name}'`, () => {
						sandbox.stub(configurationService, 'getValue').returns(false); // returns false for all configuration values.
						const e: IConfigurationChangeEvent = <IConfigurationChangeEvent>{
							affectsConfiguration(_configuration: string, _overrides?: IConfigurationOverrides) {
								return true;
							}
						};
						configurationService.onDidChangeConfigurationEmitter.fire(e); //reconfigure kernelDropdown object based on config changes
						testDefinedAndReadyKernelForFalseShowKernels(notebookModel, kernel, kernelsDropdown, setOptionsSpy);
					});
				}

				test(`verify showAllKernels is not affected when onDidChangeConfigurationEmitter fires with both ShowAllKernelConfigName and WorkbenchPreviewConfigName not changed`, () => {
					const kernel = <azdata.nb.IKernel>{ name: 'StandardKernel1', isReady: true };
					const getValueStub = sandbox.stub(configurationService, 'getValue').returns(false); // returns false for all configuration values.
					let e: IConfigurationChangeEvent = <IConfigurationChangeEvent>{
						affectsConfiguration(_configuration: string, _overrides?: IConfigurationOverrides) {
							return true;
						}
					};
					configurationService.onDidChangeConfigurationEmitter.fire(e); //reconfigure kernelDropdown object based on config changes
					//showAllKernels should now be set to false

					//Now fire another changeConfiguration but with affects configuration return false for all values. Even though configuration service returns true for the config values that affect showAllKernels, the test that follows proves that showAllKernels remained false.
					getValueStub.restore();
					sandbox.stub(configurationService, 'getValue').returns(true); // returns false for all configuration values.
					e = <IConfigurationChangeEvent>{
						affectsConfiguration(_configuration: string, _overrides?: IConfigurationOverrides) {
							return false;
						}
					};
					configurationService.onDidChangeConfigurationEmitter.fire(e); //reconfigure kernelDropdown object based on config changes

					// test for showKernels = false
					testDefinedAndReadyKernelForFalseShowKernels(notebookModel, kernel, kernelsDropdown, setOptionsSpy);
				});
			});
		});

		suite(`doChangeKernel`, () => {
			for (const displayName of [undefined, '', 'Arbitrary Kernel Name']) {
				test(`verify for kernel displayName='${displayName}'`, () => {
					const changeKernelStub = sandbox.stub(notebookModel, 'changeKernel');
					kernelsDropdown.doChangeKernel(displayName);
					assert.ok(setOptionsSpy.calledOnce, `setOptions should be called exactly once`);
					assert.ok(setOptionsSpy.calledWithExactly([msgChanging], 0), `setOptions should be called with a options value of ${[msgChanging]} and selected value of 0`);
					assert.ok(changeKernelStub.calledOnce, `notebookModel.changeKernel should be called exactly once`);
					assert.ok(changeKernelStub.calledWithExactly(displayName), `notebookModel.changeKernel should be called with the kernel displayName that was passed to doChangeKernel`);
				});
			}
		});

		test(`verify that firing of notebookModel.kernelChanged event calls updateKernel`, () => {
			const updateKernelStub = sandbox.stub(kernelsDropdown, 'updateKernel');
			const e: azdata.nb.IKernelChangedArgs = <azdata.nb.IKernelChangedArgs>{
				newValue: <azdata.nb.IKernel>{
					name: 'StandardKernel2'
				}
			};
			notebookModel.kernelChangedEmitter.fire(e);
			assert.ok(updateKernelStub.calledOnce, `updateKernel should be called exactly once`);
			assert.ok(updateKernelStub.calledWithExactly(e.newValue), `updateKernel should be called with the parameter: ${JSON.stringify(e.newValue)}`);
		});

	});
});


function testDefinedAndReadyKernelForTrueShowKernels(notebookModel: NotebookModelStub, kernel: azdata.nb.IKernel, kernelsDropdown: KernelsDropdown, setOptionsSpy: sinon.SinonSpy) {
	// these are the kernels fed into the update method via the notebookModelStub object
	const kernels = [...notebookModel.specs.kernels.map(x => x.display_name), ...notebookModel.standardKernelsDisplayName()];
	let index = kernels.findIndex(x => x === kernel.name);
	if (index === -1) {
		index = 0;
	}
	const expectedSetOptionsArgs = {
		kernels: kernels,
		selected: index // selected value from the kernelDropdown options must point to the index within 'kernels' corresponding to kernel.name
	};
	verifyUpdateKernelForKernelDefinedAndReadyCase(notebookModel, kernelsDropdown, kernel, setOptionsSpy, expectedSetOptionsArgs);
}

function testDefinedAndReadyKernelForFalseShowKernels(notebookModel: NotebookModelStub, kernel: azdata.nb.IKernel, kernelsDropdown: KernelsDropdown, setOptionsSpy: sinon.SinonSpy) {
	// these are the kernels fed into the update method via the notebookModelStub object
	const kernels = [...notebookModel.standardKernelsDisplayName()];
	let index = kernels.findIndex(x => x === kernel.name);
	if (index === -1) {
		index = 0;
	}
	const expectedSetOptionsArgs = {
		kernels: kernels,
		selected: index // selected value from the kernelDropdown options must point to the index within 'kernels' corresponding to kernel.name
	};
	verifyUpdateKernelForKernelDefinedAndReadyCase(notebookModel, kernelsDropdown, kernel, setOptionsSpy, expectedSetOptionsArgs);
}

function verifyUpdateKernelForNoKernelCase(notebookModel: NotebookModelStub, kernelsDropdown: KernelsDropdown, kernel: azdata.nb.IKernel, setOptionsSpy: sinon.SinonSpy, expectedSetOptionsArgs: {
	kernels: string[]; // these are the kernels fed into the update method via the notebookModelStub object
	selected: number; // the selected value is NoKernelName value when no kernel is defined or is ready.
}, clientSessionErrorState: boolean) {
	notebookModel.clientSession.setErrorState(clientSessionErrorState);
	kernelsDropdown.updateKernel(kernel);
	// setOptions is expected to get called only when clientSession is in error state
	if (notebookModel.clientSession.isInErrorState) {
		assert.ok(setOptionsSpy.calledOnce, `setOptions should be be called exactly once when kernel is not defined or ready and clientSession is in error state`);
		assert.ok(setOptionsSpy.calledWithExactly(expectedSetOptionsArgs.kernels, expectedSetOptionsArgs.selected), `setOptions should be called with a options value of ${JSON.stringify(expectedSetOptionsArgs.kernels, undefined, '\t')} and selected value of ${expectedSetOptionsArgs.selected}`);
	}
	else {
		assert.ok(setOptionsSpy.notCalled, `setOptions should be not be called when kernel is not defined or ready and clientSession is not in error state`);
	}
}

function verifyUpdateKernelForKernelDefinedAndReadyCase(notebookModel: NotebookModelStub, kernelsDropdown: KernelsDropdown, kernel: azdata.nb.IKernel, setOptionsSpy: sinon.SinonSpy, expectedSetOptionsArgs: {
	kernels: string[]; // these are the kernels fed into the update method via the notebookModelStub object
	selected: number; // the selected value is NoKernelName value when no kernel is defined or is ready.
}) {
	kernelsDropdown.updateKernel(kernel);
	assert.ok(setOptionsSpy.calledOnce, `setOptions should be be called exactly once when kernel is not defined or ready and clientSession is in error state`);
	assert.ok(setOptionsSpy.calledWithExactly(expectedSetOptionsArgs.kernels, expectedSetOptionsArgs.selected), `setOptions should be called with a options value of ${JSON.stringify(expectedSetOptionsArgs.kernels)} and selected value of ${expectedSetOptionsArgs.selected}`);
}

