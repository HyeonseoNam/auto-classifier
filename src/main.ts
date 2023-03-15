import { Plugin, TFile } from "obsidian";
import { AutoTaggerSettingTab, DEFAULT_SETTINGS } from "src/settings";
// import { callGPT } from 'src/api';



export default class AutoTaggerPlugin extends Plugin {
    settings: AutoTaggerSettingTab;
    
    async onload() {
      await this.loadSettings();
      // here

      this.addSettingTab(new AutoTaggerSettingTab(this.app, this));
    }
    
    async loadSettings() {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    
    
    
    async saveSettings() {
      await this.saveData(this.settings);
    }
    
    async onunload() {
    }
  }
  