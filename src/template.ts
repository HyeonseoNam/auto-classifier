export const system_role = `You are a JSON answer bot. Don't answer other words.`;
export const user_prompt = `Classify this content:
"""
{{input}}
"""
Answer format is JSON {reliability:0~1, output:selected_category}. 
Even if you are not sure, qualify the reliability and select one. 
Output must be one of these:

{{reference}}
`;