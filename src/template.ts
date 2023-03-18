
export const defaultTemplate = `Suggest the most appropriate tag based on #Input.

#Input:
{{input}}

#Rules:
- No other words. If you don't know, just answer "-1"

#Reference:
{{reference}}
`

export const ddcRules = `
- Predict the DDC number of book that corresponds to #Input.
- Answer should be {ddc number}.{ddc number}:{Category} form. 
- examples: '000.0:category_title', '000.0:this_is_category'
`