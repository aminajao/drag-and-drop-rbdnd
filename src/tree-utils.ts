//@ts-nocheck
import type { FC } from "react";
import type { Path, ItemId } from "@atlaskit/tree";
import type {
  DraggableProvided,
  DraggableStateSnapshot
} from "react-beautiful-dnd";
import type {
  TreeItem as TreeItemType,
  TreeData,
  FlattenedTree,
  FlattenedItem
} from "./types";

import _TreeItem from "@atlaskit/tree/dist/esm/components/TreeItem";
import React from "react";

export { calculateFinalDropPositions } from "@atlaskit/tree/dist/esm/components/Tree/Tree-utils";
export { flattenTree, getItem } from "@atlaskit/tree/dist/esm/utils/tree";
export {
  getItemById,
  getIndexById,
  getDestinationPath
} from "@atlaskit/tree/dist/esm/utils/flat-tree";
export {
  isSamePath,
  isLowerSibling,
  hasSameParent
} from "@atlaskit/tree/dist/esm/utils/path";
export { mutateTree, moveItemOnTree } from "@atlaskit/tree";

export type TreeItemRenderer<T = any> = (params: {
  item: TreeItemType<T>;
  depth?: number;
  onExpand?: (itemId: ItemId) => void;
  onCollapse?: (itemId: ItemId) => void;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
}) => React.ReactElement;

export type TreeItemProps<T = any> = {
  item: TreeItemType<T>;
  path: Path;
  onExpand: (itemId: ItemId, path?: Path) => void;
  onCollapse: (itemId: ItemId, path?: Path) => void;
  renderItem: TreeItemRenderer<T>;
  provided: DraggableProvided;
  snapshot: DraggableStateSnapshot;
  itemRef: (itemId: ItemId, element: HTMLElement | null) => void;
  offsetPerLevel: number;
};

export const TreeItem: FC<TreeItemProps> = _TreeItem;

declare module "./tree-utils" {
  function getItem<T = any>(tree: TreeData<T>, path: Path): TreeItem<T>;
  function flattenTree<T = any>(tree: TreeData<T>): FlattenedTree<T>;
  function getItemById<T = any>(
    flattenedTree: FlattenedTree<T>,
    id: string
  ): FlattenedItem<T>;
  function getIndexById<T = any>(
    flattenedTree: FlattenedTree<T>,
    id: string
  ): number;
  function getDestinationPath<T = any>(
    flattenedTree: FlattenedTree<T>,
    sourceIndex: number,
    destinationIndex: number,
    level?: number
  ): Path;
}
