import * as Schema from "effect/Schema";

const SidebarThreadGroup = Schema.Struct({
  id: Schema.String,
  name: Schema.String,
  threadKeys: Schema.Array(Schema.String),
});
export const SidebarThreadGroups = Schema.Array(SidebarThreadGroup);
export type SidebarThreadGroup = typeof SidebarThreadGroup.Type;
export const SIDEBAR_THREAD_GROUPS_KEY = "t3code:sidebar-thread-groups:v1";

export function moveSidebarGroupThreads(
  groups: readonly SidebarThreadGroup[],
  threadKeys: readonly string[],
  target: SidebarThreadGroup | null,
): readonly SidebarThreadGroup[] {
  const moving = new Set(threadKeys);
  if (moving.size === 0) return groups;
  const next = groups.map((group) => ({
    ...group,
    threadKeys: group.threadKeys.filter((key) => !moving.has(key)),
  }));
  if (target) {
    const existing = next.find((group) => group.id === target.id);
    if (existing) existing.threadKeys.push(...moving);
    else next.push({ ...target, threadKeys: [...moving] });
  }
  return next.filter((group) => group.threadKeys.length > 0);
}

export function groupSidebarThreadsManually<T>(
  groups: readonly SidebarThreadGroup[],
  threads: readonly T[],
  key: (thread: T) => string,
) {
  const membership = new Map(
    groups.flatMap((group) => group.threadKeys.map((key) => [key, group] as const)),
  );
  const buckets: { group: SidebarThreadGroup | null; threads: T[] }[] = [];
  const byGroup = new Map<string, { group: SidebarThreadGroup; threads: T[] }>();
  for (const thread of threads) {
    const group = membership.get(key(thread));
    if (!group) {
      buckets.push({ group: null, threads: [thread] });
      continue;
    }
    let bucket = byGroup.get(group.id);
    if (!bucket) {
      bucket = { group, threads: [] };
      byGroup.set(group.id, bucket);
      buckets.push(bucket);
    }
    bucket.threads.push(thread);
  }
  return buckets;
}

export const SIDEBAR_ITEM_ORDER_KEY = "t3code:sidebar-item-order:v1";
export const SidebarItemOrder = Schema.Record(Schema.String, Schema.Array(Schema.String));

export function orderSidebarItems<T>(
  items: readonly T[],
  order: readonly string[],
  key: (item: T) => string,
): T[] {
  const ranks = new Map(order.map((id, index) => [id, index]));
  return [...items].sort(
    (a, b) => (ranks.get(key(a)) ?? Infinity) - (ranks.get(key(b)) ?? Infinity),
  );
}

export function moveSidebarItem(
  order: readonly string[],
  moving: readonly string[],
  target: string,
  after: boolean,
): string[] {
  if (moving.includes(target)) return [...order];
  const selected = new Set(moving);
  const next = order.filter((id) => !selected.has(id));
  const index = next.indexOf(target);
  if (index < 0) return [...order];
  next.splice(index + Number(after), 0, ...new Set(moving));
  return next;
}
