export class ChatGPT {
    private static baseUrl = 'https://api.openai.com/v1/engines';

    static async callAPI(
        prompt: string, 
        apiKey: string, 
        model = 'gpt-3.5-turbo',
        maxTokens = 100,
        temperature = 0.7): Promise<string> {
        
    
        const headers = new Headers({
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        });
    
        const body = JSON.stringify({
            prompt: prompt,
            max_tokens: maxTokens,
            n: 1,
            stop: null,
            temperature: temperature,
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