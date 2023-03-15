import type { ItemId } from "@atlaskit/tree";
import type { List, Item, TreeData, DataTransformParams } from "./types";

export const generatePlainList = (limit: 5) => {
  const result = {} as List;
  const orderIndexes = {} as Record<string, number>;

  for (let i = 0; i < limit; i++) {
    const isRootLvl = i < limit * 0.5; // 50% should be root
    const itemId = Math.random().toString(32);

    if (isRootLvl) {
      orderIndexes.root = orderIndexes.root || 0;
      result[itemId] = {
        id: itemId,
        parentId: null,
        title: `item ${i}`,
        orderIndex: Math.random()
      };
    } else {
      const availableIds = Object.keys(result);
      const parentId =
        availableIds[Math.round(Math.random() * (availableIds.length - 1))];

      orderIndexes[parentId] = orderIndexes[parentId] || 0;
      result[itemId] = {
        id: itemId,
        parentId: parentId,
        title: `item ${i}`,
        orderIndex: Math.random()
      };
    }
  }

  return result;
};

export const preparePlainListToTree = <
  T extends {
    id: ItemId;
    [key: DataTransformParams[keyof DataTransformParams]]: ItemId | null;
  }
>(
  rootId: ItemId,
  data: Record<ItemId, T>,
  mappingKeys: DataTransformParams,
  expandedIds: Array<ItemId> = []
) => {
  const result: TreeData<T>["items"] = {
    [rootId]: {
      id: rootId,
      children: [],
      hasChildren: true,
      isExpanded: true,
      isChildrenLoading: false
    }
  };

  const parents: Array<T> = [];
  const parentToChildren: Record<string, Array<T>> = {};
  const { parentIdKey, orderIndexKey } = mappingKeys;

  for (const item of Object.values(data)) {
    result[item.id] = {
      id: item.id,
      children: [],
      hasChildren: false,
      isExpanded: expandedIds.includes(item.id),
      isChildrenLoading: false,
      data: item
    };

    const parentId = item[parentIdKey] as ItemId;
    if (!parentId) {
      parents.push(item);
    } else {
      parentToChildren[parentId] = [
        ...(parentToChildren[parentId] || []),
        item
      ];
    }
  }

  const sortItems = (a: T, b: T) => {
    const x = a[orderIndexKey] as number;
    const y = b[orderIndexKey] as number;

    return x && y ? x - y : 0;
  };

  for (const item of parents.sort(sortItems)) {
    result[rootId].children.push(item.id);
    result[item.id].data = item;
  }

  for (const [parentId, children] of Object.entries(parentToChildren)) {
    result[parentId].hasChildren = true;
    result[parentId].children = children.sort(sortItems).map(({ id }) => id);
  }

  return { rootId, items: result } as TreeData<Item>;
};
