import { v4 as uuidv4 } from 'uuid';
// getting fonts inspirered by dom-to-image
const URL_REGEX  = /url\(['"]?([^'"]+?)['"]?\)/g
async function getFonts(namespace = 'http://www.w3.org/1999/xhtml') {
    const stylesheets = Array.from(document.styleSheets)

    const fontRules = []
    for (const sheet of stylesheets) {
        try {
            const rules = sheet.cssRules
            for (const rule of rules) {
                if (rule.constructor.name == 'CSSFontFaceRule' && rule.style.getPropertyValue('src').includes('url')) {
                    const font = rule.style.getPropertyValue('font-family')
                    const src = rule.style.getPropertyValue('src')
                    const url = src.match(URL_REGEX)[0].replace(URL_REGEX, '$1')
                    // TODO: dom-to-image has a edge case where the stylesheet has a different url or somehting? check there if this blows up
                    fontRules.push({font, url})
                }
            }
        } catch (e) {
            // not all the css rules can be read and this is fine!
            // (it's not that important, as long as we get the fonts we don't care)
        }
    }
    const fontBase64Data = await Promise.all(
        fontRules.map(async ({font, url}) => {
            const type = url.split('.').pop()
            const response = await fetch(url)
            const blob = await response.blob()
            const base64 = await new Promise((resolve) => {
                const reader = new FileReader()
                reader.onload = () => resolve(reader.result)
                reader.readAsDataURL(blob)
            })

            return {font, base64, type}
        }))
    const styleTag = document.createElementNS(namespace, 'style')
    for (const {font, base64, type} of fontBase64Data) {
        // add to the style tag
        styleTag.textContent += `
            @font-face {
                font-family: '${font}';
                src: url('${base64}');
                format('${type}');
            }
        `
    }
    return styleTag

    
}

export async function nodeToSvg(node, config) {
    const {style, filter} = config

    const nodeBounds = node.getBoundingClientRect()

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg')

    svg.setAttribute('width', nodeBounds.width)
    svg.setAttribute('height', nodeBounds.height)

    const styleTag = document.createElement('style')
    styleTag.textContent = `
        transform: ${style.transform};
        transform-origin: ${style.transformOrigin};
        background: ${style.background};
        align-items: ${style.alignItems};
        justify-content: ${style.justifyContent};
    `

    svg.appendChild(styleTag)
    // svg namespace
    const fontStyleTag = await getFonts('http://www.w3.org/2000/svg').catch(console.error)
    svg.appendChild(fontStyleTag)

    const stack = [node]

    while (stack.length > 0) {
        const currentNode = stack.pop()
        // check if is a text node
        if (currentNode.nodeType === Node.TEXT_NODE) {
            const textNode = document.createElementNS('http://www.w3.org/2000/svg', 'text')
            // find parent node
            const parent = currentNode.parentNode
            const parentStyle = window.getComputedStyle(parent)
            // copy parent styles
            textNode.setAttribute('fill', parentStyle.color)
            textNode.setAttribute('font-size', parentStyle.fontSize)
            textNode.setAttribute('font-family', parentStyle.fontFamily)

            const range = document.createRange()
            range.selectNode(currentNode)
            const rect = range.getBoundingClientRect()
            const offsetX = rect.x - nodeBounds.x
            const offsetY = rect.y - nodeBounds.y
            textNode.setAttribute('x', offsetX)
            textNode.setAttribute('y', offsetY)
            
            textNode.textContent = currentNode.textContent.replace(' ', '\u00A0')
            svg.appendChild(textNode)
            continue
        }

        // if has no children and not ignored and is div, we convert it to a rect
        if (filter(currentNode) && currentNode.tagName === 'DIV') {
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect')
            const rectStyle = window.getComputedStyle(currentNode)

            const rectBounds = currentNode.getBoundingClientRect()
            const offsetX = rectBounds.x - nodeBounds.x
            const offsetY = rectBounds.y - nodeBounds.y

            rect.setAttribute('x', offsetX)
            rect.setAttribute('y', offsetY)
            rect.setAttribute('width', rectBounds.width)
            rect.setAttribute('height', rectBounds.height)
            rect.setAttribute('fill', rectStyle.backgroundColor)
            // convert this node style to style on the rect
            const nodeStyle = getComputedStyle(currentNode)
            const borderRadious = nodeStyle.getPropertyValue('border-radius')
            if (borderRadious != 'none') {
                rect.setAttribute('rx', borderRadious)
                rect.setAttribute('ry', borderRadious)
            }
            const boxShadow = nodeStyle.getPropertyValue('box-shadow')

            if (boxShadow != 'none') {
                // swap color and positions on box shadow to get it compatible for drop-shadow
                // color is in rgba format rba(r, g, b, a)
                const globalParts = boxShadow.split(') ')
                const colorRGBA = globalParts[0] + ')'
                const colorParts = colorRGBA.split('(')[1].split(',')
                colorParts[3] = colorParts[3].replace(')', '')
                const posParts = globalParts[1].split(" ")
                const x = posParts[0].replace('px', '')
                const y = posParts[1].replace('px', '')
                const blur = posParts[2].replace('px', '')

                // create a filter for the shadow
                const filter = document.createElementNS('http://www.w3.org/2000/svg', 'filter')
                const uuid = uuidv4()
                filter.setAttribute('id', uuid)
                filter.setAttribute('x', '-50%')
                filter.setAttribute('y', '-50%')
                filter.setAttribute('width', '200%')
                filter.setAttribute('height', '200%')
                const dropShadow = document.createElementNS('http://www.w3.org/2000/svg', 'feDropShadow')
                dropShadow.setAttribute('dx', x)
                dropShadow.setAttribute('dy', y)
                dropShadow.setAttribute('stdDeviation', parseFloat(blur) / 2)
                dropShadow.setAttribute('flood-color', `rgb(${colorParts[0]}, ${colorParts[1]}, ${colorParts[2]})`)
                dropShadow.setAttribute('flood-opacity', colorParts[3])
                filter.appendChild(dropShadow)
                svg.appendChild(filter)
                rect.setAttribute('filter', `url(#${uuid})`)

                // if the current rect has a alpha of zero, use a child color if it exists
                if (rectStyle.backgroundColor == 'rgba(0, 0, 0, 0)') {
                    const child = currentNode.children[0]
                    if (child) {
                        const childStyle = window.getComputedStyle(child)
                        rect.setAttribute('fill', childStyle.backgroundColor)
                    }
                }

            }
            svg.appendChild(rect)
            //console.log(rect)
        }


        for (let i = 0; i < currentNode.childNodes.length; i++) {
            const childNode = currentNode.childNodes[i]
            if (!filter(childNode) || (childNode.classList?.contains('CodeMirror-measure'))) {
                continue
            }
            stack.push(childNode)
        }
    }


    // convert svg to data url
    const svgString = new XMLSerializer().serializeToString(svg)
    return `data:image/svg+xml,${svgString}`



}