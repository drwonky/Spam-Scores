import { SCORE_SYMBOLS } from './score_symbols.js'
import { SCORE_DETAILS_ARRAY, SPAM_HEADER_REGEX, SYMBOL_REGEX } from '../../constants.js'

browser.tabs
  .query({
    active: true,
    currentWindow: true
  })
  .then(async tabs => {
    // Declaration / Values
    const tabId = tabs[0].id
    browser.messageDisplay.getDisplayedMessage(tabId).then(async message => {
      const fullMessage = await browser.messages.getFull(message.id)
      const parsedDetailScores = getParsedDetailScores(fullMessage.headers)
      if (parsedDetailScores) {
        const groupedDetailScores = {
          positive: parsedDetailScores.filter(el => el.score > 0).sort((a, b) => b.score - a.score),
          negative: parsedDetailScores.filter(el => el.score < 0).sort((a, b) => a.score - b.score),
          neutral: parsedDetailScores.filter(el => el.score === 0).sort((a, b) => a.name.localeCompare(b.name))
        }
        let scoreDetailElements =
          '<table class="score-details"><tr><th>Score</th><th>Name</th><th>Description</th></tr>'
        for (let groupType of ['positive', 'negative', 'neutral']) {
          scoreDetailElements += `
          ${groupedDetailScores[groupType]
            .map(el => {
              const symbol = SCORE_SYMBOLS.find(sym => sym.name === el.name)
              let element = `<tr class="score ${groupType}">`
              element += `<td><span>${el.score}</span></td>`
              element += `<td><span>${el.name || '-'}</span></td>`
              element += `<td><span>${
                symbol || el.description
                  ? `${symbol ? symbol.description : el.description}${
                      el.info ? ` <div class="info">[${el.info}]</div>` : ''
                    }`
                  : ''
              }</span></td>`
              element += '</tr>'
              return element
            })
            .join('')}
        `
        }
        scoreDetailElements += '</table>'
        document.body.innerHTML = `
        ${scoreDetailElements}
      `
      } else {
        document.body.innerHTML = '<h5>No details available</h5>'
      }
    })
  })

/**
 * Parse the headers
 * @param {object} headers
 * @returns
 */
function getParsedDetailScores(headers) {
  for (const headerName in headers) {
    if (SCORE_DETAILS_ARRAY.includes(headerName)) {
      let headerValue = headers[headerName][0] // For some reason thunderbird always saves it as an array
      // We might use directly switch case instead of checking if the header is there
      switch (headerName) {
        case 'x-spam-report':
          /**
           * dlh2 TODO: Okay #34 problem is here, we have a lot of ways to deal with it,
           * but you know, we can't split with \n as somehow the email is translated to
           * some whitespaces therefore this gotta be interesting.
           */
          const reportSplitted = headerValue.split('Content analysis details:')
          if (reportSplitted.length > 1) {
            headerValue = reportSplitted[1]
          }
        case 'x-spam-status':
          let symbolMatch = headerValue.match(SYMBOL_REGEX.prefix)
          if (symbolMatch && symbolMatch.length > 0) {
            return symbolMatch
              .map(el => el.trim().replace(/\r?\n/g, ' '))
              .map(el => ({
                name: sanitizeRegexResult(el.replace(SYMBOL_REGEX.prefixSingle, '$2')),
                score: parseFloat(sanitizeRegexResult(el.replace(SYMBOL_REGEX.prefixSingle, '$1')) || 0),
                info: sanitizeRegexResult(el.replace(SYMBOL_REGEX.prefixSingle, '$4')) || '',
                description: sanitizeRegexResult(el.replace(SYMBOL_REGEX.prefixSingle, '$3')) || ''
              }))
          }
          symbolMatch = headerValue.match(SYMBOL_REGEX.suffix)
          if (symbolMatch && symbolMatch.length > 0) {
            return symbolMatch
              .map(el => el.trim().replace(/\r?\n/g, ' '))
              .map(el => ({
                name: sanitizeRegexResult(el.replace(SYMBOL_REGEX.suffix, '$1')),
                score: parseFloat(sanitizeRegexResult(el.replace(SYMBOL_REGEX.suffix, '$2')) || 0),
                info: sanitizeRegexResult(el.replace(SYMBOL_REGEX.suffix, '$3')) || ''
              }))
          }
          break
        default:
          return null
      }
    }
  }
  return null
}

function sanitizeRegexResult(result) {
  return result?.trim()?.replace(/\s\s+/g, ' ')
}
