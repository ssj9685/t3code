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
        <Sidebar routeReveal={{ observedKey: null, pendingKey: null }} />
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

it("collapses Working project groups and switches views without losing rows", async () => {
  const section = "Working";
  using stack = new DisposableStack();
  const previousSettings = getClientSettings();
  stack.defer(() => __setClientSettingsForTests(previousSettings));
  __setClientSettingsForTests({
    ...DEFAULT_CLIENT_SETTINGS,
    boringSidebarEnabled: false,
    legacySidebarEnabled: false,
    sidebarWorkingShelfEnabled: true,
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
      <Sidebar routeReveal={{ observedKey: null, pendingKey: null }} />
    </SidebarProvider>,
  );
  const shelf = screen.getByRole("button", { name: new RegExp(`^${section}\\s*3$`) });
  await expect.element(shelf).toBeVisible();
  if (shelf.element().getAttribute("aria-expanded") === "false") await userEvent.click(shelf);
  const taskOrder = () =>
    [...screen.container.querySelectorAll<HTMLElement>("[data-sidebar-row]")]
      .map((row) => row.getAttribute("aria-label"))
      .filter((label) => label?.startsWith(`${section} task`));
  const flatOrder = taskOrder();
  expect(flatOrder).toHaveLength(3);
  await userEvent.click(
    screen.getByRole("button", { name: "Group threads by project", exact: true }),
  );
  await expect
    .element(
      screen.getByRole("button", {
        name: `alpha: actions for 2 ${section.toLowerCase()} threads`,
        exact: true,
      }),
    )
    .toBeVisible();
  expect(taskOrder()).toEqual([flatOrder[0], flatOrder[2], flatOrder[1]]);
  const alphaGroup = screen.getByRole("button", {
    name: `alpha: 2 ${section.toLowerCase()} threads`,
    exact: true,
  });
  await userEvent.click(alphaGroup);
  await expect.element(alphaGroup).toHaveAttribute("aria-expanded", "false");
  expect(taskOrder()).toEqual([flatOrder[1]]);
  await expect
    .element(
      screen.getByRole("button", {
        name: `alpha: actions for 2 ${section.toLowerCase()} threads`,
        exact: true,
      }),
    )
    .toBeVisible();
  await userEvent.click(alphaGroup);
  await expect.element(alphaGroup).toHaveAttribute("aria-expanded", "true");
  expect(taskOrder()).toEqual([flatOrder[0], flatOrder[2], flatOrder[1]]);

  await userEvent.click(
    screen.getByRole("button", { name: "Group threads by project", exact: true }),
  );
  await expect
    .element(screen.getByRole("button", { name: "Group threads by project", exact: true }))
    .toHaveAttribute("aria-pressed", "false");
  expect(taskOrder()).toEqual(flatOrder);
});
