import { App, MarkdownView } from "obsidian";

export class ViewManager {
  app: App;

  constructor(app: App) {
    this.app = app;
  }

  getSelection(): string | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      const editor = activeView.editor;
      const selectedText = editor.getSelection();
      return selectedText;
    }
    return null;
  }

  getTitle(): string | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      return activeView.file.basename;
    }
    return null;
  }

  getFrontMatter(): Record<string, unknown> | null {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      const file = activeView.file;
      const cache = this.app.metadataCache.getFileCache(file);
      return cache?.frontmatter || null;
    }
    return null;
  }

  
}