/*---------------------------------------------------------------------------------------------
*  Copyright (c) Microsoft Corporation. All rights reserved.
*  Licensed under the Source EULA. See License.txt in the project root for license information.
*--------------------------------------------------------------------------------------------*/

'use strict';

import * as sqlops from 'sqlops';
import { Event, Emitter } from 'vs/base/common/event';
import * as UUID from 'vs/base/common/uuid';

export enum TreeCheckboxState {
	Intermediate = 0,
	Checked = 1,
	Unchecked = 2
}

export class TreeNode {
	private _onNodeChange = new Emitter<void>();
	private _onTreeChange = new Emitter<TreeNode>();
	private _data: sqlops.TreeComponentDataModel;
	private _parent?: TreeNode;
	private _root: TreeNode;
	private _isAlwaysLeaf: boolean;
	private _nodeMap: Map<string, TreeNode>;
	private _children: TreeNode[];

	public readonly onNodeChange: Event<void> = this._onNodeChange.event;
	public readonly onTreeChange: Event<TreeNode> = this._onTreeChange.event;

	/**
	 * Creates new instance of tree node
	 * @param data the underlining data that's bind to the tree node, any change in the tree will affect the same node in data
	 * @param root the root node of the tree. If passed null, the current node will be the root
	 */
	constructor(data: sqlops.TreeComponentDataModel, root: TreeNode) {
		if (!data) {
			throw new Error(`Invalid tree node data`);
		}
		if (root === undefined) {
			root = this;
			root._nodeMap = new Map<string, TreeNode>();
		}

		this._root = root;
		if (this.findNode(data.id)) {
			throw new Error(`tree node with id: '${data.id}' already exists`);
		}
		this._data = data;
	}

	/**
	 * id for TreeNode
	 */
	public get id(): string {
		return this.data.id;
	}

	public set id(value: string) {
		this.data.id = value;
	}

	/**
	 * Label to display to the user, describing this node
	 */
	public set label(value: string) {
		this.data.label = value;
	}

	public get label(): string {
		return this.data.label;
	}

	/**
	 * Is this a leaf node (in which case no children can be generated) or is it expandable?
	 */
	public get isAlwaysLeaf(): boolean {
		return this._isAlwaysLeaf;
	}

	/**
	 * Parent of this node
	 */
	public get parent(): TreeNode {
		return this._parent;
	}

	public get root(): TreeNode {
		return this._root;
	}

	/**
	 * Path identifying this node
	 */
	public get nodePath(): string {
		return `${this.parent ? this.parent.nodePath + '-' : ''}${this.id}`;
	}

	public get data(): sqlops.TreeComponentDataModel {
		if (this._data === undefined) {
			this._data = {
				label: undefined
			};
		}
		return this._data;
	}

	public changeNodeCheckedState(value: boolean, fromParent?: boolean): void {
		if (value !== this.checked) {
			if (value !== undefined && this.children) {
				this.children.forEach(child => {
					child.changeNodeCheckedState(value, true);
				});
			}

			this.checked = value;
			if (!fromParent && this.parent) {
				this.parent.refreshState();
			}

			this.onValueChanged();
		}
	}

	public set checked(value: boolean) {
		this.data.checked = value;
	}

	public refreshState(): void {
		if (this.hasChildren) {
			if (this.children.every(c => c.checked)) {
				this.changeNodeCheckedState(true);
			} else if (this.children.every(c => c.checked !== undefined && !c.checked)) {
				this.changeNodeCheckedState(false);
			} else {
				this.changeNodeCheckedState(undefined);
			}
		}
	}

	public get hasChildren(): boolean {
		return this.children !== undefined && this.children.length > 0;
	}

	public get checked(): boolean {
		return this.data.checked;
	}

	private onValueChanged(): void {
		this._onNodeChange.fire();
		if (this.root) {
			this.root._onTreeChange.fire(this);
		}
	}

	public get checkboxState(): TreeCheckboxState {
		if (this.checked === undefined) {
			return TreeCheckboxState.Intermediate;
		} else {
			return this.checked ? TreeCheckboxState.Checked : TreeCheckboxState.Unchecked;
		}
	}

	public findNode(id: string): TreeNode {
		if (this.id === id) {
			return this;
		} else if (this.root) {
			return this.root._nodeMap.has(id) ? this.root._nodeMap.get(id) : undefined;
		} else {
			let node: TreeNode;
			if (this.children) {
				this.children.forEach(child => {
					node = child.findNode(id);
					if (node) {
						return;
					}
				});
			}

			return node;
		}
	}

	/**
	 * Children of this node
	 */
	public get children(): TreeNode[] {
		return this._children;
	}

	public addChildNode(node: TreeNode): void {

		if (node) {
			if (!node.root) {
				node._root = this.root;
			}
			if (!node.parent) {
				node._parent = this;
			}
			if (node.root) {
				node.root._nodeMap.set(node.id, node);
			}
			this._children.push(node);
		}
	}

	public static createNode(nodeData: sqlops.TreeComponentDataModel, parent?: TreeNode, root?: TreeNode): TreeNode {
		nodeData.id = nodeData.id || `treeNode-${UUID.generateUuid()}`;
		let rootNode = root || (parent !== undefined ? parent.root : undefined);
		let treeNode = new TreeNode(nodeData, rootNode);

		treeNode._parent = parent;
		return treeNode;
	}

	public static createTree(nodeData: sqlops.TreeComponentDataModel, parent?: TreeNode, root?: TreeNode): TreeNode {
		if (nodeData) {
			let treeNode = TreeNode.createNode(nodeData, parent, root);

			if (nodeData.children && nodeData.children.length > 0) {
				treeNode._isAlwaysLeaf = false;
				treeNode._children = [];
				nodeData.children.forEach(childNode => {
					if (childNode) {
						let childTreeNode = TreeNode.createTree(childNode, treeNode, root || treeNode.root);
						treeNode.addChildNode(childTreeNode);
					}
				});
				treeNode.refreshState();
			} else {
				treeNode._isAlwaysLeaf = true;
			}
			return treeNode;
		} else {
			return undefined;
		}
	}
}