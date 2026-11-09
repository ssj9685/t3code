import {
  Settings2Icon,
  PilcrowIcon,
  ChevronsUpDownIcon,
  ChevronsDownUpIcon,
  FlaskConicalOffIcon,
} from "lucide-react";

import { Button } from "../ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function DiffOptionsMenu({
  ignoreWhitespace,
  onIgnoreWhitespaceChange,
  files,
  testFiles,
}: {
  ignoreWhitespace: boolean;
  onIgnoreWhitespaceChange: (value: boolean) => void;
  files: {
    collapsed: boolean;
    onToggleCollapsed: () => void;
  } | null;
  testFiles: { hidden: boolean; onHiddenChange: (value: boolean) => void } | null;
}) {
  return (
    <div className="shrink-0 @min-[24rem]/diff-toolbar:hidden">
      <Menu>
        <Tooltip>
          <TooltipTrigger
            render={
              <MenuTrigger
                render={
                  <Button
                    size="icon-sm"
                    variant={ignoreWhitespace || testFiles?.hidden ? "secondary" : "ghost"}
                  />
                }
                aria-label="More diff options"
              />
            }
          >
            <Settings2Icon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup side="top">More diff options</TooltipPopup>
        </Tooltip>
        <MenuPopup align="end">
          <MenuCheckboxItem checked={ignoreWhitespace} onCheckedChange={onIgnoreWhitespaceChange}>
            <span className="flex items-center gap-2">
              <PilcrowIcon aria-hidden className="size-4 shrink-0" />
              Hide whitespace changes
            </span>
          </MenuCheckboxItem>
          {files || testFiles ? <MenuSeparator /> : null}
          {files ? (
            <MenuItem onClick={files.onToggleCollapsed}>
              {files.collapsed ? (
                <ChevronsUpDownIcon aria-hidden />
              ) : (
                <ChevronsDownUpIcon aria-hidden />
              )}
              {files.collapsed ? "Expand all files" : "Collapse all files"}
            </MenuItem>
          ) : null}
          {testFiles ? (
            <MenuCheckboxItem checked={testFiles.hidden} onCheckedChange={testFiles.onHiddenChange}>
              <span className="flex items-center gap-2">
                <FlaskConicalOffIcon aria-hidden className="size-4 shrink-0" />
                Hide test files
              </span>
            </MenuCheckboxItem>
          ) : null}
        </MenuPopup>
      </Menu>
    </div>
  );
}
