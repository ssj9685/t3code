import { describe, expect, it } from "vite-plus/test";
import {
  groupSidebarThreadsManually,
  moveSidebarGroupThreads,
  moveSidebarItem,
  orderSidebarItems,
} from "./Sidebar.groups";

describe("manual sidebar groups", () => {
  it("moves only chosen threads and keeps membership across sections, filters, and environments", () => {
    const first = { id: "first", name: "Release", threadKeys: ["local:a", "remote:a", "local:b"] };
    const second = { id: "second", name: "Review", threadKeys: ["local:c"] };
    const moved = moveSidebarGroupThreads([first, second], ["local:b", "local:b"], second);
    expect(moved).toEqual([
      { ...first, threadKeys: ["local:a", "remote:a"] },
      { ...second, threadKeys: ["local:c", "local:b"] },
    ]);
    const key = (thread: { key: string }) => thread.key;
    const rows = ["local:a", "ungrouped", "local:c", "remote:a", "local:b"].map((key) => ({ key }));
    expect(
      groupSidebarThreadsManually(moved, rows, key).map((bucket) => [
        bucket.group?.id,
        bucket.threads.map(key),
      ]),
    ).toEqual([
      ["first", ["local:a", "remote:a"]],
      [undefined, ["ungrouped"]],
      ["second", ["local:c", "local:b"]],
    ]);
    expect(groupSidebarThreadsManually(moved, [rows[3]!], key)[0]?.group?.id).toBe("first");
    expect(moved[0]?.threadKeys).toEqual(["local:a", "remote:a"]);
    expect(moveSidebarGroupThreads(moved, ["local:c", "local:b"], null)).toEqual([moved[0]]);
    expect(
      moveSidebarGroupThreads([], ["local:a", "local:b"], {
        id: "new",
        name: "Work",
        threadKeys: [],
      }),
    ).toEqual([{ id: "new", name: "Work", threadKeys: ["local:a", "local:b"] }]);
  });
});

it("orders folders and tasks independently without losing filtered or remote entries", () => {
  const initial = ["group:a", "local:a", "remote:a", "local:b", "group:b"];
  const moved = moveSidebarItem(initial, ["group:b"], "local:b", false);
  expect(moved).toEqual(["group:a", "local:a", "remote:a", "group:b", "local:b"]);
  expect(moveSidebarItem(moved, ["remote:a", "local:a"], "local:b", true)).toEqual([
    "group:a",
    "group:b",
    "local:b",
    "remote:a",
    "local:a",
  ]);
  expect(orderSidebarItems(["local:b", "new", "group:b"], moved, (key) => key)).toEqual([
    "group:b",
    "local:b",
    "new",
  ]);
  expect(moveSidebarItem(initial, ["local:a"], "local:a", false)).toEqual(initial);
});
