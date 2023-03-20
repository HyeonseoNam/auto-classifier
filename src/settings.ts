import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { ChatGPT } from 'src/api';
import type AutoTaggerPlugin from "src/main";
import { DEFAULT_CHAT_ROLE, DEFAULT_PROMPT_TEMPLATE } from 'src/template'

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
export interface CommandOption {
    useRef: boolean;
    refs: string[];
    manualRefs: string[];
    refType: ReferenceType;
    filterRegex: string; // for ReferenceType - Filter
    outLocation: OutLocation;
    key: string; // for OutLocation - FrontMatter
    overwrite: boolean; // for OutLocation - FrontMatter

    useCustomCommand: boolean;

    chat_role: string;
    prmpt_template: string;
}


export class AutoTaggerSettings {
    apiKey: string;
    apiKeyCreatedAt: Date | null;
    commandOption: CommandOption;
}

export const DEFAULT_SETTINGS: AutoTaggerSettings = {
    apiKey: '',
    apiKeyCreatedAt: null,
    commandOption: {
        useRef: true,
        refs: [],
        manualRefs: [],
        refType: ReferenceType.All,
        filterRegex: '',
        outLocation: OutLocation.FrontMatter,
        key: 'tags',
        overwrite: false,
        useCustomCommand: false,

        chat_role: DEFAULT_CHAT_ROLE,
        prmpt_template: DEFAULT_PROMPT_TEMPLATE
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
        const commandOption = this.plugin.settings.commandOption;

        containerEl.empty();
        // shortcut button
        const shortcutEl = new Setting(this.containerEl)
            .setDesc('')
            .addButton((cb) => {
                cb.setButtonText("Specify shortcuts")
                    .setCta()
                    .onClick(() => {
                        // @ts-ignore
                        app.setting.openTabById("hotkeys");
                        // @ts-ignore
                        const tab = app.setting.activeTab;
                        tab.searchInputEl.value = `${this.plugin.manifest.name}:`;
                        tab.updateHotkeyVisibility();
                    });
            });
        shortcutEl.descEl.innerHTML += `
This plugin does not have default shortcuts to prevent conflicts. <br>
Assig shortcuts to commands for different input types.`


        // ------- [API Setting] -------
        // API Key input
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
                    try {
                        await ChatGPT.callAPI('', 'test', this.plugin.settings.apiKey);
                        apiTestMessageEl.setText('Success! API working.');
                        apiTestMessageEl.style.color = 'var(--success-color)';
                        this.plugin.settings.apiKeyCreatedAt = new Date();
                    } catch (error) {
                        apiTestMessageEl.setText('Error: API is not working.');
                        apiTestMessageEl.style.color = 'var(--warning-color)';
                        this.plugin.settings.apiKeyCreatedAt = null;
                    }
                });
        });

        // ------- [Tag Reference Setting] -------
        containerEl.createEl('h1', { text: 'Tag Reference Setting' });

        // Tag Reference Type Dropdown
        new Setting(containerEl)
            .setName('Reference type')
            .setDesc('Choose the type of reference tag')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption(ReferenceType.All, "All tags")
                    .addOption(ReferenceType.Filter, "Filtered tags",)
                    .addOption(ReferenceType.Manual, "Manual tags")
                    .setValue(commandOption.refType)
                    .onChange(async (refTye) => {
                        this.setRefType(refTye);
                        this.setRefs(refTye);
                        this.display();
                    });
            });

        // Filtered tags - Regex setting
        if (commandOption.refType == ReferenceType.Filter) {
            new Setting(containerEl)
                .setName('Filter regex')
                .setDesc('Specify a regular expression to filter tags')
                .setClass('setting-item-child')
                .addText((text) =>
                    text
                        .setPlaceholder('Regular expression')
                        .setValue(commandOption.filterRegex)
                        .onChange(async (value) => {
                            this.setRefs(ReferenceType.Filter, value);

                        })
                );
        }
        // Manual tags - manual input text area
        else if (commandOption.refType == ReferenceType.Manual) {
            new Setting(containerEl)
                .setName('Manual tags')
                .setDesc('Manually specify tags to reference.')
                .setClass('setting-item-child')
                .setClass('height10-text-area')
                .addTextArea((text) => {
                    text
                        .setPlaceholder('Tags')
                        .setValue(commandOption.manualRefs?.join('\n'))
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
                            commandOption.manualRefs = allTags;
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
                        const tags = commandOption.refs ?? [];
                        new Notice(`${tags.join('\n')}`);
                    });
            });



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
                    .setValue(commandOption.outLocation)
                    .onChange(async (value) => {
                        commandOption.outLocation = value;
                        await this.plugin.saveSettings();
                        this.display();
                    });
            });

        // Frontmatter - key text setting
        let overwriteName = '';
        if (commandOption.outLocation == OutLocation.FrontMatter) {
            overwriteName = 'Overwrite value of the key';
            new Setting(containerEl)
                .setName('FrontMatter key')
                .setDesc('Specify FrontMatter key to put the output tag')
                .setClass('setting-item-child')
                .addText((text) =>
                    text
                        .setPlaceholder('Key')
                        .setValue(commandOption.key)
                        .onChange(async (value) => {
                            commandOption.key = value;
                            await this.plugin.saveSettings();
                        })
                );
        }
        else if (commandOption.outLocation == OutLocation.Title) {
            overwriteName = 'Overwrite whole title';
        }
        else if (commandOption.outLocation == OutLocation.Cursor) {
            overwriteName = 'Overwrite selected area';
        }

        // Overwrite toggle
        new Setting(containerEl)
            .setName(overwriteName)
            .setClass('setting-item-child')
            .addToggle((toggle) =>
                toggle
                    .setValue(commandOption.overwrite)
                    .onChange(async (value) => {
                        commandOption.overwrite = value;
                        await this.plugin.saveSettings();
                    })
            );

        // ------- [Advanced Setting] -------
        // Toggle custom rule
        containerEl.createEl('h1', { text: 'Advanced Setting' });
        new Setting(containerEl)
            .setName('Use Custom Request Template')
            .addToggle((toggle) =>
                toggle
                    .setValue(commandOption.useCustomCommand)
                    .onChange(async (value) => {
                        commandOption.useCustomCommand = value;
                        this.display();
                    }),
            );

        // Custom template textarea
        if (commandOption.useCustomCommand) {
            const customPromptTemplateEl = new Setting(containerEl)
                .setName('Custom Prompt Template')
                .setDesc('')
                .setClass('setting-item-child')
                .setClass('block-control-item')
                .setClass('height20-text-area')
                .addTextArea((text) =>
                    text
                        .setPlaceholder('Write custom prompt template.')
                        .setValue(commandOption.prmpt_template)
                        .onChange(async (value) => {
                            commandOption.prmpt_template = value;
                            await this.plugin.saveSettings();
                        })
                )
                .addExtraButton(cb => {
                    cb
                        .setIcon('reset')
                        .setTooltip('Restore to default')
                        .onClick(async () => {
                            commandOption.prmpt_template = DEFAULT_PROMPT_TEMPLATE;
                            await this.plugin.saveSettings();
                            this.display();
                        })
                });

            customPromptTemplateEl.descEl.innerHTML += `
This plugin is based on the ChatGPT answer.<br>
You can use your own template when making a request to ChatGPT.<br><br>
Variables:<br>
- {{input}}: The text to classify will be inserted here.<br>
- {{reference}}: The reference tags will be inserted here.<br>`;

            const customChatRoleEl = new Setting(containerEl)
                .setName('Custom Chat Role')
                .setDesc('')
                .setClass('setting-item-child')
                .setClass('block-control-item')
                .setClass('height10-text-area')
                .addTextArea((text) =>
                    text
                        .setPlaceholder('Write custom chat role for gpt system.')
                        .setValue(commandOption.chat_role)
                        .onChange(async (value) => {
                            commandOption.chat_role = value;
                            await this.plugin.saveSettings();
                        })
                )
                .addExtraButton(cb => {
                    cb
                        .setIcon('reset')
                        .setTooltip('Restore to default')
                        .onClick(async () => {
                            commandOption.chat_role = DEFAULT_CHAT_ROLE;
                            await this.plugin.saveSettings();
                            this.display();
                        })
                });

            customChatRoleEl.descEl.innerHTML += `
Define custom role to ChatGPT system.`
        }





    }



    setRefType(refType: ReferenceType) {
        this.plugin.settings.commandOption.refType = refType;
    }

    async setRefs(refType: ReferenceType, value?: string) {
        const commandOption = this.plugin.settings.commandOption;
        if (refType == ReferenceType.All) {
            const tags = await this.plugin.viewManager.getTags() ?? [];
            commandOption.refs = tags
        }
        else if (refType == ReferenceType.Filter) {
            if (value) {
                commandOption.filterRegex = value;
            }
            const tags = await this.plugin.viewManager.getTags(commandOption.filterRegex) ?? [];
            commandOption.refs = tags
        }
        else if (refType == ReferenceType.Manual) {
            if (value) {
                commandOption.manualRefs = value?.split(/,|\n/).map((tag) => tag.trim());
            }
            commandOption.refs = commandOption.manualRefs;
        }
        await this.plugin.saveSettings();
    }
}