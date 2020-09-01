/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Table } from 'sql/base/browser/ui/table/table';
import { attachTableStyler } from 'sql/platform/theme/common/styler';
import { RowSelectionModel } from 'sql/base/browser/ui/table/plugins/rowSelectionModel.plugin';

import { IWorkbenchThemeService } from 'vs/workbench/services/themes/common/workbenchThemeService';
import { Dimension } from 'vs/base/browser/dom';
import { textFormatter, slickGridDataItemColumnValueExtractor } from 'sql/base/browser/ui/table/formatters';
import { TableDataView } from 'sql/base/browser/ui/table/tableDataView';
import { PillFilter } from 'sql/base/browser/ui/table/plugins/pillFilter.plugin';

export interface ResourceViewerTableViewState {
	scrollTop: number;
	scrollLeft: number;
}

export class ResourceViewerTable {

	private _resourceViewerTable!: Table<Slick.SlickData>;
	private _data: TableDataView<Slick.SlickData> | undefined;
	private _overlay: HTMLElement;

	constructor(parent: HTMLElement, @IWorkbenchThemeService private _themeService: IWorkbenchThemeService) {
		this._overlay = document.createElement('div');
		this._overlay.className = 'overlayWidgets';
		this._overlay.style.width = '100%';
		this._overlay.style.zIndex = '4';
		parent.appendChild(this._overlay);

		this._resourceViewerTable = new Table(parent, {
			sorter: (args) => {
				this._data?.sort(args);
			}
		}, {
			dataItemColumnValueExtractor: slickGridDataItemColumnValueExtractor
		});
		this._resourceViewerTable.setSelectionModel(new RowSelectionModel());
		this._resourceViewerTable.registerPlugin(new PillFilter());
		attachTableStyler(this._resourceViewerTable, this._themeService);
	}

	public set data(data: TableDataView<Slick.SlickData>) {
		this._data = data;
		this._resourceViewerTable.setData(data);
	}

	public set columns(columns: Slick.Column<Slick.SlickData>[]) {
		this._resourceViewerTable.columns = columns.map(column => {
			column.formatter = textFormatter;
			return column;
		});
		this._resourceViewerTable.autosizeColumns();
	}

	public updateRowCount(): void {
		this._resourceViewerTable.updateRowCount();
	}

	public invalidateAllRows(): void {
		this._resourceViewerTable.grid.invalidateAllRows();
	}

	public autosizeColumns(): void {
		this._resourceViewerTable.autosizeColumns();
	}

	public focus(): void {
		this._resourceViewerTable.focus();
	}

	public layout(dimension: Dimension): void {
		this._resourceViewerTable.layout(dimension);
		this._resourceViewerTable.autosizeColumns();
	}

	public saveViewState(): ResourceViewerTableViewState {
		const viewElement = this._resourceViewerTable.grid.getCanvasNode().parentElement;
		return {
			scrollTop: viewElement?.scrollTop ?? -1,
			scrollLeft: viewElement?.scrollLeft ?? -1
		};
	}

	public restoreViewState(state: ResourceViewerTableViewState): void {
		const viewElement = this._resourceViewerTable.grid.getCanvasNode().parentElement;
		if (viewElement) {
			viewElement.scrollTop = state.scrollTop;
			viewElement.scrollLeft = state.scrollLeft;
		}

	}
}
