export class ChatGPT {
    private static baseUrl = 'https://api.openai.com/v1/engines';

    static async callAPI(
        prompt: string, 
        apiKey: string, 
        model = 'text-davinci-003',
        maxTokens = 256,
        temperature = 0.7,
        top_p=1,
        frequency_penalty=0,
        presence_penalty=0): Promise<string> {
        
    
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        });
    
        const body = JSON.stringify({
            prompt: prompt,
            max_tokens: maxTokens,
            n: 1,
            // stop: '\n',
            stop: null,
            temperature: temperature,
            top_p: top_p, 
            frequency_penalty: frequency_penalty, 
            presence_penalty: presence_penalty
        });
    
        const response = await fetch(`${this.baseUrl}/${model}/completions`, {
            method: 'POST',
            headers: headers,
            body: body,
        });
    
        if (!response.ok) {
            throw new Error(`API call error: ${response.statusText}`);
        }
    
        const data = await response.json();
        return data.choices[0].text.trim();
    }
}