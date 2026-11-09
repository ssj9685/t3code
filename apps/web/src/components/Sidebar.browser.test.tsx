import "../index.css";
import {
  DEFAULT_CLIENT_SETTINGS,
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import { render } from "../../test/render";
import { openCommandPalette } from "../commandPaletteBus";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { __setClientSettingsForTests, getClientSettings } from "../hooks/useSettings";
import { useProjects, useQuietThreadShells } from "../state/entities";
import { makeThreadFixture } from "../test-fixtures";
import type { Project } from "../types";
import Sidebar from "./Sidebar";
import { SIDEBAR_ITEM_ORDER_KEY, SIDEBAR_THREAD_GROUPS_KEY } from "./Sidebar.groups";
import { useThreadSelectionStore } from "../threadSelectionStore";
import { SidebarProvider } from "./ui/sidebar";

vi.mock("../state/entities", { spy: true });
vi.mock("../hooks/useHandleNewThread", { spy: true });
vi.mock("../commandPaletteBus", () => ({
  openCommandPalette: vi.fn(),
  isCommandPaletteOpen: () => false,
}));
vi.mock("./sidebar/SidebarChrome", () => ({
  SidebarChromeHeader: () => null,
  SidebarChromeFooter: () => null,
}));

function project(id: string): Project {
  return {
    id: ProjectId.make(id),
    environmentId: EnvironmentId.make("local"),
    title: id,
    workspaceRoot: `/projects/${id}`,
    repositoryIdentity: null,
    defaultModelSelection: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    scripts: [],
  };
}

describe("sidebar header new thread", () => {
  it.each([
    { mode: "normal", count: 2, shift: false, picker: true },
    { mode: "boring", count: 2, shift: false, picker: true },
    { mode: "boring", count: 2, shift: true, picker: false },
    { mode: "boring", count: 1, shift: false, picker: false },
    { mode: "legacy", count: 2, shift: false, picker: false },
  ] as const)("$mode sidebar, $count projects, shift=$shift: picker=$picker", async (scenario) => {
    using stack = new DisposableStack();
    const previousSettings = getClientSettings();
    stack.defer(() => __setClientSettingsForTests(previousSettings));
    __setClientSettingsForTests({
      ...DEFAULT_CLIENT_SETTINGS,
      boringSidebarEnabled: scenario.mode === "boring",
      legacySidebarEnabled: scenario.mode === "legacy",
    });
    const projects = [project("active"), project("idle")].slice(0, scenario.count);
    const currentProjectRef = {
      environmentId: projects[0]!.environmentId,
      projectId: projects[0]!.id,
    };
    const startThread = vi.fn().mockResolvedValue(null);
    vi.mocked(useProjects).mockReturnValue(projects);
    vi.mocked(useHandleNewThread).mockReturnValue({
      activeDraftThread: null,
      activeThread: null,
      defaultProjectRef: currentProjectRef,
      handleNewThread: startThread,
      routeDraftId: null,
      routeThreadRef: null,
    });
    vi.mocked(openCommandPalette).mockClear();
    await using screen = await render(
      <SidebarProvider>
        <div className="flex h-screen w-80 flex-col">
          <Sidebar routeReveal={{ observedKey: null, pendingKey: null }} />
        </div>
      </SidebarProvider>,
    );

    await userEvent.click(screen.getByRole("button", { name: "New thread", exact: true }), {
      modifiers: scenario.shift ? ["Shift"] : [],
    });

    if (scenario.picker) {
      expect(openCommandPalette).toHaveBeenCalledExactlyOnceWith({ open: "new-thread-in" });
      expect(startThread).not.toHaveBeenCalled();
    } else {
      expect(openCommandPalette).not.toHaveBeenCalled();
      expect(startThread).toHaveBeenCalledExactlyOnceWith(currentProjectRef);
    }
  });
});

it.each([
  { method: "selection", section: "Working" },
  { method: "drag", section: "Working" },
  { method: "drag", section: "Active" },
])(
  "creates manual groups with $method in $section and preserves them when collapsed",
  async ({ method, section }) => {
    using stack = new DisposableStack();
    const storedOrder = localStorage.getItem(SIDEBAR_ITEM_ORDER_KEY);
    localStorage.removeItem(SIDEBAR_ITEM_ORDER_KEY);
    stack.defer(() => {
      if (storedOrder === null) localStorage.removeItem(SIDEBAR_ITEM_ORDER_KEY);
      else localStorage.setItem(SIDEBAR_ITEM_ORDER_KEY, storedOrder);
    });
    const storedGroups = localStorage.getItem(SIDEBAR_THREAD_GROUPS_KEY);
    localStorage.removeItem(SIDEBAR_THREAD_GROUPS_KEY);
    stack.defer(() => {
      if (storedGroups === null) localStorage.removeItem(SIDEBAR_THREAD_GROUPS_KEY);
      else localStorage.setItem(SIDEBAR_THREAD_GROUPS_KEY, storedGroups);
      useThreadSelectionStore.getState().clearSelection();
    });
    const previousSettings = getClientSettings();
    stack.defer(() => __setClientSettingsForTests(previousSettings));
    __setClientSettingsForTests({
      ...DEFAULT_CLIENT_SETTINGS,
      boringSidebarEnabled: method === "selection",
      legacySidebarEnabled: false,
      sidebarWorkingShelfEnabled: section === "Working",
    });
    const projects = [project("alpha"), project("beta")];
    const threads = [projects[0]!, projects[1]!, projects[0]!].map((project, index) =>
      makeThreadFixture({
        id: ThreadId.make(`grouped-${index}`),
        title: `${section} task ${index}`,
        environmentId: project.environmentId,
        projectId: project.id,
        latestUserMessageAt: `2026-01-01T00:00:0${3 - index}.000Z`,
        runtime: {
          status: "running",
          activeRunId: null,
          providerInstanceId: ProviderInstanceId.make("codex"),
          providerName: "Codex",
          lastError: null,
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      }),
    );
    vi.mocked(useProjects).mockReturnValue(projects);
    vi.mocked(useQuietThreadShells).mockReturnValue(threads);
    stack.defer(() => vi.mocked(useQuietThreadShells).mockRestore());
    vi.mocked(useHandleNewThread).mockReturnValue({
      activeDraftThread: null,
      activeThread: null,
      defaultProjectRef: null,
      handleNewThread: vi.fn(),
      routeDraftId: null,
      routeThreadRef: null,
    });
    await using screen = await render(
      <SidebarProvider>
        <div className="flex h-screen w-80 flex-col">
          <Sidebar routeReveal={{ observedKey: null, pendingKey: null }} />
        </div>
      </SidebarProvider>,
    );
    if (section === "Working") {
      const shelf = screen.getByRole("button", { name: new RegExp(`^${section}\\s*3$`) });
      await expect.element(shelf).toBeVisible();
      if (shelf.element().getAttribute("aria-expanded") === "false") await userEvent.click(shelf);
    }
    const taskOrder = () =>
      [...screen.container.querySelectorAll<HTMLElement>("[data-sidebar-row]")]
        .map((row) => row.getAttribute("aria-label"))
        .filter((label) => label?.startsWith(`${section} task`));
    const settleMotion = async () => {
      await vi.waitFor(() => {
        expect(
          [...screen.container.querySelectorAll("li")]
            .flatMap((row) => row.getAnimations())
            .filter((animation) => animation.playState === "running"),
        ).toHaveLength(0);
      });
    };
    const flatOrder = taskOrder();
    expect(flatOrder).toHaveLength(3);
    expect(screen.container.querySelectorAll('[data-testid="sidebar-thread-group"]')).toHaveLength(
      0,
    );
    if (method === "selection") {
      await userEvent.click(screen.getByRole("button", { name: flatOrder[0]!, exact: true }), {
        modifiers: [/Mac/.test(navigator.platform) ? "Meta" : "Control"],
      });
      await userEvent.click(screen.getByRole("button", { name: flatOrder[1]!, exact: true }), {
        modifiers: [/Mac/.test(navigator.platform) ? "Meta" : "Control"],
      });
      await userEvent.click(
        screen.getByRole("button", { name: "Group selected threads", exact: true }),
      );
    } else {
      const source = screen.getByRole("button", { name: flatOrder[1]!, exact: true }).element();
      const target = screen.getByRole("button", { name: flatOrder[0]!, exact: true }).element();
      await settleMotion();
      const sourceRect = source.getBoundingClientRect();
      const pointer = { pointerId: 1, isPrimary: true, button: 0, buttons: 1, bubbles: true };
      source.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...pointer,
          clientX: sourceRect.left + 20,
          clientY: sourceRect.top + sourceRect.height / 2,
        }),
      );
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: sourceRect.left + 35,
          clientY: sourceRect.top + sourceRect.height / 2,
        }),
      );
      await vi.waitFor(() =>
        expect(screen.container.querySelector("[data-sidebar-drag-hint]")).not.toBeNull(),
      );
      await settleMotion();
      const targetRect = target.getBoundingClientRect();
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: targetRect.left + 20,
          clientY: targetRect.top + targetRect.height / 2,
        }),
      );
      await expect
        .element(screen.getByRole("status").filter({ hasText: "Create task group" }))
        .toBeVisible();
      const dropRect = target.getBoundingClientRect();
      document.dispatchEvent(
        new PointerEvent("pointerup", {
          ...pointer,
          buttons: 0,
          clientX: dropRect.left + 20,
          clientY: dropRect.top + dropRect.height / 2,
        }),
      );
    }
    const group = screen.getByRole("button", {
      name: `alpha: 2 ${section.toLowerCase()} threads`,
      exact: true,
    });
    await expect.element(group).toBeVisible();
    expect(screen.container.querySelectorAll('[data-testid="sidebar-thread-group"]')).toHaveLength(
      1,
    );
    expect(taskOrder()).toEqual(flatOrder);
    await userEvent.click(group);
    await expect.element(group).toHaveAttribute("aria-expanded", "false");
    expect(taskOrder()).toEqual([flatOrder[2]]);
    await expect
      .element(screen.getByRole("button", { name: "alpha: group actions", exact: true }))
      .toBeVisible();
    await userEvent.click(group);
    expect(taskOrder()).toEqual(flatOrder);
    if (method === "drag") {
      const pointer = { pointerId: 2, isPrimary: true, button: 0, buttons: 1, bubbles: true };
      const source = screen.getByRole("button", { name: flatOrder[2]!, exact: true }).element();
      await settleMotion();
      const sourceRect = source.getBoundingClientRect();
      source.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...pointer,
          clientX: sourceRect.left + 20,
          clientY: sourceRect.top + sourceRect.height / 2,
        }),
      );
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: sourceRect.left + 35,
          clientY: sourceRect.top + sourceRect.height / 2,
        }),
      );
      await vi.waitFor(() =>
        expect(screen.container.querySelector("[data-sidebar-drag-hint]")).not.toBeNull(),
      );
      await settleMotion();
      const targetRect = group.element().getBoundingClientRect();
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: targetRect.left + 20,
          clientY: targetRect.top + targetRect.height / 2,
        }),
      );
      await expect
        .element(screen.getByRole("status").filter({ hasText: "Add to alpha" }))
        .toBeVisible();
      const dropRect = group.element().getBoundingClientRect();
      document.dispatchEvent(
        new PointerEvent("pointerup", {
          ...pointer,
          buttons: 0,
          clientX: dropRect.left + 20,
          clientY: dropRect.top + dropRect.height / 2,
        }),
      );
      await expect
        .element(
          screen.getByRole("button", {
            name: `alpha: 3 ${section.toLowerCase()} threads`,
            exact: true,
          }),
        )
        .toBeVisible();
      const removeRect = source.getBoundingClientRect();
      source.dispatchEvent(
        new PointerEvent("pointerdown", {
          ...pointer,
          clientX: removeRect.left + 20,
          clientY: removeRect.top + removeRect.height / 2,
        }),
      );
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: removeRect.left + 30,
          clientY: removeRect.top + removeRect.height / 2,
        }),
      );
      await vi.waitFor(() =>
        expect(screen.container.querySelector("[data-group-drop]")).not.toBeNull(),
      );
      const removal = screen.container.querySelector("[data-group-drop]")!.getBoundingClientRect();
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: removal.left + 20,
          clientY: removal.top + removal.height / 2,
        }),
      );
      document.dispatchEvent(
        new PointerEvent("pointerup", {
          ...pointer,
          buttons: 0,
          clientX: removal.left + 20,
          clientY: removal.top + removal.height / 2,
        }),
      );
      await expect.element(group).toBeVisible();
      expect(taskOrder()).toHaveLength(3);
      const reorder = async (source: Element, target: Element, after: boolean, cancel = false) => {
        await settleMotion();
        const sourceRect = source.getBoundingClientRect();
        source.dispatchEvent(
          new PointerEvent("pointerdown", {
            ...pointer,
            clientX: sourceRect.left + 40,
            clientY: sourceRect.top + sourceRect.height / 2,
          }),
        );
        document.dispatchEvent(
          new PointerEvent("pointermove", {
            ...pointer,
            clientX: sourceRect.left + 55,
            clientY: sourceRect.top + sourceRect.height / 2,
          }),
        );
        await vi.waitFor(() =>
          expect(screen.container.querySelector("[data-sidebar-drag-hint]")).not.toBeNull(),
        );
        await settleMotion();
        const targetRect = target.getBoundingClientRect();
        document.dispatchEvent(
          new PointerEvent("pointermove", {
            ...pointer,
            clientX: targetRect.left + 40,
            clientY: after ? targetRect.bottom - 2 : targetRect.top + 2,
          }),
        );
        await expect
          .element(screen.getByRole("status").filter({ hasText: "Move here" }))
          .toBeVisible();
        expect(screen.container.querySelector("[data-sidebar-drop-space]")).toBeNull();
        await settleMotion();
        const sourceRow = source.closest("li")!;
        const targetRow = target.closest("li")!;
        expect(
          Boolean(sourceRow.compareDocumentPosition(targetRow) & Node.DOCUMENT_POSITION_FOLLOWING),
        ).toBe(!after);
        const previewOrder = taskOrder();
        const hint = screen.container
          .querySelector("[data-sidebar-drag-hint]")!
          .getBoundingClientRect();
        document.dispatchEvent(
          new PointerEvent("pointermove", {
            ...pointer,
            clientX: hint.left + 40,
            clientY: hint.top + hint.height / 2,
          }),
        );
        await expect
          .element(screen.getByRole("status").filter({ hasText: /Remove from group|Drag folder/ }))
          .toBeVisible();
        await settleMotion();
        expect(taskOrder()).toEqual(previewOrder);
        const space = source.getBoundingClientRect();
        if (cancel)
          document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true }));
        else {
          document.dispatchEvent(
            new PointerEvent("pointerup", {
              ...pointer,
              buttons: 0,
              clientX: space.left + 40,
              clientY: space.top + space.height / 2,
            }),
          );
        }
        await vi.waitFor(() =>
          expect(screen.container.querySelector("[data-sidebar-drag-hint]")).toBeNull(),
        );
      };
      const third = screen.getByRole("button", { name: flatOrder[2]!, exact: true });
      await reorder(third.element(), group.element(), false);
      await vi.waitFor(() =>
        expect(taskOrder()).toEqual([flatOrder[2], flatOrder[0], flatOrder[1]]),
      );
      await reorder(group.element(), third.element(), false);
      await vi.waitFor(() => expect(taskOrder()).toEqual(flatOrder));
      await reorder(
        screen.getByRole("button", { name: flatOrder[0]!, exact: true }).element(),
        screen.getByRole("button", { name: flatOrder[1]!, exact: true }).element(),
        true,
      );
      await vi.waitFor(() =>
        expect(taskOrder()).toEqual([flatOrder[1], flatOrder[0], flatOrder[2]]),
      );
      await reorder(third.element(), group.element(), false, true);
      expect(taskOrder()).toEqual([flatOrder[1], flatOrder[0], flatOrder[2]]);
      expect(screen.container.querySelector("[data-sidebar-drop-space]")).toBeNull();
      expect(
        JSON.parse(localStorage.getItem(SIDEBAR_ITEM_ORDER_KEY)!)[section.toLowerCase()],
      ).toHaveLength(4);
    }
    const persisted = JSON.parse(localStorage.getItem(SIDEBAR_THREAD_GROUPS_KEY)!);
    expect(persisted).toHaveLength(1);
    expect(persisted[0].threadKeys).toHaveLength(2);
  },
);
