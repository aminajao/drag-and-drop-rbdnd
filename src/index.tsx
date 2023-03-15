import React from "react";
import { render } from "react-dom";
import {
  DragDropContext,
  Draggable,
  DraggableStateSnapshot,
  Droppable,
  DroppableProps
} from "react-beautiful-dnd";

import type { DragDropContextProps } from "react-beautiful-dnd";
import type { ItemId, Path } from "@atlaskit/tree";
import { isLowerSibling, isSamePath, TreeItemProps } from "./tree-utils";
import type {
  List,
  Item,
  DraggingState,
  TreeItem as TreeItemType,
  FlattenedItem
} from "./types";

import {
  TreeItem,
  flattenTree,
  calculateFinalDropPositions,
  moveItemOnTree,
  mutateTree,
  getItem,
  getItemById,
  getDestinationPath
} from "./tree-utils";
import { generatePlainList, preparePlainListToTree } from "./utils";

import "./styles.css";

const App: React.FC<{
  treeId: string;
  data: List;
  offsetPerLevel?: number;
  mappingKeys: {
    parentIdKey: string;
    orderIndexKey: string;
  };
  renderItem(
    params: Parameters<TreeItemProps["renderItem"]>[0] & {
      lines?: Array<boolean>;
      offsetPerLevel?: number;
    }
  ): ReturnType<TreeItemProps["renderItem"]>;
  renderPlaceholder?(params: any): ReturnType<TreeItemProps["renderItem"]>;
  onDragEnd(
    parentId: string,
    result: {
      item: TreeItemType<Item>;
      afterItem?: TreeItemType<Item>;
      beforeItem?: TreeItemType<Item>;
    }
  ): void;
}> = ({
  treeId,
  data,
  offsetPerLevel = 8,
  mappingKeys,
  onDragEnd,
  renderItem,
  renderPlaceholder
}) => {
  const [expandedIds, setExpandedIds] = React.useState<Array<ItemId>>([]);
  const [draggingId, setDraggingId] = React.useState<ItemId | null>(null);
  const draggingState = React.useRef<DraggingState | null>(null);

  const [placeholderPath, setPlaceholderPath] = React.useState<Path | null>(
    null
  );

  const placeholderRef = React.useRef<HTMLElement | null>(null);
  const containerRef = React.useRef<HTMLElement | null>(null);
  const itemRefs = React.useRef<Record<string, HTMLElement | null>>({});
  const setItemRef = React.useCallback(
    (innerRef: React.RefCallback<HTMLElement>) => (
      itemId: ItemId,
      el: HTMLElement | null
    ) => {
      itemRefs.current[itemId] = el;
      innerRef(el);
    },
    []
  );

  const isMoveEventActive = React.useRef(false);
  const handlePreventMoveEvent = React.useCallback(() => {
    isMoveEventActive.current = false;

    if (draggingState.current?.combine) {
      setPlaceholderPath(null);
    }
  }, []);

  const setExpandedId = React.useCallback(
    (itemId: string | number, isExpanded: boolean) => {
      if (itemId && isExpanded && !expandedIds.includes(itemId)) {
        setExpandedIds([...expandedIds, itemId]);
      } else if (itemId && !isExpanded && expandedIds.includes(itemId)) {
        setExpandedIds(expandedIds.filter((id) => id !== itemId));
      }
    },
    [expandedIds]
  );

  const trees = React.useMemo(() => {
    const source = preparePlainListToTree<Item>(
      treeId,
      data,
      mappingKeys,
      expandedIds.filter((id) => id !== draggingId)
    );

    return { source, flattened: flattenTree(source) };
  }, [treeId, data, mappingKeys, expandedIds, draggingId]);

  const calcEffectivePath = React.useCallback(
    (flatItem: FlattenedItem, snapshot: DraggableStateSnapshot) => {
      if (
        draggingState.current?.destination &&
        draggingId === flatItem.item.id
      ) {
        const {
          source,
          destination,
          horizontalLevel,
          mode
        } = draggingState.current!;

        if (mode === "SNAP" || snapshot.isDropAnimating) {
          if (destination) {
            return getDestinationPath(
              trees.flattened,
              source.index,
              destination.index,
              horizontalLevel
            );
          }
        }
      }

      return flatItem.path;
    },
    [draggingId, trees.flattened]
  );

  const calcTreeLines = React.useCallback(
    (itemPath: Path, isPlaceholder = false) => {
      if (itemPath.length <= 1) {
        return [];
      }

      const actualItemPath = [...itemPath];
      let actualPlaceholderPath: typeof placeholderPath = null;

      if (placeholderPath && draggingState.current) {
        const { originalPath } = draggingState.current;
        if (isPlaceholder) {
          if (!isLowerSibling(actualItemPath, originalPath)) {
            actualItemPath.push(actualItemPath.pop()! - 1);
          }
        } else {
          actualPlaceholderPath = [...placeholderPath];

          if (
            !draggingState.current?.combine &&
            isLowerSibling(actualPlaceholderPath, originalPath)
          ) {
            actualPlaceholderPath.push(actualPlaceholderPath.pop()! + 1);
          }
        }
      }

      return actualItemPath.reduce<Array<boolean>>((acc, pathIndex, index) => {
        // skip root level
        if (index > 0) {
          if (
            actualPlaceholderPath &&
            isLowerSibling(
              actualPlaceholderPath?.slice(0, index + 1),
              actualItemPath.slice(0, index + 1)
            )
          ) {
            return [...acc, true];
          }

          const parentPath = actualItemPath.slice(0, index);
          let itemBelow = getItem(trees.source, [...parentPath, pathIndex + 1]);

          // skip this level if item below is currently dragging
          if (
            itemBelow &&
            draggingState.current &&
            itemBelow.id === draggingState.current.draggableId
          ) {
            itemBelow = getItem(trees.source, [...parentPath, pathIndex + 2]);
          }

          return [...acc, !!itemBelow];
        }

        return acc;
      }, []);
    },
    [trees.source, placeholderPath]
  );

  const calcPlaceholderPath = React.useCallback(() => {
    if (!draggingState.current || !renderPlaceholder) {
      return;
    }

    const { source, destination, horizontalLevel } = draggingState.current;

    let newPlaceholderPath: Path = placeholderPath || [];
    if (destination) {
      newPlaceholderPath = getDestinationPath(
        trees.flattened,
        source.index,
        destination.index,
        horizontalLevel
      );
    }

    if (!placeholderPath || !isSamePath(placeholderPath, newPlaceholderPath)) {
      setPlaceholderPath(newPlaceholderPath);
    }
  }, [trees.flattened, renderPlaceholder, placeholderPath]);

  const calcPlaceholderPosition = React.useCallback(
    (draggableId: string) => {
      const placeholderEl = placeholderRef.current;

      if (!renderPlaceholder || !placeholderEl || !draggingState.current) {
        return;
      }

      const placeholderStyles: React.CSSProperties = {};
      const { destination, combine } = draggingState.current;

      if (combine) {
        placeholderEl.setAttribute("data-combined-id", combine.draggableId);
      } else {
        placeholderEl.removeAttribute("data-combined-id");
      }

      const itemEl = itemRefs.current[draggableId];

      if (itemEl) {
        placeholderStyles.height = `${itemEl.clientHeight}px`;
      }

      if (destination) {
        const clientY = Array.from(
          (containerRef.current?.children || []) as Array<HTMLElement>
        )
          .slice(0, destination.index)
          .reduce(
            (total, child) =>
              total +
              child.clientHeight +
              parseFloat(child.style.marginTop || "0") +
              parseFloat(child.style.marginBottom || "0"),
            parseFloat(containerRef.current?.style.paddingTop || "0")
          );

        placeholderStyles.position = "absolute";
        placeholderStyles.top = `${clientY}px`;
        placeholderStyles.right = 0;
        placeholderStyles.left = 0;

        calcPlaceholderPath();
      }

      Object.assign(placeholderEl.style, placeholderStyles);
    },
    [renderPlaceholder, calcPlaceholderPath]
  );

  const handleBeforeCapture = React.useCallback<
    Required<DragDropContextProps>["onBeforeCapture"]
  >((initial) => {
    // should freez container height while dragging
    if (containerRef.current) {
      const { clientHeight } = containerRef.current;
      containerRef.current?.style.setProperty("height", `${clientHeight}px`);
    }

    setDraggingId(initial.draggableId);
  }, []);

  const handleBeforeDragStart = React.useCallback<
    Required<DragDropContextProps>["onBeforeDragStart"]
  >(
    (initial) => {
      isMoveEventActive.current = true;
      draggingState.current = {
        source: initial.source,
        destination: initial.source,
        mode: initial.mode,
        draggableId: initial.draggableId,
        originalPath: trees.flattened[initial.source.index].path
      };

      calcPlaceholderPosition(initial.draggableId);
    },
    [trees.flattened, calcPlaceholderPosition]
  );

  const handleDragUpdate = React.useCallback<
    Required<DragDropContextProps>["onDragUpdate"]
  >(
    (initial) => {
      if (!draggingState.current) {
        return;
      }

      draggingState.current = {
        ...draggingState.current,
        destination: initial.destination,
        combine: initial.combine
      };

      calcPlaceholderPosition(initial.draggableId);
      if (initial.mode === "SNAP") {
        calcPlaceholderPath();
      }
    },
    [calcPlaceholderPosition, calcPlaceholderPath]
  );

  const handleDragEnd = React.useCallback<DragDropContextProps["onDragEnd"]>(
    (result) => {
      containerRef.current?.style.removeProperty("height");
      placeholderRef.current?.removeAttribute("style");

      setPlaceholderPath(null);
      setDraggingId(null);

      if (!draggingState.current || (!result.destination && !result.combine)) {
        return;
      }

      const finalDraggingState = {
        ...draggingState.current,
        source: result.source,
        destination: result.destination,
        combine: result.combine
      };
      draggingState.current = null;

      const {
        sourcePosition,
        destinationPosition
      } = calculateFinalDropPositions(
        trees.source,
        trees.flattened,
        finalDraggingState
      );

      if (!destinationPosition.index) {
        destinationPosition.index = 0;
      }

      const newSourceTree = moveItemOnTree(
        trees.source,
        sourcePosition,
        destinationPosition
      );

      const newFlattenedTree = flattenTree(
        mutateTree(newSourceTree, destinationPosition.parentId, {
          isExpanded: true,
          hasChildren: true
        })
      );
      const { item, path } = getItemById(newFlattenedTree, result.draggableId);
      const afterItem = getItem(
        newSourceTree,
        path.slice(0, -1).concat(path[path.length - 1] - 1)
      );
      const beforeItem = getItem(
        newSourceTree,
        path.slice(0, -1).concat(path[path.length - 1] + 1)
      );

      const itemParentId =
        destinationPosition.parentId !== treeId
          ? destinationPosition.parentId
          : null;

      onDragEnd(itemParentId, { item: item, afterItem, beforeItem });
      setExpandedId(itemParentId, true);
    },
    [trees, treeId, setExpandedId, onDragEnd]
  );

  const handlePointerMove = React.useCallback(() => {
    if (!draggingState.current || !isMoveEventActive.current) {
      return;
    }

    const _calcDropLevel = () => {
      if (!containerRef.current) {
        return;
      }

      const { x: containerLeft } = containerRef.current.getBoundingClientRect();
      const itemEl = itemRefs.current[draggingId!];

      if (!itemEl) {
        return;
      }

      const { x: itemLeft } = itemEl.getBoundingClientRect();
      const leftOffset =
        parseFloat(itemEl.style.getPropertyValue("padding-left")) || 0;
      const relativeLeft = Math.max(itemLeft + leftOffset - containerLeft, 0);

      return Math.floor(relativeLeft / offsetPerLevel) + 1;
    };

    draggingState.current = {
      ...draggingState.current,
      horizontalLevel: _calcDropLevel()
    };

    calcPlaceholderPath();
  }, [draggingId, offsetPerLevel, calcPlaceholderPath]);

  const renderItemClone = React.useCallback<
    Required<DroppableProps>["renderClone"]
  >(
    (provided, snapshot, rubric) => {
      const flattenedItem = trees.flattened[rubric.source.index];
      const lines = calcTreeLines(calcEffectivePath(flattenedItem, snapshot));

      const extendedProvided = {
        ...provided,
        innerRef: (el?: HTMLElement | null) => {
          setItemRef(provided.innerRef)(flattenedItem.item.id, el!);
        },
        draggableProps: {
          ...provided.draggableProps,
          style: {
            ...provided.draggableProps.style,
            paddingLeft: offsetPerLevel * lines.length
          }
        }
      };

      return renderItem({
        item: flattenedItem.item,
        // @ts-ignore
        provided: extendedProvided,
        snapshot,
        lines
      });
    },
    [
      trees.flattened,
      calcTreeLines,
      calcEffectivePath,
      setItemRef,
      offsetPerLevel,
      renderItem
    ]
  );

  const renderedTree = React.useMemo(() => {
    return trees.flattened.map((item, index) => (
      <Draggable
        key={item.item.id}
        draggableId={String(item.item.id)}
        index={index}
      >
        {(provided, snapshot) => (
          <TreeItem
            item={item.item}
            path={item.path}
            provided={provided}
            snapshot={snapshot}
            itemRef={setItemRef(provided.innerRef)}
            offsetPerLevel={offsetPerLevel}
            onExpand={(itemId) => setExpandedId(itemId, true)}
            onCollapse={(itemId) => setExpandedId(itemId, false)}
            renderItem={(params) =>
              renderItem({
                ...params,
                lines: calcTreeLines(item.path),
                offsetPerLevel
              })
            }
          />
        )}
      </Draggable>
    ));
  }, [
    trees.flattened,
    calcTreeLines,
    renderItem,
    setExpandedId,
    setItemRef,
    offsetPerLevel
  ]);

  const renderedPlaceholder = React.useMemo(() => {
    if (!renderPlaceholder) {
      return null;
    }

    return (
      <div ref={(el) => (placeholderRef.current = el)}>
        {placeholderPath &&
          renderPlaceholder({
            lines: calcTreeLines(placeholderPath, true),
            offsetPerLevel
          })}
      </div>
    );
  }, [renderPlaceholder, placeholderPath, offsetPerLevel, calcTreeLines]);

  return (
    <DragDropContext
      onBeforeCapture={handleBeforeCapture}
      onBeforeDragStart={handleBeforeDragStart}
      onDragUpdate={handleDragUpdate}
      onDragEnd={handleDragEnd}
    >
      <Droppable
        droppableId={treeId}
        isCombineEnabled
        renderClone={renderItemClone}
      >
        {(provided) => (
          <div
            ref={(el) => {
              containerRef.current = el;
              provided.innerRef(el);
            }}
            {...provided.droppableProps}
            style={{ pointerEvents: "auto", position: "relative" }}
            onTouchMove={handlePointerMove}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePreventMoveEvent}
            onTouchEnd={handlePreventMoveEvent}
          >
            {renderedTree}
            {renderedPlaceholder}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </DragDropContext>
  );
};

const OFFSET_PER_LEVEL = 32;
const CURRENT_TREE_ID = "root";

const Main: React.FC<{ id?: string }> = ({ id = CURRENT_TREE_ID }) => {
  const [limit, setLimit] = React.useState(10);
  const [data, setData] = React.useState<ReturnType<typeof generatePlainList>>(
    [] as any
  );

  React.useLayoutEffect(() => {
    setData(generatePlainList(limit));
  }, [limit]);

  const handleDragEnd = React.useCallback<
    React.ComponentProps<typeof App>["onDragEnd"]
  >(
    (parentId, { item, afterItem, beforeItem }) => {
      let newOrderIndex = 1;
      if (afterItem && beforeItem) {
        newOrderIndex =
          afterItem.data!.orderIndex +
          (beforeItem.data!.orderIndex - afterItem.data!.orderIndex) / 2;
      } else if (beforeItem) {
        newOrderIndex = beforeItem.data!.orderIndex / 2;
      } else if (afterItem) {
        newOrderIndex = afterItem.data!.orderIndex + 1;
      }

      setData({
        ...data,
        [item.id]: {
          ...item.data!,
          parentId,
          orderIndex: newOrderIndex
        }
      });
    },
    [data]
  );

  const renderItemTree = React.useCallback(
    (lines: Array<boolean> = [], isVisible: boolean = true) =>
      Boolean(lines.length) && (
        <div className="nested-item-tree" data-is-visible={isVisible}>
          {lines.map((lvl, i) => (
            <span
              key={i}
              data-is-visible={lvl}
              style={{
                width: OFFSET_PER_LEVEL
              }}
            />
          ))}
        </div>
      ),
    []
  );

  const renderItem = React.useCallback<
    React.ComponentProps<typeof App>["renderItem"]
  >(
    ({ item, provided, onExpand, onCollapse, lines, snapshot }) => {
      const toggleExpandedItem = () => {
        (item.isExpanded ? onCollapse : onExpand)?.(item.data!.id);
      };

      return (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="nested-item"
        >
          {renderItemTree(lines, !snapshot.isDragging)}
          <div
            className="nested-item-content"
            data-is-dragging-over={!!snapshot.combineTargetFor}
          >
            <div>{item.data!.title}</div>
            {item.hasChildren && (
              <div
                role="button"
                style={{ cursor: "pointer" }}
                onClick={toggleExpandedItem}
              >
                {item.isExpanded ? "-" : "+"}
              </div>
            )}
          </div>
        </div>
      );
    },
    [renderItemTree]
  );

  const renderPlaceholder = React.useCallback(
    ({ lines, offsetPerLevel } = {}) => {
      return (
        <div className="nested-item nested-item-placeholder">
          {renderItemTree(lines)}
          <div
            className="nested-item-content"
            style={{ marginLeft: offsetPerLevel * lines.length }}
          >
            &nbsp;
          </div>
        </div>
      );
    },
    [renderItemTree]
  );

  return (
    <>
      <input
        type="number"
        min={1}
        max={500}
        value={limit}
        onChange={(e) => setLimit(Number(e.target.value))}
      />
      <App
        data={data}
        treeId={id}
        renderItem={renderItem}
        renderPlaceholder={renderPlaceholder}
        offsetPerLevel={OFFSET_PER_LEVEL}
        onDragEnd={handleDragEnd}
        mappingKeys={{
          parentIdKey: "parentId",
          orderIndexKey: "orderIndex"
        }}
      />
    </>
  );
};

const rootElement = document.getElementById("root");
render(<Main />, rootElement);
