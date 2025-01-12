// will download and fetch fonts that are loaded, usable for drawing!
const URL_REGEX = /url\(['"]?([^'"]+?)['"]?\)/g



export class FontRepo {
    constructor() {
        this.fonts = {}
        console.log("start")
        this.refresh();
    }

    async refresh() {
        const stylesheets = Array.from(document.styleSheets)

        const fontData = []
        // fetch all the fonts
        for (const sheet of stylesheets) {
            try {
                const rules = sheet.cssRules
                for (const rule of rules) {
                    if (rule.constructor.name == 'CSSFontFaceRule' && rule.style.getPropertyValue('src').includes('url')) {
                        const font = rule.style.getPropertyValue('font-family').toLowerCase()
                        const src = rule.style.getPropertyValue('src')
                        const url = src.match(URL_REGEX)[0].replace(URL_REGEX, '$1')
                        // TODO: dom-to-image has a edge case where the stylesheet has a different url or somehting? check there if this blows up
                        fontData.push({ font, url })
                    }
                }
            } catch (e) {
                console.error(e)
                // not all the css rules can be read and this is fine!
                // (it's not that important, as long as we get the fonts we don't care)
            }
        }


        const Uint8FontData = await Promise.all(fontData.map(async ({ font, url }) => {
            // if it is a data url, just convert to a Uint8Array
            if (url.startsWith('data:')) {
                const base64 = url.split(',')[1]
                const binary = atob(base64)
                const bytes = new Uint8Array(binary.length)
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i)
                }
                return { font, data: bytes }
            }

            // if it is a url, fetch it
            const response = await fetch(url)
            const blob = await response.blob()
            const buffer = await blob.arrayBuffer()
            return { font, data: new Uint8Array(buffer) }
        }))
        console.log(Uint8FontData)
    }
}

