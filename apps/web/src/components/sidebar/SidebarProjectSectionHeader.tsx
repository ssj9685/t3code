import { ChevronDownIcon, MoreHorizontalIcon } from "lucide-react";

import type { SidebarProjectSnapshot } from "../../sidebarProjectGrouping";
import type { SidebarSection } from "../Sidebar.logic";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { ProjectFavicon } from "../ProjectFavicon";

export function SidebarProjectSectionHeader(props: {
  rowId: string;
  section: Exclude<SidebarSection, "active">;
  group: SidebarProjectSnapshot;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
  onActions: (position: { x: number; y: number }) => void;
}) {
  return (
    <li className="relative mt-2 list-none" data-testid="sidebar-project-section">
      <button
        type="button"
        data-sidebar-row={props.rowId}
        data-sidebar-parent={props.section === "pinned" ? undefined : `shelf:${props.section}`}
        aria-label={`${props.group.displayName}: ${props.count} ${props.section} threads`}
        aria-expanded={!props.collapsed}
        className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-(--control-radius) px-(--sidebar-row-content-inset) text-left text-xs text-sidebar-muted-foreground outline-none hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        onClick={props.onToggle}
        onContextMenu={(event) => {
          event.preventDefault();
          props.onActions({ x: event.clientX, y: event.clientY });
        }}
      >
        <ProjectFavicon project={props.group} className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate font-medium">{props.group.displayName}</span>
        <span className="mr-6 tabular-nums">{props.count}</span>
        <ChevronDownIcon
          className={cn("size-3 shrink-0", props.collapsed && "-rotate-90")}
          aria-hidden
        />
      </button>
      <span className="absolute inset-y-0 right-6 flex items-center">
        <Button
          data-sidebar-action-for={props.rowId}
          size="icon-xs"
          variant="ghost-muted"
          aria-label={`${props.group.displayName}: actions for ${props.count} ${props.section} threads`}
          aria-haspopup="menu"
          onClick={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            props.onActions({ x: rect.left, y: rect.bottom });
          }}
        >
          <MoreHorizontalIcon aria-hidden />
        </Button>
      </span>
    </li>
  );
}
