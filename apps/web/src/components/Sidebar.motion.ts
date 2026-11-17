const motionTiming = { duration: 200, easing: "cubic-bezier(0.15, 1, 0.3, 1)" };
const rowTravel = (height: number) => Math.min(height, 40);
// Fades clone removed rows and animate clones and entries; intervening layout reads force reflows.
const MAX_FADED_ROWS_PER_UPDATE = 40;

type RowPosition = { top: number; left: number; width: number; height: number };

function progress(animation: Animation) {
  return animation.playState === "finished"
    ? 1
    : (animation.effect?.getComputedTiming().progress ?? 0);
}

/** Position the list so all direct children's offsetTop share an origin. */
export function createSidebarListMotion(parent: HTMLUListElement) {
  let positions: Map<HTMLElement, RowPosition> | null = null;
  let disposed = false;
  const reducedMotion = parent.ownerDocument.defaultView?.matchMedia(
    "(prefers-reduced-motion: reduce)",
  );
  const running = new Map<HTMLElement, { animation: Animation; offset: number; offsetX: number }>();
  const entering = new Map<HTMLElement, { animation: Animation; travel: number }>();
  const exiting = new Map<HTMLElement, Animation>();

  const remainingOffset = (node: HTMLElement) => {
    const current = running.get(node);
    const run = current ? current.offset * (1 - progress(current.animation)) : 0;
    const entry = entering.get(node);
    const enter = entry ? entry.travel * (1 - progress(entry.animation)) : 0;
    return run + enter;
  };
  const remainingX = (node: HTMLElement) => {
    const current = running.get(node);
    return current ? current.offsetX * (1 - progress(current.animation)) : 0;
  };
  const clearFades = () => {
    for (const entry of entering.values()) entry.animation.cancel();
    for (const animation of exiting.values()) animation.cancel();
    for (const node of exiting.keys()) node.remove();
    entering.clear();
    exiting.clear();
  };
  const fadeOut = (
    node: HTMLElement,
    position: RowPosition,
    travel: number,
    clip?: { from: number; to: number },
  ) => {
    if (position.height === 0) return;
    const clone = cloneSidebarRow(node);
    Object.assign(clone.style, {
      position: "absolute",
      top: `${position.top + remainingOffset(node)}px`,
      left: `${position.left + remainingX(node)}px`,
      width: `${position.width}px`,
      height: `${position.height}px`,
      margin: "0",
      boxSizing: "border-box",
      contentVisibility: "visible",
      transform: "none",
      transition: "none",
      pointerEvents: "none",
    });
    parent.append(clone);
    const entry = entering.get(node);
    const entryProgress = entry ? progress(entry.animation) : 1;
    const animation = clone.animate(
      [
        {
          opacity: entryProgress,
          transform: "translateY(0px)",
          ...(clip ? { clipPath: `inset(${clip.from}px 0 0)` } : {}),
        },
        {
          opacity: 0,
          transform: `translateY(${travel}px)`,
          ...(clip ? { clipPath: `inset(${clip.to}px 0 0)` } : {}),
        },
      ],
      motionTiming,
    );
    exiting.set(clone, animation);
    animation.addEventListener(
      "finish",
      () => {
        clone.remove();
        exiting.delete(clone);
      },
      { once: true },
    );
  };

  const cancel = (node: HTMLElement) => {
    running.get(node)?.animation.cancel();
    running.delete(node);
  };
  const suspend = () => {
    for (const node of running.keys()) cancel(node);
    clearFades();
    positions = null;
  };
  const move = (node: HTMLElement, offset: number, offsetX = 0) => {
    cancel(node);
    const entry = entering.get(node);
    if (entry) entry.travel = 0;
    if (offset === 0 && offsetX === 0 && !entry) return;
    const animation = node.animate(
      [{ transform: `translate(${offsetX}px, ${offset}px)` }, { transform: "translate(0px, 0px)" }],
      motionTiming,
    );
    running.set(node, { animation, offset, offsetX });
    animation.addEventListener(
      "finish",
      () => {
        if (running.get(node)?.animation === animation) running.delete(node);
      },
      { once: true },
    );
  };

  return {
    targetRect(element: HTMLElement) {
      const rect = element.getBoundingClientRect();
      const row = element.closest("li");
      if (!row || row.parentElement !== parent) return rect;
      const scale =
        parent.offsetWidth > 0 ? parent.getBoundingClientRect().width / parent.offsetWidth : 1;
      return new DOMRect(
        rect.x - remainingX(row) * scale,
        rect.y - remainingOffset(row) * scale,
        rect.width,
        rect.height,
      );
    },
    update(animate: boolean, shelf?: { header: HTMLElement; expanded: boolean }) {
      if (disposed) return;
      // A hidden list (the closed narrow sheet stays mounted) reports zero
      // offsets, which would make the first pass after it opens animate every row.
      if (parent.getClientRects().length === 0) {
        suspend();
        return;
      }
      const next = new Map(
        Array.from(parent.children)
          .filter((node): node is HTMLElement => node instanceof HTMLElement && !exiting.has(node))
          .map((node) => [
            node,
            {
              top: node.offsetTop,
              left: node.offsetLeft,
              width: node.offsetWidth,
              height: node.offsetHeight,
            },
          ]),
      );
      let fadeCount = 0;
      if (positions !== null) {
        for (const [node, position] of positions) {
          if (!next.has(node) && position.height > 0) fadeCount++;
        }
        for (const [node, position] of next) {
          if (!positions.has(node) && position.height > 0) fadeCount++;
        }
      }
      const shouldAnimate =
        animate &&
        positions !== null &&
        !reducedMotion?.matches &&
        fadeCount <= MAX_FADED_ROWS_PER_UPDATE;
      const movedDelta = new Map<HTMLElement, number>();
      const movedX = new Map<HTMLElement, number>();
      const nextOrder = [...next.keys()];
      const oldOrder = positions === null ? [] : [...positions.keys()];
      const previousHeader = shelf ? positions?.get(shelf.header) : undefined;
      const nextHeader = shelf ? next.get(shelf.header) : undefined;
      const fold =
        shelf && previousHeader && nextHeader
          ? {
              from: previousHeader.top + previousHeader.height + remainingOffset(shelf.header),
              to: nextHeader.top + nextHeader.height,
            }
          : undefined;
      const ridingDelta = (
        order: readonly HTMLElement[],
        index: number,
        retained: (node: HTMLElement) => boolean,
      ) => {
        for (let cursor = index - 1; cursor >= 0; cursor--) {
          const node = order[cursor]!;
          const delta = movedDelta.get(node);
          if (delta !== undefined) return delta;
          if (retained(node)) return remainingOffset(node);
        }
        return undefined;
      };
      if (!shouldAnimate) clearFades();
      else {
        for (const [node, position] of next) {
          const previous = positions!.get(node);
          if (!previous || (previous.top === position.top && previous.left === position.left))
            continue;
          movedDelta.set(node, previous.top + remainingOffset(node) - position.top);
          movedX.set(node, previous.left + remainingX(node) - position.left);
        }
        for (const [node, position] of positions!) {
          if (next.has(node)) continue;
          const delta = ridingDelta(oldOrder, oldOrder.indexOf(node), (n) => next.has(n));
          const folding =
            fold &&
            shelf &&
            !shelf.expanded &&
            oldOrder.indexOf(node) > oldOrder.indexOf(shelf.header);
          fadeOut(
            node,
            position,
            folding ? 0 : delta === undefined ? rowTravel(position.height) : -delta,
            folding
              ? {
                  from: Math.max(0, fold.from - position.top - remainingOffset(node)),
                  to: Math.max(0, fold.to - position.top - remainingOffset(node)),
                }
              : undefined,
          );
        }
      }
      for (const [node, entry] of entering) {
        if (!next.has(node)) {
          entry.animation.cancel();
          entering.delete(node);
        }
      }
      for (const node of running.keys()) {
        if (!shouldAnimate || !next.has(node)) cancel(node);
      }
      if (shouldAnimate) {
        for (const [index, node] of nextOrder.entries()) {
          const position = next.get(node)!;
          const previousTop = positions!.get(node)?.top;
          if (previousTop === undefined) {
            if (position.height > 0) {
              const delta = ridingDelta(nextOrder, index, (n) => positions!.has(n));
              const folding = fold && shelf?.expanded && index > nextOrder.indexOf(shelf.header);
              const travel = folding
                ? 0
                : delta === undefined
                  ? -rowTravel(position.height)
                  : delta;
              const animation = node.animate(
                [
                  {
                    opacity: 0,
                    transform: `translateY(${travel}px)`,
                    ...(folding
                      ? { clipPath: `inset(${Math.max(0, fold.from - position.top)}px 0 0)` }
                      : {}),
                  },
                  {
                    opacity: 1,
                    transform: "translateY(0px)",
                    ...(folding ? { clipPath: "inset(0px 0 0)" } : {}),
                  },
                ],
                motionTiming,
              );
              entering.set(node, { animation, travel });
              animation.addEventListener(
                "finish",
                () => {
                  if (entering.get(node)?.animation === animation) entering.delete(node);
                },
                { once: true },
              );
            }
            continue;
          }
          const delta = movedDelta.get(node);
          // Computed progress includes easing; carry forward only our translation, never dnd-kit's
          // transforms.
          if (delta !== undefined) move(node, delta, movedX.get(node));
        }
      }
      positions = next;
    },
    release() {
      const origin = parent.getBoundingClientRect();
      const scale = parent.offsetWidth > 0 ? origin.width / parent.offsetWidth : 1;
      const snapshot = new Map(
        Array.from(parent.children)
          .filter((node): node is HTMLElement => node instanceof HTMLElement && !exiting.has(node))
          .map((node): [HTMLElement, RowPosition] => {
            const rect = node.getBoundingClientRect();
            return [
              node,
              {
                top: (rect.top - origin.top) / scale - remainingOffset(node),
                left: (rect.left - origin.left) / scale - remainingX(node),
                width: node.offsetWidth,
                height: node.offsetHeight,
              },
            ];
          }),
      );
      positions = snapshot;
    },
    suspend,
    dispose() {
      suspend();
      disposed = true;
    },
  };
}

function cloneSidebarRow(node: HTMLElement) {
  const clone = node.cloneNode(true) as HTMLElement;
  for (const element of [clone, ...clone.querySelectorAll("*")]) {
    for (const attribute of Array.from(element.attributes)) {
      if (
        (attribute.name === "id" && element.namespaceURI !== "http://www.w3.org/2000/svg") ||
        attribute.name.startsWith("data-sidebar-") ||
        attribute.name === "data-thread-group" ||
        attribute.name === "data-thread-item" ||
        attribute.name === "data-thread-selection-safe" ||
        attribute.name === "data-testid"
      ) {
        element.removeAttribute(attribute.name);
      }
    }
  }
  clone.setAttribute("aria-hidden", "true");
  clone.inert = true;
  return clone;
}

export function createSidebarDragImage(
  row: HTMLElement,
  key: string,
  point: { x: number; y: number },
) {
  const rect = row.getBoundingClientRect();
  const offset = { x: point.x - rect.left, y: point.y - rect.top };
  const clone = cloneSidebarRow(row);
  clone.dataset.sidebarDragImage = key;
  const computed = getComputedStyle(row);
  clone.style.setProperty(
    "--sidebar-row-content-inset",
    computed.getPropertyValue("--sidebar-row-content-inset"),
  );
  Object.assign(clone.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    margin: "0",
    boxSizing: "border-box",
    contentVisibility: "visible",
    transition: "none",
    pointerEvents: "none",
    zIndex: "100",
    opacity: "0.85",
    background: "var(--sidebar)",
    borderRadius: "var(--control-radius)",
    boxShadow: "0 4px 16px #0003",
    font: computed.font,
  });
  const move = (point: { x: number; y: number }, visible: boolean) => {
    clone.style.visibility = visible ? "visible" : "hidden";
    clone.style.transform = `translate(${point.x - offset.x}px, ${point.y - offset.y}px)`;
  };
  move(point, true);
  row.ownerDocument.body.append(clone);
  return { move, dispose: () => clone.remove() };
}
