import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { ChatGPT } from 'src/api';
import type AutoClassifierPlugin from "src/main";
import { DEFAULT_CHAT_ROLE, DEFAULT_PROMPT_TEMPLATE, DEFAULT_PROMPT_TEMPLATE_WO_REF } from 'src/template'

export enum ReferenceType {
    All,
    Filter,
    Manual,
}

export enum OutLocation {
    Cursor,
    Title,
    FrontMatter,
}

// export enum OutLocation_link {
//     Cursor,
//     // ContentTop,
// }

export enum OutType {
    Tag,
    Wikilink,
}

// for tag, keyword
export interface CommandOption {
    useRef: boolean;
    refs: string[];
    manualRefs: string[];
    refType: ReferenceType;
    filterRegex: string; // for ReferenceType - Filter
    outLocation: OutLocation;
    // outLocation_link: OutLocation_link;
    outType: OutType;
    key: string; // for OutLocation - FrontMatter
    overwrite: boolean; // for OutLocation - FrontMatter

    useCustomCommand: boolean;

    chat_role: string;
    prmpt_template: string;
}


export class AutoClassifierSettings {
    apiKey: string;
    apiKeyCreatedAt: Date | null;
    commandOption: CommandOption;
}

export const DEFAULT_SETTINGS: AutoClassifierSettings = {
    apiKey: '',
    apiKeyCreatedAt: null,
    commandOption: {
        useRef: true,
        refs: [],
        manualRefs: [],
        refType: ReferenceType.All,
        filterRegex: '',
        outLocation: OutLocation.Cursor,
        // outLocation_link: OutLocation_link.Cursor,
        outType: OutType.Tag,
        key: 'tags',
        overwrite: false,
        useCustomCommand: false,

        chat_role: DEFAULT_CHAT_ROLE,
        prmpt_template: DEFAULT_PROMPT_TEMPLATE
    },
};

export class AutoClassifierSettingTab extends PluginSettingTab {
    plugin: AutoClassifierPlugin;
    constructor(app: App, plugin: AutoClassifierPlugin) {
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
                        tab.setQuery(this.plugin.manifest.id);
                        tab.updateHotkeyVisibility();
                    });
            });
        shortcutEl.descEl.createSpan({text: 'This plugin does not have default shortcuts to prevent shortcut conflicts.'});
        shortcutEl.descEl.createEl('br');
        shortcutEl.descEl.createSpan({text: 'Assign your own shortcuts to run commands for different input types.'});


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
        apiKeySetting.descEl.createSpan({text: 'Enter your ChatGPT API key. If you don\'t have one yet, you can create it at '});
        apiKeySetting.descEl.createEl('a', {href: 'https://platform.openai.com/account/api-keys', text: 'here'})
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

        // Toggle tag reference
        new Setting(containerEl)
            .setName('Use Reference')
            .setDesc('If not, it will recommend new tags')
            .addToggle((toggle) =>
                toggle
                    .setValue(commandOption.useRef)
                    .onChange(async (value) => {
                        commandOption.useRef = value;
                        this.display();
                    }),
            );

        if (commandOption.useRef) {
            // Tag Reference Type Dropdown
            new Setting(containerEl)
                .setName('Reference type')
                .setDesc('Choose the type of reference tag')
                .setClass('setting-item-child')
                .addDropdown((dropdown) => {
                    dropdown
                        .addOption(String(ReferenceType.All), "All tags")
                        .addOption(String(ReferenceType.Filter), "Filtered tags",)
                        .addOption(String(ReferenceType.Manual), "Manual tags")
                        .setValue(String(commandOption.refType))
                        .onChange(async (refTye) => {
                            this.setRefType(parseInt(refTye));
                            this.setRefs(parseInt(refTye));
                            this.display();
                        });
                });

            // All tags - default setting
            if (commandOption.refType == ReferenceType.All) {
                this.setRefs(ReferenceType.All);
            }
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
        }
        



        // ------- [Output Setting] -------
        containerEl.createEl('h1', { text: 'Output Setting' });
        
        // Output type dropdown
        new Setting(containerEl)
            .setName('Output Type')
            .setDesc('Specify output type')
            .addDropdown((cb) => {
                cb.addOption(String(OutType.Tag), '#Tag')
                    .addOption(String(OutType.Wikilink), '[[Wikilink]]')
                    .setValue(String(commandOption.outType))
                    .onChange(async (value) => {
                        commandOption.outType = parseInt(value);
                        commandOption.outLocation = 0; // Initialize
                        await this.plugin.saveSettings();
                        this.display();
                    });
            });
        
        // Output Tag - 
        if (commandOption.outType == OutType.Tag) {
            // Tag - Location dropdown
            new Setting(containerEl)
                .setName('Output Location')
                .setDesc('Specify where to put the output tag')
                .addDropdown((cb) => {
                    cb.addOption(String(OutLocation.Cursor), 'Current Cursor')
                        .addOption(String(OutLocation.Title), 'Title alternative')    
                        .addOption(String(OutLocation.FrontMatter), 'FrontMatter')
                        .setValue(String(commandOption.outLocation))
                        .onChange(async (value) => {
                            commandOption.outLocation = parseInt(value);
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
                overwriteName = 'Overwrite selected area if selected';
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
        }
        else if (commandOption.outType == OutType.Wikilink) {
            // Wikilink - Location dropdown
            new Setting(containerEl)
                .setName('Output Location')
                .setDesc('Specify where to put the output wikilink')
                .addDropdown((cb) => {
                    cb.addOption(String(OutLocation.Cursor), 'Current Cursor')
                        // .addOption(String(OutLocation.ContentTop), 'Top of Content')
                        .setValue(String(commandOption.outLocation))
                        .onChange(async (value) => {
                            commandOption.outLocation = parseInt(value);
                            await this.plugin.saveSettings();
                            this.display();
                        });
                });
            
            // Set overwriteName
            let overwriteName = '';
            if (commandOption.outLocation == OutLocation.Cursor) {
                overwriteName = 'Overwrite selected area if selected';
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
            
        }
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
            
            // Different default template depanding on useRef
            if (commandOption.useRef) {
                if(commandOption.prmpt_template == DEFAULT_PROMPT_TEMPLATE_WO_REF) commandOption.prmpt_template = DEFAULT_PROMPT_TEMPLATE;
            } else {
                if(commandOption.prmpt_template == DEFAULT_PROMPT_TEMPLATE) commandOption.prmpt_template = DEFAULT_PROMPT_TEMPLATE_WO_REF;
            }

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
                            // Different default template depanding on useRef
                            if (commandOption.useRef) commandOption.prmpt_template = DEFAULT_PROMPT_TEMPLATE;
                            else commandOption.prmpt_template = DEFAULT_PROMPT_TEMPLATE_WO_REF;

                            await this.plugin.saveSettings();
                            this.display();
                        })
                });
            customPromptTemplateEl.descEl.createSpan({text: 'This plugin is based on the ChatGPT answer.'});
            customPromptTemplateEl.descEl.createEl('br');
            customPromptTemplateEl.descEl.createSpan({text: 'You can use your own template when making a request to ChatGPT.'});
            customPromptTemplateEl.descEl.createEl('br');
            customPromptTemplateEl.descEl.createEl('br');
            customPromptTemplateEl.descEl.createSpan({text: 'Variables:'});
            customPromptTemplateEl.descEl.createEl('br');
            customPromptTemplateEl.descEl.createSpan({text: '- {{input}}: The text to classify will be inserted here.'});
            customPromptTemplateEl.descEl.createEl('br');
            customPromptTemplateEl.descEl.createSpan({text: '- {{reference}}: The reference tags will be inserted here.'});
            customPromptTemplateEl.descEl.createEl('br');

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
                customChatRoleEl.descEl.createSpan({text: 'Define custom role to ChatGPT system.'});
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