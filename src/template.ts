export const DEFAULT_CHAT_ROLE = `You are a JSON answer bot. Don't answer other words.`;
export const DEFAULT_PROMPT_TEMPLATE = `Classify this content:
"""
{{input}}
"""
Answer format is JSON {reliability:0~1, outputs:[tag1,tag2,...]}. 
Suggest up to {{max_suggestions}} most relevant tags.
Even if you are not sure, qualify the reliability and select the best matches.
Output tags must be from these options:

{{reference}}
`;

export const DEFAULT_PROMPT_TEMPLATE_WO_REF = `Classify this content:
"""
{{input}}
"""
Answer format is JSON {reliability:0~1, output:selected_category}. 
Even if you are not sure, qualify the reliability and recommend a proper category.

`;
