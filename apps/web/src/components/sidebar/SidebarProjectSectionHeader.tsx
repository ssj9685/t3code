import { MoreHorizontalIcon } from "lucide-react";

import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import type { SidebarSection } from "../Sidebar.logic";
import { ProjectFavicon } from "../ProjectFavicon";

export function SidebarProjectSectionHeader(props: {
  rowId: string;
  section: Exclude<SidebarSection, "active">;
  group: SidebarProjectSnapshot;
  count: number;
  onActions: (position: { x: number; y: number }) => void;
}) {
  return (
    <li className="mt-2 list-none" data-testid="sidebar-project-section">
      <button
        type="button"
        data-sidebar-row={props.rowId}
        data-sidebar-parent={props.section === "pinned" ? undefined : `shelf:${props.section}`}
        aria-label={`${props.group.displayName}: actions for ${props.count} ${props.section} threads`}
        aria-haspopup="menu"
        className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-(--control-radius) px-(--sidebar-row-content-inset) text-left text-xs text-sidebar-muted-foreground outline-none hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          props.onActions({ x: rect.left, y: rect.bottom });
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          props.onActions({ x: event.clientX, y: event.clientY });
        }}
      >
        <ProjectFavicon project={props.group} className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">{props.group.displayName}</span>
        <span className="tabular-nums">{props.count}</span>
        <MoreHorizontalIcon className="size-3.5 shrink-0" aria-hidden />
      </button>
    </li>
  );
}
