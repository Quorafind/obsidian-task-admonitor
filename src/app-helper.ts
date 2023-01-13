import {
  App, ItemView,
  MarkdownView,
  TFile,
  Vault,
  Workspace,
  WorkspaceLeaf,
} from "obsidian";

interface UnsafeAppInterface {
  internalPlugins: {
    plugins: {
      starred: {
        instance: {
          items: { path: string }[];
        };
      };
    };
  };
  commands: {
    removeCommand(id: string): void;
    commands: { [commandId: string]: any };
  };
  plugins: {
    plugins: {
      "obsidian-hover-editor"?: {
        spawnPopover(
          initiatingEl?: HTMLElement,
          onShowCallback?: () => unknown
        ): WorkspaceLeaf;
      };
    };
  };
  vault: Vault & {
    config: {
      newFileLocation?: "root" | "current" | "folder";
      newFileFolderPath?: string;
    };
  };
  workspace: Workspace & {
    openPopoutLeaf(): WorkspaceLeaf;
  };
}

export class AppHelper {
  private unsafeApp: App & UnsafeAppInterface;

  constructor(app: App) {
    this.unsafeApp = app as any;
  }

  getActiveFile(): ItemView | null {
    return this.unsafeApp.workspace.getActiveViewOfType(ItemView);
  }

  getMarkdownViewInActiveLeaf(): ItemView | null {
    return this.unsafeApp.workspace.getActiveViewOfType(ItemView);
  }

  getNoCacheFrontMatter(content: string): { [key: string]: string } | null {
    const lines = content.split("\n");
    if (lines[0] !== "---") {
      return null;
    }

    let frontMatter: { [key: string]: string } = {};
    lines.slice(1).forEach((line) => {
      if (line === "---") {
        return frontMatter;
      }

      if (/.+: .+/.test(line)) {
        const [key, value] = line.trim().split(":");
        frontMatter[key] = value;
      }
    });

    return frontMatter;
  }
}
