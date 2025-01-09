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
            
            textNode.textContent = currentNode.textContent
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
                const color = globalParts[0] + ')'
                const posParts = globalParts[1].split(" ")
                const x = posParts[0]
                const y = posParts[1]
                const blur = posParts[2]
                const spread = posParts[3]

                const dropShadow = `${x} ${y} ${blur} ${spread} ${color}`
                rect.setAttribute('style', `filter: drop-shadow(${dropShadow});`)
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