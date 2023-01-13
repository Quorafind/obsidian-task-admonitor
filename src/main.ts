import { EventRef, ItemView, MarkdownView, Plugin, TFile } from "obsidian";
import dayjs from "dayjs";
import { AppHelper } from "./app-helper";
import { DEFAULT_SETTINGS, OldNoteAdmonitorTab, Settings } from "./settings";
import { ExhaustiveError } from "./errors";

const ADMONITOR_CLS = "old-note-admonitor__old-note-container";
const ADMONITOR_WARNING_CLS = "old-note-admonitor__old-note-container__warning";
const ADMONITOR_ERR_CLS = "old-note-admonitor__old-note-container__error";

type AdmonitorType = "warning" | "error";

// noinspection JSUnusedGlobalSymbols
export default class OldNoteAdmonitorPlugin extends Plugin {
  appHelper: AppHelper;
  settings: Settings;
  fileOpenHandler: EventRef;
  fileSaveHandler: EventRef;

  async onload() {
    this.appHelper = new AppHelper(this.app);
    await this.loadSettings();
    this.addSettingTab(new OldNoteAdmonitorTab(this.app, this));

    await this.exec(this.appHelper.getActiveFile());
    this.addListeners();
  }

  onunload() {
    this.removeListeners();
  }

  addListeners() {
    this.fileOpenHandler = this.app.workspace.on("active-leaf-change", (leaf) => {
      this.exec((leaf?.view as ItemView) || null);
    });
    if (this.settings.triggerToUpdate === "On open or save file") {
      this.fileSaveHandler = this.app.vault.on("modify", (file) => {
        // @ts-ignore
        this.exec(file as TFile);
      });
    }
  }

  removeListeners() {
    this.app.workspace.offref(this.fileOpenHandler);
    this.app.vault.offref(this.fileSaveHandler);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
    this.removeListeners();
    this.addListeners();
    await this.exec(this.appHelper.getActiveFile());
  }

  async exec(view: ItemView | null) {
    const markdownView = this.appHelper.getMarkdownViewInActiveLeaf();
    if (!markdownView || !view) {
      return;
    }

    this.removeAdmonitor(markdownView);

    const lastUpdated = await dayjs();
    if (!lastUpdated) {
      if (this.settings.showWarningIfDataIsNotFound) {
        this.insertAdmonitor(markdownView, "The date was not found", "error");
      }
      return;
    }

    const numberOfDays = dayjs().diff(lastUpdated, "day");
    if (numberOfDays >= this.settings.minNumberOfDaysToShowWarning) {
      const text = this.settings.messageTemplate
        .replace("${numberOfDays}", String(numberOfDays))
        .replace("${date}", lastUpdated.format("YYYY-MM-DD"));
      this.insertAdmonitor(markdownView, text, "warning");
    }
  }

  removeAdmonitor(markdownView: ItemView) {
    markdownView.containerEl.find(`.${ADMONITOR_CLS}`)?.remove();
  }

  insertAdmonitor(
    markdownView: ItemView,
    text: string,
    type: AdmonitorType
  ) {
    const cls = [ADMONITOR_CLS];
    switch (type) {
      case "warning":
        cls.push(ADMONITOR_WARNING_CLS);
        break;
      case "error":
        cls.push(ADMONITOR_ERR_CLS);
        break;
      default:
        throw new ExhaustiveError(type);
    }

    const el = createDiv({
      text,
      cls,
    });

    el.onclick = () => {
      //@ts-expect-error, private method
      app.setting.open();
      //@ts-expect-error, private method
      app.setting.openTabById('obsidian-task-admonitor');
    }
    markdownView.containerEl
      .find(".view-header")
      .insertAdjacentElement("beforebegin", el);
  }

  async findDate(file: TFile): Promise<dayjs.Dayjs | undefined> {
    switch (this.settings.dateToBeReferred) {
      case "Modified time":
        return dayjs(file.stat.mtime);
      case "Front matter":
        const fm = this.appHelper.getNoCacheFrontMatter(
          await app.vault.cachedRead(file)
        );
        const df = fm?.[this.settings.frontMatterKey];
        return df ? dayjs(df) : undefined;
      case "Capture group":
        const content = await app.vault.cachedRead(file);
        const pattern = new RegExp(this.settings.captureGroupPattern, "g");
        const dc = content
          .split("\n")
          .map(
            (line) => Array.from(line.matchAll(pattern)).first()?.groups?.date
          )
          .filter((x) => x)
          .first();
        return dc ? dayjs(dc) : undefined;
      default:
        throw new ExhaustiveError(this.settings.dateToBeReferred);
    }
  }
}
