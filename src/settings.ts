import { App, Notice, PluginSettingTab, Setting} from "obsidian";
import { ChatGPT } from 'src/api';
import type AutoTaggerPlugin from "src/main";
import { defaultTemplate } from 'src/template'

export enum ReferenceType {
    All,
    Filter,
    Manual,
}

export enum OutLocation {
    FrontMatter,
    Title,
    Cursor,
}

// for tag, keyword
export interface TagOption {
    useRef: boolean;
    refs: string[];
    manualRefs: string[];
    refType: ReferenceType;
    filterRegex: string; // for ReferenceType - Filter
    outLocation: OutLocation;
    key: string; // for OutLocation - FrontMatter
    overwrite: boolean; // for OutLocation - FrontMatter

    useCustomCommand: boolean;
    commandTemplate: string;
}





export class AutoTaggerSettings {
    apiKey: string;
    apiKeyCreatedAt: Date | null;
    tagOption: TagOption;
}

export const DEFAULT_SETTINGS: AutoTaggerSettings = {
    apiKey: '',
    apiKeyCreatedAt: null, 
    tagOption: {
        useRef: true,
        refs: [],
        refType: ReferenceType.All,
        filterRegex: '',
        outLocation: OutLocation.FrontMatter,
        key: 'tag',
        overwrite: false,
        useCustomCommand: false,
        commandTemplate: defaultTemplate
    }, 
};

export class AutoTaggerSettingTab extends PluginSettingTab {
  plugin: AutoTaggerPlugin;
  constructor(app: App, plugin: AutoTaggerPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

    async display(): Promise<void> {

        const { containerEl } = this;
        const tagOption = this.plugin.settings.tagOption;
        
        // ------- [API Setting] -------
        // API Key input
        containerEl.empty();
        containerEl.createEl('h1', { text: 'API Setting' });
        const apiKeySetting = new Setting(containerEl)
        .setName('ChatGPT API Key')
        .setDesc('')       
        .addText((text) =>
            text
            .setPlaceholder('API key')
            .setValue(this.plugin.settings.apiKey)
            .onChange((value) => {
                this.plugin.settings.apiKey = value;
                this.plugin.saveSettings();
            })
        )
        // API Key Description & Message
        apiKeySetting.descEl.innerHTML += 'Enter your ChatGPT API key. If you don\'t have one yet, you can create it at <a href="https://platform.openai.com/account/api-keys">here</a>';
        const apiTestMessageEl = document.createElement('div');
        apiKeySetting.descEl.appendChild(apiTestMessageEl);
        
        //API Key default message
        if (this.plugin.settings.apiKey && this.plugin.settings.apiKeyCreatedAt) {
          apiTestMessageEl.setText(`This key was tested at ${this.plugin.settings.apiKeyCreatedAt.toString()}`);
          apiTestMessageEl.style.color = 'var(--success-color)';
        }

        // API Key test button
        apiKeySetting.addButton((cb) => {
            cb.setButtonText('Test API call')
            .setCta()
            .onClick(async () => {
              this.plugin.settings.apiKeyCreatedAt
                apiTestMessageEl.setText('Testing api call...');
                apiTestMessageEl.style.color = 'var(--text-normal)';
                this.plugin.settings.apiKeyCreatedAt = new Date();
                try {
                await ChatGPT.callAPI('How are you?', this.plugin.settings.apiKey);
                  apiTestMessageEl.setText('Success! API working.');
                  apiTestMessageEl.style.color = 'var(--success-color)';
                } catch (error) {
                  apiTestMessageEl.setText('Error: API is not working.');
                  apiTestMessageEl.style.color = 'var(--warning-color)';
                }
            });
        });

        // TODO: reference 사용 안하면 template에서 제거
        // ------- [Tag Reference Setting] -------
        // Tag Reference Toggle
        containerEl.createEl('h1', { text: 'Tag Reference Setting' });
        new Setting(containerEl)
        .setName('Use Tag Reference')
        .setDesc('When this toggle is on, the command for ChatGPT contains reference tags for classification. If turned off, ChatGPT may suggest new tags instead.')
        .addToggle((toggle) =>
          toggle
            .setValue(tagOption.useRef)
            .onChange(async (value) => {
              tagOption.useRef = value;
              this.display();
            }),
        );

        // Tag Reference Type Dropdown
        if (tagOption.useRef){
          new Setting(containerEl)
          .setName('Tag References')
          .setDesc('Choose the type of reference tag')
          .setClass('setting-item-child')
          .addDropdown((dropdown) => {
              dropdown
                  .addOption(ReferenceType.All, "All tags")
                  .addOption(ReferenceType.Filter, "Filtered tags",)
                  .addOption(ReferenceType.Manual, "Manual tags")
                  .setValue(tagOption.refType)
                  .onChange(async (refTye) => {
                      this.setRefType(refTye);
                      this.setRefs(refTye);
                      this.display();
                  });
          });
          
        // Filtered tags - Regex setting
        if (tagOption.refType == ReferenceType.Filter) {
          new Setting(containerEl)
            .setName('Filter regex')
            .setDesc('Specify a regular expression to filter tags')
            .setClass('setting-item-child')
            .addText((text) =>
              text
                .setPlaceholder('Regular expression')
                .setValue(tagOption.filterRegex)
                .onChange(async (value) => {
                  this.setRefs(ReferenceType.Filter, value);
                  
                })
            );
        }
        // Manual tags - manual input text area
        else if (tagOption.refType == ReferenceType.Manual) {
          new Setting(containerEl)
            .setName('Manual tags')
            .setDesc('Manually specify tags to reference.')
            .setClass('setting-item-child')
            .setClass('height10-text-area')
            .addTextArea((text) => {
              text
                .setPlaceholder('Tags')
                .setValue(tagOption.manualRefs?.join('\n'))
                .onChange(async (value) => {
                  this.setRefs(ReferenceType.Manual, value);
                })
            })
            .addExtraButton(cb => {
              cb
                .setIcon('reset')
                .setTooltip('Bring All Tags')
                .onClick(async () => {
                  const allTags = await this.plugin.viewManager.getTags() ?? [];
                  tagOption.manualRefs = allTags;
                  this.setRefs(ReferenceType.Manual);
                  this.display();
              })
            });
        }
        
        // View Reference Tags button
        new Setting(containerEl)
        .setClass('setting-item-child')
        .addButton((cb) => {
            cb.setButtonText('View Reference Tags')
            .onClick(async () => {
              const tags = tagOption.refs ?? [];
              new Notice(`${tags.join('\n')}`);
            });
        });
       
        }
    
    // ------- [Output Tag Setting] -------
    // Tag Location dropdown
    containerEl.createEl('h1', { text: 'Output Tag Setting' });
    new Setting(containerEl)
      .setName('Output Tag Location')
      .setDesc('Specify where to put the output tag')
      .addDropdown((cb) => {
        cb.addOption(OutLocation.FrontMatter, 'FrontMatter')
          .addOption(OutLocation.Title, 'Title alternative')
          .addOption(OutLocation.Cursor, 'Current cursor')
          .setValue(tagOption.outLocation)
          .onChange(async (value) => {
            tagOption.outLocation = value;
            await this.plugin.saveSettings();
            this.display();
          });
      });
    
    // Frontmatter - key text setting
    if (tagOption.outLocation == OutLocation.FrontMatter) {
      new Setting(containerEl)
        .setName('FrontMatter key')
        .setDesc('Specify FrontMatter key to put the output tag')
        .setClass('setting-item-child')
        .addText((text) =>
        text
          .setPlaceholder('Key')
          .setValue(tagOption.Key)
          .onChange(async (value) => {
            tagOption.Key = value;
            await this.plugin.saveSettings();
          })
      );
    }
    
    // Overwrite toggle
    new Setting(containerEl)
      .setName('Overwrite')
      .setDesc('Overwrite existing content')
      .setClass('setting-item-child')
      .addToggle((toggle) =>
        toggle
          .setValue(tagOption.overwrite)
          .onChange(async (value) => {
            tagOption.overwrite = value;
            await this.plugin.saveSettings();
          })
      );
 
    // ------- [Advanced Setting] -------
    // Toggle custom rule
    new Setting(containerEl)
    .setName('Use Custom Rule')
    .addToggle((toggle) =>
      toggle
        .setValue(tagOption.useCustomCommand)
        .onChange(async (value) => {
          tagOption.useCustomCommand = value;
          this.display();
        }),
    );
    
    // Custom template textarea
    if (tagOption.useCustomCommand) {
      new Setting(containerEl)
        .setName('Custom Command Template')
        .setDesc('Specify custom rules to reference tags.')
        .setClass('setting-item-child')
        .setClass('height20-text-area')
        .addTextArea((text) =>
          text
            .setPlaceholder('Custom template')
            .setValue(tagOption.commandTemplate)
            .onChange(async (value) => {
              tagOption.commandTemplate = value;
              await this.plugin.saveSettings();
            })
        )
        .addExtraButton(cb => {
          cb
            .setIcon('reset')
            .setTooltip('Restore to default')
            .onClick(async () => {
              tagOption.commandTemplate = defaultTemplate;
              await this.plugin.saveSettings();
              this.display();
          })
        });
        
        
    }

}

setRefType(refType: ReferenceType) {
  this.plugin.settings.tagOption.refType = refType;
}

async setRefs(refType: ReferenceType, value?: string) {
  const tagOption = this.plugin.settings.tagOption;
  if (refType == ReferenceType.All) {
    const tags = await this.plugin.viewManager.getTags() ?? [];
    tagOption.refs = tags
  }
  else if (refType == ReferenceType.Filter) {
    if (value) {
      tagOption.filterRegex = value;
    }
    const tags = await this.plugin.viewManager.getTags(tagOption.filterRegex) ?? [];
    tagOption.refs = tags
  }
  else if (refType == ReferenceType.Manual) {
    if (value) {
      tagOption.manualRefs = value?.split(/,|\n/).map((tag) => tag.trim());
    }
    tagOption.refs = tagOption.manualRefs;
  }
  await this.plugin.saveSettings();
}
}