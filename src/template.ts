
export const defaultTemplate = `Classify it as the most appropriate one based on the rules.

#Input:
{{input}}

#Rules:
- No other words. If you don't know, just answer "-1"
- Choose one from the list here:
{{references}}
`

export const ddcRules = `
- Predict the DDC number of book that corresponds to #Input.
- Answer should be {ddc number}.{ddc number}:{Category} form. 
- examples: '000.0:category_title', '000.0:this_is_category'
`