import { useDraggable } from "@dnd-kit/core";
import { ProjectFavicon, type ProjectFaviconProject } from "../ProjectFavicon";
import { Tooltip, TooltipTrigger, TooltipPopup } from "../ui/tooltip";
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
  projects: readonly (ProjectFaviconProject & { key: string; label: string })[];
  collapsed: boolean;
  dropTarget: boolean;
  renaming: boolean;
  onRename: (name: string | null) => void;
  onToggle: () => void;
  onActions: (position: { x: number; y: number }) => void;
}) {
  const { listeners, setNodeRef, isDragging } = useDraggable({
    id: props.rowId,
    disabled: props.renaming,
  });
  return (
    <li
      ref={setNodeRef}
      className={cn("relative mt-2 list-none", isDragging && "opacity-50")}
      data-testid="sidebar-thread-group"
      data-thread-group={props.group.id}
    >
      {props.renaming ? (
        <GroupNameEditor key={props.group.id} name={props.group.name} onFinish={props.onRename} />
      ) : (
        <Tooltip>
          <TooltipTrigger
            render={<button />}
            {...listeners}
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
            <span className="relative flex size-4 shrink-0 items-center justify-center" aria-hidden>
              <FolderIcon className="size-4" aria-hidden />
              {props.projects.length > 1 ? (
                <span className="absolute -right-1 -bottom-1 flex size-3 items-center justify-center rounded-full bg-sidebar-foreground text-sidebar text-4xs font-semibold ring-1 ring-sidebar">
                  {props.projects.length}
                </span>
              ) : null}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{props.group.name}</span>
            <span className="mr-6 tabular-nums">{props.count}</span>
            <ChevronDownIcon
              className={cn("size-3 shrink-0", props.collapsed && "-rotate-90")}
              aria-hidden
            />
          </TooltipTrigger>
          <TooltipPopup side="right" align="start">
            <div className="flex max-w-60 flex-col gap-2 py-1">
              <div className="flex -space-x-2">
                {props.projects.slice(0, 5).map((project) => (
                  <span
                    key={project.key}
                    className="flex size-7 items-center justify-center overflow-hidden rounded-full border border-sidebar-border bg-accent ring-2 ring-popover"
                  >
                    <ProjectFavicon project={project} className="size-4" />
                  </span>
                ))}
                {props.projects.length > 5 ? (
                  <span className="flex size-7 items-center justify-center rounded-full bg-sidebar ring-2 ring-popover">
                    +{props.projects.length - 5}
                  </span>
                ) : null}
              </div>
              {props.projects.map((project) => (
                <span key={project.key}>{project.label}</span>
              ))}
            </div>
          </TooltipPopup>
        </Tooltip>
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
