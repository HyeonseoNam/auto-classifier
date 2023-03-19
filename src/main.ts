import { Plugin, Notice  } from "obsidian";
import { AutoTaggerSettingTab, AutoTaggerSettings, DEFAULT_SETTINGS, OutLocation } from "src/settings";
import { ViewManager } from "src/view-manager";
import { ChatGPT } from 'src/api';

enum InputType {
  SelectedArea,
  Title,
  FrontMatter,
  Content
}

export default class AutoTaggerPlugin extends Plugin {
    settings: AutoTaggerSettings;
    viewManager = new ViewManager(this.app);
    
    async onload() {
      await this.loadSettings();
      
      // Commands
      this.addCommand({
        id: 'classify-tag-selected',
        name: 'Classify tag from Selected Area', 
        callback: async () => {
          await this.classifyTag(InputType.SelectedArea);
        }
      });
      this.addCommand({
        id: 'classify-tag-title',
        name: 'Classify tag from Note Title', 
        callback: async () => {
          await this.classifyTag(InputType.Title);
        }
      });
      this.addCommand({
        id: 'classify-tag-frontmatter',
        name: 'Classify tag from FrontMatter', 
        callback: async () => {
          await this.classifyTag(InputType.FrontMatter);
        }
      });
      this.addCommand({
        id: 'classify-tag-content',
        name: 'Classify tag from Note Content', 
        callback: async () => {
          await this.classifyTag(InputType.Content);
        }
      });

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
    
    // Main Classification
    async classifyTag(inputType: InputType) {
      new Notice(`${this.manifest.name}: Processing..`);
      const commandOption = this.settings.commandOption;
      // ------- [Input] -------
      const refs = this.settings.commandOption.refs;
      // reference check
      if (!refs || refs.length == 0) {
        new Notice(`[Error] ${this.manifest.name}: no reference tags`);
        return null
      }

      // Set Input 
      let input: string | null = ''; 
      if (inputType == InputType.SelectedArea) {
        input = await this.viewManager.getSelection();
      }
      else if (inputType == InputType.Title) { 
        input = await this.viewManager.getTitle();
      } 
      else if (inputType == InputType.FrontMatter) {
        input = await this.viewManager.getFrontMatter();
      } 
      else if (inputType == InputType.Content) {
        input = await this.viewManager.getContent();
      }
      
      // input error
      if (!input) {
        new Notice(`[Error] ${this.manifest.name}: no input data`);
        return null; 
      }
      
      // Replace {{input}}, {{reference}}
      let user_prompt = this.settings.commandOption.prmpt_template;
      user_prompt = user_prompt.replace('{{input}}', input);
      user_prompt = user_prompt.replace('{{reference}}', refs.join(','));

      const system_role = this.settings.commandOption.prmpt_template;

      // ------- [API Processing] -------
      // Call API
      const responseRaw = await ChatGPT.callAPI(system_role, user_prompt, this.settings.apiKey);

      // String type to JSON type
      const regexToJson = /\{([^}]+)\}/g;
      const match = responseRaw.match(regexToJson);
      let resOutput;
      let resReliabity;
      if (match) {
        const resJson = JSON.parse(match[0]);
        // Property check
        if (!resJson.hasOwnProperty('output') || !resJson.hasOwnProperty('reliability')) {
          new Notice(`[Error] ${this.manifest.name}: output format error (No 'output' and 'reliability' key)`);
          return null;
        }
        resOutput = resJson.output;
        resReliabity = resJson.reliability;
      } else 
      if (!match) {
        // Property check
        const resOutputRegex = /utput:\s*([^\n\r]+)/;
        const resReliabityRegex = /eliability:\s*([^\n\r]+)/;
        try {
          resOutput = String(responseRaw.match(resOutputRegex)?.[1]);
          resReliabity = parseFloat(String(responseRaw.match(resReliabityRegex)?.[1]));
        } catch (err) {
          new Notice(`[Error] ${this.manifest.name}: output format error`);
          return null;
        }
      }
      
      // Avoid row reliability
      if (resReliabity <= 0.2) {
        new Notice(`[Error] ${this.manifest.name}: response has row reliability (${resReliabity})`);
        return null;
      }

      // ------- [Add Tag] -------
      // FrontMatter
      if (commandOption.outLocation == OutLocation.FrontMatter) {
        this.viewManager.insertAtFrontMatter(commandOption.key, resOutput, commandOption.overwrite);
        new Notice(`[Success] ${this.manifest.name}: classified to ${resOutput} at FrontMatter[${commandOption.key}]`);
      } 
      // Title
      else if (commandOption.outLocation == OutLocation.Title) {
        this.viewManager.insertAtTitle(resOutput, commandOption.overwrite);
        new Notice(`[Success] ${this.manifest.name}: classified to ${resOutput} at Title`);
      }
      // Cursor
      else if (commandOption.outLocation == OutLocation.Cursor) {
        this.viewManager.insertAtCursor(resOutput, commandOption.overwrite);
        new Notice(`[Success] ${this.manifest.name}: classified to ${resOutput} at Current Cursor`);
      }
      
    }
  }
  