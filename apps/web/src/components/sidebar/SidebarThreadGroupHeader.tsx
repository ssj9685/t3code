import { ChevronDownIcon, FolderIcon, MoreHorizontalIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";
import type { SidebarThreadGroup } from "../Sidebar.groups";
import type { SidebarSection } from "../Sidebar.logic";

export function SidebarThreadGroupHeader(props: {
  rowId: string;
  section: SidebarSection;
  group: SidebarThreadGroup;
  count: number;
  collapsed: boolean;
  dropTarget: boolean;
  renaming: boolean;
  onRename: (name: string | null) => void;
  onToggle: () => void;
  onActions: (position: { x: number; y: number }) => void;
}) {
  return (
    <li
      className="relative mt-2 list-none"
      data-testid="sidebar-thread-group"
      data-thread-group={props.group.id}
    >
      {props.renaming ? (
        <GroupNameEditor key={props.group.id} name={props.group.name} onFinish={props.onRename} />
      ) : (
        <button
          type="button"
          data-sidebar-row={props.rowId}
          data-sidebar-parent={
            props.section === "pinned" || props.section === "active"
              ? undefined
              : `shelf:${props.section}`
          }
          aria-label={`${props.group.name}: ${props.count} ${props.section} threads`}
          aria-expanded={!props.collapsed}
          className={cn(
            "flex h-8 w-full cursor-pointer items-center gap-2 rounded-(--control-radius) px-(--sidebar-row-content-inset) text-left text-xs text-sidebar-muted-foreground outline-none hover:bg-sidebar-row-hover focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            props.dropTarget && "bg-sidebar-row-active ring-2 ring-inset ring-ring",
          )}
          onClick={props.onToggle}
          onContextMenu={(event) => {
            event.preventDefault();
            props.onActions({ x: event.clientX, y: event.clientY });
          }}
        >
          <FolderIcon className="size-3.5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1 truncate font-medium">{props.group.name}</span>
          <span className="mr-6 tabular-nums">{props.count}</span>
          <ChevronDownIcon
            className={cn("size-3 shrink-0", props.collapsed && "-rotate-90")}
            aria-hidden
          />
        </button>
      )}
      {!props.renaming ? (
        <span className="absolute inset-y-0 right-6 flex items-center">
          <Button
            data-sidebar-action-for={props.rowId}
            size="icon-xs"
            variant="ghost-muted"
            aria-label={`${props.group.name}: group actions`}
            aria-haspopup="menu"
            onClick={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              props.onActions({ x: rect.left, y: rect.bottom });
            }}
          >
            <MoreHorizontalIcon aria-hidden />
          </Button>
        </span>
      ) : null}
    </li>
  );
}

function GroupNameEditor(props: { name: string; onFinish: (name: string | null) => void }) {
  const [name, setName] = useState(props.name);
  return (
    <Input
      autoFocus
      aria-label="Group name"
      value={name}
      onChange={(event) => setName(event.target.value)}
      onBlur={() => props.onFinish(name.trim() || null)}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
          event.preventDefault();
          props.onFinish(name.trim() || null);
        }
        if (event.key === "Escape") {
          event.preventDefault();
          props.onFinish(null);
        }
      }}
    />
  );
}
