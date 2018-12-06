/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/
import 'vs/css!./textCell';

import { OnInit, Component, Input, Inject, forwardRef, ElementRef, ChangeDetectorRef, OnDestroy, ViewChild, OnChanges, SimpleChange } from '@angular/core';

import { CommonServiceInterface } from 'sql/services/common/commonServiceInterface.service';
import { CellView } from 'sql/parts/notebook/cellViews/interfaces';

import { IColorTheme, IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import * as themeColors from 'vs/workbench/common/theme';
import { ICommandService } from 'vs/platform/commands/common/commands';
import { ICellModel } from 'sql/parts/notebook/models/modelInterfaces';
import { ISanitizer, defaultSanitizer } from 'sql/parts/notebook/outputs/sanitizer';
import { localize } from 'vs/nls';
import { NotebookModel } from 'sql/parts/notebook/models/notebookModel';

export const TEXT_SELECTOR: string = 'text-cell-component';

@Component({
	selector: TEXT_SELECTOR,
	templateUrl: decodeURI(require.toUrl('./textCell.component.html'))
})
export class TextCellComponent extends CellView implements OnInit, OnChanges {
	@ViewChild('preview', { read: ElementRef }) private output: ElementRef;
	@Input() cellModel: ICellModel;

	@Input() set model(value: NotebookModel) {
		this._model = value;
	}

	@Input() set activeCellId(value: string) {
		this._activeCellId = value;
	}

	private _content: string;
	private isEditMode: boolean;
	private _sanitizer: ISanitizer;
	private _previewCssApplied: boolean = false;
	private _model: NotebookModel;
	private _activeCellId: string;

	constructor(
		@Inject(forwardRef(() => CommonServiceInterface)) private _bootstrapService: CommonServiceInterface,
		@Inject(forwardRef(() => ChangeDetectorRef)) private _changeRef: ChangeDetectorRef,
		@Inject(IWorkbenchThemeService) private themeService: IWorkbenchThemeService,
		@Inject(ICommandService) private _commandService: ICommandService
	) {
		super();
		this.isEditMode = false;
	}

	//Gets sanitizer from ISanitizer interface
	private get sanitizer(): ISanitizer {
		if (this._sanitizer) {
			return this._sanitizer;
		}
		return this._sanitizer = defaultSanitizer;
	}

	get model(): NotebookModel {
		return this._model;
	}

	get activeCellId(): string {
		return this._activeCellId;
	}

	ngOnInit() {
		this.updatePreview();
		this._register(this.themeService.onDidColorThemeChange(this.updateTheme, this));
		this.updateTheme(this.themeService.getColorTheme());
		this.cellModel.onOutputsChanged(e => {
			this.updatePreview();
		});
	}

	ngOnChanges(changes: { [propKey: string]: SimpleChange }) {
		for (let propName in changes) {
			if (propName === 'activeCellId') {
				let changedProp = changes[propName];
				this._activeCellId = changedProp.currentValue;
				this.toggleEditMode(false);
				break;
			}
		}
	}

	/**
	 * Updates the preview of markdown component with latest changes
	 * If content is empty and in non-edit mode, default it to 'Double-click to edit'
	 * Sanitizes the data to be shown in markdown cell
	 */
	private updatePreview() {
		if (this._content !== this.cellModel.source || this.cellModel.source.length === 0) {
			if (!this.cellModel.source && !this.isEditMode) {
				(<HTMLElement>this.output.nativeElement).innerHTML = localize('doubleClickEdit', 'Double-click to edit');
			} else {
				this._content = this.sanitizeContent(this.cellModel.source);
				let html;
				// todo: pass in the notebook filename instead of undefined value
				this._commandService.executeCommand<string>('notebook.showPreview', undefined, this._content).then((htmlcontent) => {
					html = htmlcontent;
					let outputElement = <HTMLElement>this.output.nativeElement;
					if (htmlcontent && htmlcontent.includes('<a href')) {
						html = htmlcontent.replace(/(a href=".*")(>)/g, function(a, b, c) {
							let ret = '';
							if (b !== '') {
								ret = b + ' onclick="window.open(this.href)"';
							}
							if (c !== '') {
								ret = ret + c;
							}
							return ret;
						});
					}
					outputElement.innerHTML = html;
				});
			}
		}
	}

	//Sanitizes the content based on trusted mode of Cell Model
	private sanitizeContent(content: string): string {
		if (this.cellModel && !this.cellModel.trustedMode) {
			content = this.sanitizer.sanitize(content);
		}
		return content;
	}


	// Todo: implement layout
	public layout() {
	}

	private updateTheme(theme: IColorTheme): void {
		let outputElement = <HTMLElement>this.output.nativeElement;
		outputElement.style.borderTopColor = theme.getColor(themeColors.SIDE_BAR_BACKGROUND, true).toString();
	}

	public handleContentChanged(): void {
		if (!this._previewCssApplied) {
			this.updatePreviewCssClass();
		}
		this.updatePreview();
	}

	public toggleEditMode(editMode?: boolean): void {
		this.isEditMode = editMode !== undefined? editMode : !this.isEditMode;
		this.updatePreviewCssClass();
		this.updatePreview();
		this._changeRef.detectChanges();
	}

	// Updates the css class to preview 'div' based on edit mode
	private updatePreviewCssClass() {
		let outputElement = <HTMLElement>this.output.nativeElement;
		if (this.isEditMode && this.cellModel.source) {
			outputElement.className = 'notebook-preview';
			this._previewCssApplied = true;
		}
		else {
			outputElement.className = '';
			this._previewCssApplied = false;
		}
	}
}
