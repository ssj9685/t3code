import { Settings2Icon } from "lucide-react";

import { Button } from "../ui/button";
import {
  Menu,
  MenuCheckboxItem,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "../ui/menu";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";

export function DiffOptionsMenu({
  wordWrap,
  onWordWrapChange,
  ignoreWhitespace,
  onIgnoreWhitespaceChange,
  diffLayout,
  onDiffLayoutChange,
  files,
  testFiles,
}: {
  wordWrap: boolean;
  onWordWrapChange: (value: boolean) => void;
  ignoreWhitespace: boolean;
  onIgnoreWhitespaceChange: (value: boolean) => void;
  diffLayout: "stacked" | "split";
  onDiffLayoutChange: (value: "stacked" | "split") => void;
  files: {
    collapsed: boolean;
    onToggleCollapsed: () => void;
    treeOpen: boolean;
    onTreeOpenChange: (value: boolean) => void;
  } | null;
  testFiles: { hidden: boolean; onHiddenChange: (value: boolean) => void } | null;
}) {
  return (
    <div className="shrink-0 @min-[36rem]/diff-toolbar:hidden">
      <Menu>
        <Tooltip>
          <TooltipTrigger
            render={
              <MenuTrigger
                render={<Button size="icon-sm" variant="ghost" />}
                aria-label="Diff options"
              />
            }
          >
            <Settings2Icon className="size-3.5" />
          </TooltipTrigger>
          <TooltipPopup side="top">Diff options</TooltipPopup>
        </Tooltip>
        <MenuPopup align="end">
          <MenuCheckboxItem checked={wordWrap} onCheckedChange={onWordWrapChange}>
            Wrap lines
          </MenuCheckboxItem>
          <MenuCheckboxItem checked={ignoreWhitespace} onCheckedChange={onIgnoreWhitespaceChange}>
            Hide whitespace changes
          </MenuCheckboxItem>
          <MenuSeparator />
          <MenuRadioGroup
            value={diffLayout}
            onValueChange={(value) => {
              if (value === "stacked" || value === "split") onDiffLayoutChange(value);
            }}
          >
            <MenuRadioItem value="stacked" closeOnClick>
              Stacked
            </MenuRadioItem>
            <MenuRadioItem value="split" closeOnClick>
              Split
            </MenuRadioItem>
          </MenuRadioGroup>
          {files || testFiles ? <MenuSeparator /> : null}
          {files ? (
            <MenuItem onClick={files.onToggleCollapsed}>
              {files.collapsed ? "Expand all files" : "Collapse all files"}
            </MenuItem>
          ) : null}
          {testFiles ? (
            <MenuCheckboxItem checked={testFiles.hidden} onCheckedChange={testFiles.onHiddenChange}>
              Hide test files
            </MenuCheckboxItem>
          ) : null}
          {files ? (
            <MenuCheckboxItem checked={files.treeOpen} onCheckedChange={files.onTreeOpenChange}>
              Show file tree
            </MenuCheckboxItem>
          ) : null}
        </MenuPopup>
      </Menu>
    </div>
  );
}
