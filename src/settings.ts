import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { ChatGPT } from 'src/api';
import { JinaAI } from 'src/jina-api'; // Added JinaAI import
import type AutoClassifierPlugin from "src/main";
import { DEFAULT_CHAT_ROLE, DEFAULT_PROMPT_TEMPLATE, DEFAULT_PROMPT_TEMPLATE_WO_REF } from 'src/template'

export enum ClassifierEngine { // Added ClassifierEngine enum
    ChatGPT,
    JinaAI,
}

export enum ReferenceType {
    All,
    Filter,
    Manual,
}

export enum OutLocation {
    Cursor,
    // Title,
    // FrontMatter,
    ContentTop,
}

// export enum OutLocation_link {
//     Cursor,
//     // ContentTop,
// }

export enum OutType {
    FrontMatter,
    Title,
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
    outPrefix: string;
    outSuffix: string;
    overwrite: boolean; // for OutLocation - FrontMatter

    useCustomCommand: boolean;

    chat_role: string;
    prmpt_template: string;
    model: string;
    max_tokens: number;
    max_suggestions: number;
}


export class AutoClassifierSettings {
    apiKey: string;
    apiKeyCreatedAt: Date | null;
    baseURL: string;
    classifierEngine: ClassifierEngine; // Added classifierEngine
    jinaApiKey: string; // Added jinaApiKey
    jinaBaseURL: string; // Added jinaBaseURL
    commandOption: CommandOption;
}

export const DEFAULT_SETTINGS: AutoClassifierSettings = {
    apiKey: '',
    apiKeyCreatedAt: null,
    baseURL: 'https://api.openai.com/v1',
    classifierEngine: ClassifierEngine.ChatGPT, // Default to ChatGPT
    jinaApiKey: 'jina_e24cf807496a48d9be7ea660bd652a37x2ZJYPjVDlgMU69KQvKSepRDbTgM', // Default Jina API Key
    jinaBaseURL: 'https://api.jina.ai/v1', // Default Jina Base URL
    commandOption: {
        useRef: true,
        refs: [],
        manualRefs: [],
        refType: ReferenceType.All,
        filterRegex: '',
        outLocation: OutLocation.Cursor,
        // outLocation_link: OutLocation_link.Cursor,
        outType: OutType.Tag,
        outPrefix: '',
        outSuffix: '',
        key: 'tags',
        overwrite: false,
        useCustomCommand: false,

        chat_role: DEFAULT_CHAT_ROLE,
        prmpt_template: DEFAULT_PROMPT_TEMPLATE,
        model: "gpt-3.5-turbo",
        max_tokens: 150,
        max_suggestions: 3,
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
        containerEl.createEl('h1', { text: 'API Setting' });

        // Classifier Engine Dropdown
        new Setting(containerEl)
            .setName('Classifier Engine')
            .setDesc('Select the classification engine to use.')
            .addDropdown((dropdown) => {
                dropdown
                    .addOption(String(ClassifierEngine.ChatGPT), "ChatGPT")
                    .addOption(String(ClassifierEngine.JinaAI), "JinaAI")
                    .setValue(String(this.plugin.settings.classifierEngine))
                    .onChange(async (value) => {
                        this.plugin.settings.classifierEngine = parseInt(value) as ClassifierEngine;
                        await this.plugin.saveSettings();
                        this.display(); // Re-render settings to show/hide relevant fields
                    });
            });

        // Conditional API Settings
        if (this.plugin.settings.classifierEngine === ClassifierEngine.ChatGPT) {
            new Setting(containerEl)
                .setName('ChatGPT API Base URL')
                .setDesc('Optional: Set a different base URL for ChatGPT API calls (e.g. for proxies)')
                .addText((text) =>
                    text
                        .setPlaceholder('https://api.openai.com/v1')
                        .setValue(this.plugin.settings.baseURL)
                        .onChange((value) => {
                            this.plugin.settings.baseURL = value;
                            this.plugin.saveSettings();
                        })
                );

            new Setting(containerEl)
                .setName('ChatGPT Model')
                .setDesc("ID of the ChatGPT model to use. See https://platform.openai.com/docs/models")
                .addText((text) =>
                    text
                        .setPlaceholder('gpt-3.5-turbo')
                        .setValue(commandOption.model) // Assuming commandOption.model is for ChatGPT
                        .onChange(async (value) => {
                            commandOption.model = value;
                            await this.plugin.saveSettings();
                        })
                );

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
            apiKeySetting.descEl.createSpan({ text: 'Enter your ChatGPT API key. If you don\'t have one yet, you can create it at ' });
            apiKeySetting.descEl.createEl('a', { href: 'https://platform.openai.com/account/api-keys', text: 'here' })
            const apiTestMessageEl = document.createElement('div');
            apiKeySetting.descEl.appendChild(apiTestMessageEl);

            if (this.plugin.settings.apiKey && this.plugin.settings.apiKeyCreatedAt) {
                apiTestMessageEl.setText(`This key was tested at ${this.plugin.settings.apiKeyCreatedAt.toString()}`);
                apiTestMessageEl.style.color = 'var(--success-color)';
            }

            apiKeySetting.addButton((cb) => {
                cb.setButtonText('Test API call')
                    .setCta()
                    .onClick(async () => {
                        apiTestMessageEl.setText('Testing API call...');
                        apiTestMessageEl.style.color = 'var(--text-normal)';
                        try {
                            await ChatGPT.callAPI('', 'test', this.plugin.settings.apiKey, commandOption.model, undefined, undefined, undefined, undefined, undefined, this.plugin.settings.baseURL);
                            apiTestMessageEl.setText('Success! API working.');
                            apiTestMessageEl.style.color = 'var(--success-color)';
                            this.plugin.settings.apiKeyCreatedAt = new Date();
                        } catch (error) {
                            apiTestMessageEl.setText('Error: API is not working. Check console for details.');
                            apiTestMessageEl.style.color = 'var(--warning-color)';
                            this.plugin.settings.apiKeyCreatedAt = null;
                            console.error("ChatGPT API Test Error:", error);
                        }
                    });
            });
        } else if (this.plugin.settings.classifierEngine === ClassifierEngine.JinaAI) {
            new Setting(containerEl)
                .setName('Jina AI API Base URL')
                .setDesc('Optional: Set a different base URL for Jina AI API calls.')
                .addText((text) =>
                    text
                        .setPlaceholder('https://api.jina.ai/v1')
                        .setValue(this.plugin.settings.jinaBaseURL)
                        .onChange((value) => {
                            this.plugin.settings.jinaBaseURL = value;
                            this.plugin.saveSettings();
                        })
                );

            // Note: commandOption.model is currently shared. If Jina needs a separate model field,
            // it should be added to AutoClassifierSettings and handled here.
            // For now, we'll reuse commandOption.model but default it appropriately.
            new Setting(containerEl)
                .setName('Jina AI Model')
                .setDesc("ID of the Jina AI model to use (e.g., jina-embeddings-v3).")
                .addText((text) =>
                    text
                        .setPlaceholder('jina-embeddings-v3')
                        .setValue(commandOption.model) // Reuse existing model field, ensure it's set to a Jina default if empty or on switch
                        .onChange(async (value) => {
                            commandOption.model = value;
                            await this.plugin.saveSettings();
                        })
                );

            const jinaApiKeySetting = new Setting(containerEl)
                .setName('Jina AI API Key')
                .setDesc('')
                .addText((text) =>
                    text
                        .setPlaceholder('Jina API key')
                        .setValue(this.plugin.settings.jinaApiKey)
                        .onChange((value) => {
                            this.plugin.settings.jinaApiKey = value;
                            this.plugin.saveSettings();
                        })
                );
            jinaApiKeySetting.descEl.createSpan({ text: 'Enter your Jina AI API key.' });
            const jinaApiTestMessageEl = document.createElement('div');
            jinaApiKeySetting.descEl.appendChild(jinaApiTestMessageEl);

            // Jina API Key test button
            jinaApiKeySetting.addButton((cb) => {
                cb.setButtonText('Test Jina API')
                    .setCta()
                    .onClick(async () => {
                        jinaApiTestMessageEl.setText('Testing Jina API call...');
                        jinaApiTestMessageEl.style.color = 'var(--text-normal)';
                        try {
                            // Use a simple test case
                            await JinaAI.callAPI(
                                this.plugin.settings.jinaApiKey,
                                this.plugin.settings.jinaBaseURL,
                                commandOption.model || 'jina-embeddings-v3', // Fallback to default if model is not set
                                ['This is a test sentence.'],
                                ['positive', 'negative', 'neutral']
                            );
                            jinaApiTestMessageEl.setText('Success! Jina AI API working.');
                            jinaApiTestMessageEl.style.color = 'var(--success-color)';
                        } catch (error: any) {
                            jinaApiTestMessageEl.setText(`Error: Jina AI API is not working. ${error.message}`);
                            jinaApiTestMessageEl.style.color = 'var(--warning-color)';
                            console.error("Jina AI API Test Error:", error);
                        }
                    });
            });
        }

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
                        await this.plugin.saveSettings();
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
                    .addOption(String(OutType.FrontMatter), 'FrontMatter')
                    .addOption(String(OutType.Title), 'Title alternative')
                    .setValue(String(commandOption.outType))
                    .onChange(async (value) => {
                        commandOption.outType = parseInt(value);
                        commandOption.outLocation = 0; // Initialize
                        await this.plugin.saveSettings();
                        this.display();
                    });
            });
        
        // Output Type 1. [Tag Case]
        if (commandOption.outType == OutType.Tag) {
            // Tag - Location dropdown
            new Setting(containerEl)
                .setName('Output Location')
                .setClass('setting-item-child')
                .setDesc('Specify where to put the output tag')
                .addDropdown((cb) => {
                    cb.addOption(String(OutLocation.Cursor), 'Current Cursor')
                        .addOption(String(OutLocation.ContentTop), 'Top of Content')
                        .setValue(String(commandOption.outLocation))
                        .onChange(async (value) => {
                            commandOption.outLocation = parseInt(value);
                            await this.plugin.saveSettings();
                            this.display();
                        });
                });
        }
        // Output Type 2. [Wikilink Case]
        else if (commandOption.outType == OutType.Wikilink) {
            // Wikilink - Location dropdown
            new Setting(containerEl)
                .setName('Output Location')
                .setClass('setting-item-child')
                .setDesc('Specify where to put the output wikilink')
                .addDropdown((cb) => {
                    cb.addOption(String(OutLocation.Cursor), 'Current Cursor')
                        .addOption(String(OutLocation.ContentTop), 'Top of Content')
                        .setValue(String(commandOption.outLocation))
                        .onChange(async (value) => {
                            commandOption.outLocation = parseInt(value);
                            await this.plugin.saveSettings();
                            this.display();
                        });
                });
        }
        // Output Type 3. [Frontmatter Case]
        else if (commandOption.outType == OutType.FrontMatter) {
            // key text setting
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

        // Overwrite setting
        if ((commandOption.outType == OutType.Tag && commandOption.outLocation == OutLocation.Cursor) ||
            (commandOption.outType == OutType.Wikilink && commandOption.outLocation == OutLocation.Cursor) ||
            commandOption.outType == OutType.Title || 
            commandOption.outType == OutType.FrontMatter) {

            let overwriteName = '';
            if (commandOption.outLocation == OutLocation.Cursor) overwriteName = 'Overwrite if selected.';
            if (commandOption.outType == OutType.Title) overwriteName = 'Overwrite whole title. If false, add to end of title.';
            if (commandOption.outType == OutType.FrontMatter) overwriteName = 'Overwrite value of the key.';
            
            new Setting(containerEl)
                .setName(overwriteName)
                .setClass('setting-item-child')
                .addToggle((toggle) =>
                    toggle
                        .setValue(commandOption.overwrite)
                        .onChange(async (value) => {
                            commandOption.overwrite = value;
                            await this.plugin.saveSettings();
                            this.display();
                        })
                );

        }

        // Output Prefix & Suffix
        new Setting(containerEl)
            .setName('Add Prefix & Suffix')
            .setDesc(`Output: {prefix} + {output} + {suffix}`); 
        new Setting(containerEl)
            .setName('Prefix')
            .setClass('setting-item-child')
            .addText((text) =>
                text
                    .setPlaceholder('prefix')
                    .setValue(commandOption.outPrefix)
                    .onChange(async (value) => {
                        commandOption.outPrefix = value;
                        await this.plugin.saveSettings();
                    })
            );
        new Setting(containerEl)
            .setName('Suffix')
            .setClass('setting-item-child')
            .addText((text) =>
                text
                    .setPlaceholder('suffix')
                    .setValue(commandOption.outSuffix)
                    .onChange(async (value) => {
                        commandOption.outSuffix = value;
                        await this.plugin.saveSettings();
                    })
            );


        // ------- [Advanced Setting] -------
        containerEl.createEl('h1', { text: 'Advanced Setting' });

        new Setting(containerEl)
            .setName('Maximum Tag Suggestions')
            .setDesc("Maximum number of tags to suggest (1-10)")
            .addText((text) =>
                text
                    .setPlaceholder('3')
                    .setValue(String(commandOption.max_suggestions))
                    .onChange(async (value) => {
                        const num = parseInt(value);
                        if (num >= 1 && num <= 10) {
                            commandOption.max_suggestions = num;
                            await this.plugin.saveSettings();
                        }
                    })
            );

        // Conditional Advanced Settings for ChatGPT
        if (this.plugin.settings.classifierEngine === ClassifierEngine.ChatGPT) {
            // Toggle custom rule
            new Setting(containerEl)
                .setName('Use Custom Request Template (ChatGPT)')
                .addToggle((toggle) =>
                    toggle
                        .setValue(commandOption.useCustomCommand)
                        .onChange(async (value) => {
                            commandOption.useCustomCommand = value;
                            await this.plugin.saveSettings();
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
                    .setName('Custom Prompt Template (ChatGPT)')
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
                    .setName('Custom Chat Role (ChatGPT)')
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


                new Setting(containerEl)
                    .setName('Custom Max Tokens (ChatGPT)')
                    .setDesc("The maximum number of tokens that can be generated in the completion.")
                    .setClass('setting-item-child')
                    .addText((text) =>
                        text
                            .setPlaceholder('150')
                            .setValue(String(commandOption.max_tokens))
                            .onChange(async (value) => {
                                commandOption.max_tokens = parseInt(value);
                                await this.plugin.saveSettings();
                            })
                    );
            }
        }
        // For JinaAI, these custom prompt/role/token settings are hidden as they are not applicable.
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
