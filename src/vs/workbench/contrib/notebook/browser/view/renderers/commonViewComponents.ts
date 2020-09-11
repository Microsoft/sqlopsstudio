/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the Source EULA. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as DOM from 'vs/base/browser/dom';
import { MenuEntryActionViewItem } from 'vs/platform/actions/browser/menuEntryActionViewItem';
import { MenuItemAction } from 'vs/platform/actions/common/actions';
import { IContextMenuService } from 'vs/platform/contextview/browser/contextView';
import { IKeybindingService } from 'vs/platform/keybinding/common/keybinding';
import { INotificationService } from 'vs/platform/notification/common/notification';
import { renderCodiconsAsElement } from 'vs/base/browser/codicons';

export class CodiconActionViewItem extends MenuEntryActionViewItem {
	constructor(
		readonly _action: MenuItemAction,
		keybindingService: IKeybindingService,
		notificationService: INotificationService,
		contextMenuService: IContextMenuService
	) {
		super(_action, keybindingService, notificationService, contextMenuService);
	}
	updateLabel(): void {
		if (this.options.label && this.label) {
			DOM.reset(this.label, ...renderCodiconsAsElement(this._commandAction.label ?? ''));
		}
	}
}
