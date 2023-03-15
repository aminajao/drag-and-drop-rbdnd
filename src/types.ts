import type {
  Path,
  TreeData as BaseTreeData,
  TreeItem as BaseTreeItem
} from "@atlaskit/tree";
import type {
  Combine,
  DraggableLocation,
  MovementMode
} from "react-beautiful-dnd";

export type Item = {
  id: string;
  parentId: string | null;
  title: string;
  orderIndex: number;
};

export type List = Record<string, Item>;

export type TreeItem<T = any> = Omit<BaseTreeItem, "data"> & {
  data?: T;
};

export type TreeData<T = any> = Omit<BaseTreeData, "items"> & {
  items: Record<string, TreeItem<T>>;
};

export type FlattenedItem<T = any> = {
  item: TreeItem<T>;
  path: Path;
};

export type FlattenedTree<T = any> = Array<FlattenedItem<T>>;

export type DraggingState = {
  source: DraggableLocation;
  destination?: DraggableLocation;
  combine?: Combine;
  mode: MovementMode;
  horizontalLevel?: number;
  draggableId: string;
  originalPath: Path;
};

export type DataTransformParams = {
  parentIdKey: string;
  orderIndexKey: string;
};
