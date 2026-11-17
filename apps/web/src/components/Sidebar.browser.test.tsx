import "../index.css";
import {
  DEFAULT_CLIENT_SETTINGS,
  ServerConfig,
  EnvironmentId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import * as Schema from "effect/Schema";
import { AsyncResult } from "effect/reactivity";
import { useThreadActions } from "../hooks/useThreadActions";
import { readEnvironmentScope } from "../state/session";

import { render } from "../../test/render";
import { openCommandPalette } from "../commandPaletteBus";
import { useHandleNewThread } from "../hooks/useHandleNewThread";
import { __setClientSettingsForTests, getClientSettings } from "../hooks/useSettings";
import { useProjects, useQuietThreadShells, useServerConfigs } from "../state/entities";
import { makeThreadFixture } from "../test-fixtures";
import type { Project } from "../types";
import Sidebar from "./Sidebar";
import { SIDEBAR_ITEM_ORDER_KEY, SIDEBAR_THREAD_GROUPS_KEY } from "./Sidebar.groups";
import { useThreadSelectionStore } from "../threadSelectionStore";
import { SidebarProvider } from "./ui/sidebar";

vi.mock("../state/entities", { spy: true });
vi.mock("../hooks/useThreadActions", { spy: true });
vi.mock("../state/session", { spy: true });
vi.mock("../hooks/useHandleNewThread", { spy: true });
vi.mock("../commandPaletteBus", () => ({
  openCommandPalette: vi.fn(),
  isCommandPaletteOpen: () => false,
}));
vi.mock("./sidebar/SidebarChrome", () => ({
  SidebarChromeHeader: () => null,
  SidebarChromeFooter: () => null,
}));

const decodeServerConfig = Schema.decodeUnknownSync(ServerConfig);

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
  { method: "selection", section: "Working", targetIndex: 0, sparseOrder: false },
  { method: "drag", section: "Working", targetIndex: 0, sparseOrder: false },
  { method: "drag", section: "Active", targetIndex: 0, sparseOrder: false },
  { method: "drag", section: "Working", targetIndex: 2, sparseOrder: true },
  { method: "drag", section: "Active", targetIndex: 2, sparseOrder: false },
])(
  "creates groups with $method in $section at row $targetIndex, sparse order $sparseOrder",
  async ({ method, section, targetIndex, sparseOrder }) => {
    using stack = new DisposableStack();
    const storedOrder = localStorage.getItem(SIDEBAR_ITEM_ORDER_KEY);
    localStorage.removeItem(SIDEBAR_ITEM_ORDER_KEY);
    if (sparseOrder)
      localStorage.setItem(
        SIDEBAR_ITEM_ORDER_KEY,
        JSON.stringify({ [section.toLowerCase()]: ["local:grouped-0"] }),
      );
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
      const source = screen
        .getByRole("button", { name: flatOrder[targetIndex === 2 ? 0 : 1]!, exact: true })
        .element();
      const target = screen
        .getByRole("button", { name: flatOrder[targetIndex]!, exact: true })
        .element();
      await settleMotion();
      const sourceRect = source.getBoundingClientRect();
      const grabOffsetY =
        sourceRect.top + sourceRect.height / 2 - source.closest("li")!.getBoundingClientRect().top;
      const viewport = source.closest<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
      const settled = screen.container.querySelector<HTMLElement>(
        '[data-testid="sidebar-settled-header"]',
      )!;
      const settledTop = settled.getBoundingClientRect().top;
      const settledContents = settled.innerHTML;
      const scrollTop = viewport.scrollTop;
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
        expect(document.querySelector("[data-sidebar-dragging]")).not.toBeNull(),
      );
      await settleMotion();
      const dragImage = document.querySelector<HTMLElement>("[data-sidebar-drag-image]");
      expect(dragImage).not.toBeNull();
      expect(dragImage!.dataset.sidebarDragImage).toBe(source.getAttribute("data-sidebar-row"));
      const draggedContent = dragImage!.textContent;
      expect(dragImage!.querySelector('[role="button"]')?.getAttribute("aria-label")).toBe(
        source.getAttribute("aria-label"),
      );
      const targetRect = target.getBoundingClientRect();
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: targetRect.left + 20,
          clientY: targetRect.top + targetRect.height / 2,
        }),
      );
      const preview = screen.getByRole("button", {
        name: `alpha: 2 ${section.toLowerCase()} threads`,
        exact: true,
      });
      await expect.element(preview).toBeVisible();
      expect(target.getAttribute("data-sidebar-parent")).toMatch(/^group:/);
      expect(source.getAttribute("data-sidebar-parent")).toBe(
        target.getAttribute("data-sidebar-parent"),
      );
      expect(dragImage!.textContent).toBe(draggedContent);
      expect(dragImage!.getBoundingClientRect().top).toBeCloseTo(
        targetRect.top + targetRect.height / 2 - grabOffsetY,
        0,
      );
      await settleMotion();
      const previewTargetTop = target.getBoundingClientRect().top;
      expect(preview.element().getBoundingClientRect().top).toBeGreaterThanOrEqual(
        viewport.getBoundingClientRect().top,
      );
      expect(viewport.scrollTop).toBe(scrollTop);
      expect(settled.getBoundingClientRect().top).toBeCloseTo(settledTop, 0);
      expect(settled.innerHTML).toBe(settledContents);
      if (targetIndex === 0) {
        const other = screen.getByRole("button", { name: flatOrder[2]!, exact: true }).element();
        const otherRect = other.getBoundingClientRect();
        document.dispatchEvent(
          new PointerEvent("pointermove", {
            ...pointer,
            clientX: otherRect.left + 20,
            clientY: otherRect.top + otherRect.height / 2,
          }),
        );
        await vi.waitFor(() =>
          expect(other.getAttribute("data-sidebar-parent")).toBe(
            source.getAttribute("data-sidebar-parent"),
          ),
        );
        expect(target.getAttribute("data-sidebar-parent") ?? "").not.toMatch(/^group:/);
        expect(dragImage!.textContent).toBe(draggedContent);
        await settleMotion();
        const returnRect = target.getBoundingClientRect();
        document.dispatchEvent(
          new PointerEvent("pointermove", {
            ...pointer,
            clientX: returnRect.left + 20,
            clientY: returnRect.top + returnRect.height / 2,
          }),
        );
        await vi.waitFor(() =>
          expect(target.getAttribute("data-sidebar-parent")).toBe(
            source.getAttribute("data-sidebar-parent"),
          ),
        );
        expect(other.getAttribute("data-sidebar-parent") ?? "").not.toMatch(/^group:/);
      }
      if (targetIndex === 2)
        expect(taskOrder()).toEqual([flatOrder[1], flatOrder[0], flatOrder[2]]);
      expect(JSON.parse(localStorage.getItem(SIDEBAR_THREAD_GROUPS_KEY) ?? "[]")).toEqual([]);
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: -40,
          clientY: targetRect.top + targetRect.height / 2,
        }),
      );
      await expect.element(preview).not.toBeInTheDocument();
      await settleMotion();
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: -45,
          clientY: targetRect.top + targetRect.height / 2,
        }),
      );
      expect(target.getBoundingClientRect().top).toBeCloseTo(targetRect.top, 0);
      expect(JSON.parse(localStorage.getItem(SIDEBAR_THREAD_GROUPS_KEY) ?? "[]")).toEqual([]);
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: targetRect.left + 20,
          clientY: targetRect.top + targetRect.height / 2,
        }),
      );
      await expect.element(preview).toBeVisible();
      expect(document.querySelector("[data-sidebar-drag-image]")).toBe(dragImage);
      expect(dragImage!.textContent).toBe(draggedContent);
      const dropRect = targetRect;
      document.dispatchEvent(
        new PointerEvent("pointerup", {
          ...pointer,
          buttons: 0,
          clientX: dropRect.left + 20,
          clientY: dropRect.top + dropRect.height / 2,
        }),
      );
      await vi.waitFor(() => expect(document.querySelector("[data-sidebar-dragging]")).toBeNull());
      await settleMotion();
      expect(target.getBoundingClientRect().top).toBeCloseTo(previewTargetTop, 0);
      expect(document.querySelector("[data-sidebar-drag-image]")).toBeNull();
      expect(
        JSON.parse(localStorage.getItem(SIDEBAR_THREAD_GROUPS_KEY)!)[0].threadKeys.toSorted(),
      ).toEqual(
        [
          source.getAttribute("data-sidebar-row"),
          target.getAttribute("data-sidebar-row"),
        ].toSorted(),
      );
      expect(settled.getBoundingClientRect().top).toBeCloseTo(settledTop, 0);
      expect(viewport.scrollTop).toBe(scrollTop);
    }
    const group = screen.getByRole("button", {
      name: `alpha: 2 ${section.toLowerCase()} threads`,
      exact: true,
    });
    await expect.element(group).toBeVisible();
    expect(screen.container.querySelectorAll('[data-testid="sidebar-thread-group"]')).toHaveLength(
      1,
    );
    if (targetIndex === 2) {
      await vi.waitFor(() => expect(document.querySelector("[data-sidebar-dragging]")).toBeNull());
      expect(taskOrder()).toEqual([flatOrder[1], flatOrder[0], flatOrder[2]]);
      expect(
        JSON.parse(localStorage.getItem(SIDEBAR_THREAD_GROUPS_KEY)!)[0].threadKeys,
      ).toHaveLength(2);
      return;
    }
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
        expect(document.querySelector("[data-sidebar-dragging]")).not.toBeNull(),
      );
      await settleMotion();
      const groupElement = group.element();
      const targetRect = groupElement.getBoundingClientRect();
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: targetRect.left + 20,
          clientY: targetRect.top + targetRect.height / 2,
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
      expect(
        JSON.parse(localStorage.getItem(SIDEBAR_THREAD_GROUPS_KEY)!)[0].threadKeys,
      ).toHaveLength(2);
      const dropRect = targetRect;
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
      await vi.waitFor(() => expect(document.querySelector("[data-sidebar-dragging]")).toBeNull());
      expect(
        JSON.parse(localStorage.getItem(SIDEBAR_THREAD_GROUPS_KEY)!)[0].threadKeys,
      ).toHaveLength(3);
      await settleMotion();
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
        expect(document.querySelector("[data-sidebar-dragging]")).not.toBeNull(),
      );
      await settleMotion();
      const removal = source.closest("ul")!.getBoundingClientRect();
      const removalY =
        source.getBoundingClientRect().top + source.getBoundingClientRect().height / 2;
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          ...pointer,
          clientX: removal.left + 2,
          clientY: removalY,
        }),
      );
      await expect.element(group).toBeVisible();
      expect(source.getAttribute("data-sidebar-parent") ?? "").not.toMatch(/^group:/);
      await settleMotion();
      expect(
        JSON.parse(localStorage.getItem(SIDEBAR_THREAD_GROUPS_KEY)!)[0].threadKeys,
      ).toHaveLength(3);
      document.dispatchEvent(
        new PointerEvent("pointerup", {
          ...pointer,
          buttons: 0,
          clientX: removal.left + 2,
          clientY: removalY,
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
          expect(document.querySelector("[data-sidebar-dragging]")).not.toBeNull(),
        );
        await settleMotion();
        const targetRect = target.getBoundingClientRect();
        document.dispatchEvent(
          new PointerEvent("pointermove", {
            ...pointer,
            clientX: targetRect.left + 40,
            clientY: targetRect.top + targetRect.height * (after ? 0.7 : 0.3),
          }),
        );
        await vi.waitFor(() =>
          expect(
            Boolean(
              source.closest("li")!.compareDocumentPosition(target.closest("li")!) &
              Node.DOCUMENT_POSITION_FOLLOWING,
            ),
          ).toBe(!after),
        );
        expect(screen.container.querySelector("[data-sidebar-drop-space]")).toBeNull();
        await settleMotion();
        const sourceRow = source.closest("li")!;
        const targetRow = target.closest("li")!;
        expect(
          Boolean(sourceRow.compareDocumentPosition(targetRow) & Node.DOCUMENT_POSITION_FOLLOWING),
        ).toBe(!after);
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
          expect(document.querySelector("[data-sidebar-dragging]")).toBeNull(),
        );
        expect(document.querySelector("[data-sidebar-drag-image]")).toBeNull();
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

it.each([
  { section: "Active", outcome: "drop", initiallyOpen: false },
  { section: "Active", outcome: "cancel", initiallyOpen: false },
  { section: "Active", outcome: "leave", initiallyOpen: false },
  { section: "Active", outcome: "drop", initiallyOpen: true },
  { section: "Active", outcome: "cancel", initiallyOpen: true },
  { section: "Active", outcome: "leave", initiallyOpen: true },
  { section: "Pinned", outcome: "cancel", initiallyOpen: false },
  { section: "Working", outcome: "cancel", initiallyOpen: false },
] as const)(
  "restores Settled after $section drag: $outcome, initially open=$initiallyOpen",
  async ({ section, outcome, initiallyOpen }) => {
    using stack = new DisposableStack();
    const previousSettings = getClientSettings();
    stack.defer(() => __setClientSettingsForTests(previousSettings));
    __setClientSettingsForTests({
      ...DEFAULT_CLIENT_SETTINGS,
      sidebarWorkingShelfEnabled: section === "Working",
      boringSidebarEnabled: false,
      legacySidebarEnabled: false,
    });
    for (const key of ["t3code:sidebar:settled-expanded", SIDEBAR_THREAD_GROUPS_KEY]) {
      const previous = localStorage.getItem(key);
      localStorage.removeItem(key);
      stack.defer(() =>
        previous === null ? localStorage.removeItem(key) : localStorage.setItem(key, previous),
      );
    }
    localStorage.setItem("t3code:sidebar:settled-expanded", JSON.stringify(initiallyOpen));
    const workspace = project("settle-test");
    const source = makeThreadFixture({
      id: ThreadId.make("move-to-settled"),
      environmentId: workspace.environmentId,
      projectId: workspace.id,
      title: "Moving thread",
      pinnedAt: section === "Pinned" ? "2026-01-01T00:00:00.000Z" : null,
      runtime: {
        status: "running",
        activeRunId: null,
        providerInstanceId: ProviderInstanceId.make("codex"),
        providerName: "Codex",
        lastError: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    });
    const saved = makeThreadFixture({
      id: ThreadId.make("already-settled"),
      environmentId: workspace.environmentId,
      projectId: workspace.id,
      title: "Saved thread",
      settledOverride: "settled",
      settledAt: "2026-01-01T00:00:00.000Z",
    });
    const config = decodeServerConfig({
      environment: {
        environmentId: workspace.environmentId,
        label: "Local",
        platform: { os: "linux", arch: "x64" },
        serverVersion: "1.0.0",
        capabilities: {},
      },
      auth: {
        policy: "loopback-browser",
        bootstrapMethods: ["one-time-token"],
        sessionMethods: ["browser-session-cookie"],
        sessionCookieName: "t3_session",
      },
      cwd: "/workspace",
      keybindingsConfigPath: "/workspace/keybindings.json",
      keybindings: [],
      issues: [],
      providers: [],
      availableEditors: [],
      observability: {
        logsDirectoryPath: "/logs",
        localTracingEnabled: false,
        otlpTracesEnabled: false,
        otlpMetricsEnabled: false,
      },
      settings: {},
    });
    vi.mocked(useProjects).mockReturnValue([workspace]);
    vi.mocked(useQuietThreadShells).mockReturnValue([source, saved]);
    vi.mocked(useServerConfigs).mockReturnValue(new Map([[workspace.environmentId, config]]));
    vi.mocked(readEnvironmentScope).mockReturnValue(true);
    const { useThreadActions: useActualActions } = await vi.importActual<
      typeof import("../hooks/useThreadActions")
    >("../hooks/useThreadActions");
    const settle = vi.fn().mockResolvedValue(AsyncResult.success(undefined));
    vi.mocked(useThreadActions).mockImplementation(() => ({
      ...useActualActions(),
      settleThread: settle,
    }));
    stack.defer(() => {
      vi.mocked(useQuietThreadShells).mockRestore();
      vi.mocked(useServerConfigs).mockRestore();
      vi.mocked(readEnvironmentScope).mockRestore();
      vi.mocked(useThreadActions).mockRestore();
    });
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
      const working = screen.getByRole("button", { name: /^Working\s*1$/ });
      if (working.element().getAttribute("aria-expanded") === "false")
        await userEvent.click(working);
    }
    const shelf = screen.getByRole("button", { name: /^Settled\s*1$/ });
    await expect.element(shelf).toHaveAttribute("aria-expanded", String(initiallyOpen));
    const row = screen.getByRole("button", { name: /^Moving thread,/ }).element();
    const rect = row.getBoundingClientRect();
    const grabOffsetY = rect.top + rect.height / 2 - row.closest("li")!.getBoundingClientRect().top;
    const pauseMotionAt = (fraction: number) => {
      for (const item of screen.container.querySelectorAll("li")) {
        for (const animation of item.getAnimations()) {
          const duration = animation.effect?.getComputedTiming().duration;
          if (typeof duration === "number") {
            animation.pause();
            animation.currentTime = duration * fraction;
          }
        }
      }
    };
    const pointer = { pointerId: 12, isPrimary: true, button: 0, buttons: 1, bubbles: true };
    row.dispatchEvent(
      new PointerEvent("pointerdown", {
        ...pointer,
        clientX: rect.left + 30,
        clientY: rect.top + rect.height / 2,
      }),
    );
    document.dispatchEvent(
      new PointerEvent("pointermove", {
        ...pointer,
        clientX: rect.left + 45,
        clientY: rect.top + rect.height / 2,
      }),
    );
    await vi.waitFor(() =>
      expect(document.querySelector("[data-sidebar-dragging]")).not.toBeNull(),
    );
    const destination = shelf.element().getBoundingClientRect();
    const point = {
      clientX: destination.left + 30,
      clientY: destination.top + destination.height / 2,
    };
    document.dispatchEvent(new PointerEvent("pointermove", { ...pointer, ...point }));
    if (section === "Active") {
      await expect.element(shelf).toHaveAttribute("aria-expanded", "true");
      const dragImage = document.querySelector<HTMLElement>("[data-sidebar-drag-image]")!;
      expect(dragImage.dataset.sidebarDragImage).toBe(row.getAttribute("data-sidebar-row"));
      expect(dragImage.getBoundingClientRect().top).toBeCloseTo(point.clientY - grabOffsetY, 0);
      await expect.element(screen.getByRole("button", { name: /^Saved thread,/ })).toBeVisible();
      expect(
        screen.container.querySelector('[data-testid="sidebar-settled-placeholder"]')?.textContent,
      ).toBe("");
      document.dispatchEvent(new PointerEvent("pointermove", { ...pointer, ...point }));
      await expect.element(shelf).toHaveAttribute("aria-expanded", "true");
      if (outcome === "drop") {
        document.dispatchEvent(new PointerEvent("pointerup", { ...pointer, ...point, buttons: 0 }));
        await vi.waitFor(() =>
          expect(settle).toHaveBeenCalledExactlyOnceWith({
            environmentId: workspace.environmentId,
            threadId: source.id,
          }),
        );
        await expect
          .element(screen.getByTestId("sidebar-settled-shelf-toggle"))
          .toHaveAttribute("aria-expanded", "true");
        expect(JSON.parse(localStorage.getItem(SIDEBAR_THREAD_GROUPS_KEY) ?? "[]")).toEqual([]);
        await expect
          .element(screen.getByRole("button", { name: /^Moving thread,/ }))
          .toHaveAttribute("data-sidebar-parent", "shelf:settled");
      } else {
        if (outcome === "leave") {
          pauseMotionAt(0.5);
          const beforeClosing = shelf.element().getBoundingClientRect().top;
          document.dispatchEvent(
            new PointerEvent("pointermove", { ...pointer, clientX: -40, clientY: point.clientY }),
          );
          await expect.element(shelf).toHaveAttribute("aria-expanded", String(initiallyOpen));
          pauseMotionAt(0);
          expect(shelf.element().getBoundingClientRect().top).toBeCloseTo(beforeClosing, 0);
          const reentry = shelf.element().getBoundingClientRect();
          document.dispatchEvent(
            new PointerEvent("pointermove", {
              ...pointer,
              clientX: reentry.left + 30,
              clientY: reentry.top + reentry.height / 2,
            }),
          );
          await expect.element(shelf).toHaveAttribute("aria-expanded", "true");
          pauseMotionAt(0);
          expect(shelf.element().getBoundingClientRect().top).toBeCloseTo(reentry.top, 0);
          expect(dragImage.getBoundingClientRect().top).toBeCloseTo(
            reentry.top + reentry.height / 2 - grabOffsetY,
            0,
          );
        }
        document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true }));
        await vi.waitFor(() =>
          expect(document.querySelector("[data-sidebar-dragging]")).toBeNull(),
        );
        expect(settle).not.toHaveBeenCalled();
        await expect.element(shelf).toHaveAttribute("aria-expanded", String(initiallyOpen));
      }
    } else {
      await expect.element(shelf).toHaveAttribute("aria-expanded", "false");
      expect(settle).not.toHaveBeenCalled();
      document.dispatchEvent(new KeyboardEvent("keydown", { code: "Escape", bubbles: true }));
    }
  },
);
