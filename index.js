const fs = require('fs')
const http = require('http')
const util = require('util')

const codes = fs.readFileSync('codes.txt', 'utf8').trim().split('\n')
const map = require('./map.json')

const urlbase = 'http://www.fileformat.info/info/emoji'
const get = async code => {
  if (map[code] && !/^:/.test(map[code]))
    return

  if (/^:/.test(map[code]) && map[map[code]])
    return map[code] = map[map[code]]

  const c = code.replace(/^:|:$/g, '')
  let html = ''
  await new Promise(done => {
    const url = `${urlbase}/${c}/index.htm`
    http.get(url, async res => {
      if (res.statusCode !== 200) {
        if (res.statusCode === 302 && res.headers.location) {
          const alias = res.headers.location.replace(
            /http:\/\/www.fileformat.info\/info\/emoji\/([^\/]+)\/index.htm/,
            ':$1:'
          )
          if (map[alias])
            map[code] = map[alias]
          else {
            // revisit it
            map[code] = alias
            codes.push(alias)
            codes.push(code)
          }
        } else {
          console.log('could not get unicode for %j', code)
          console.error(res.statusCode, res.headers)
        }
        // res.pipe(process.stderr)
        return done()
      }
      res.on('data', c => html += c)
      await new Promise(done => res.on('end', done))
      const codematch = html.match(/<td>Unicode codepoint\(s\)<\/td>[\r\s\t\n]*<td><a href="\/info\/unicode\/char\/([0-9a-f]+)/)
      if (codematch) {
        const emoji = (new Function('return "\\u{' + codematch[1] + '}"'))()
        map[code] = emoji
      } else {
        console.log('no codepoint for %j', code)
      }
      done()
    })
  })
}

const run = async _ => {
  for (let i = 0; i < codes.length; i++) {
    await get(codes[i])
  }
  fs.writeFileSync('map.json', JSON.stringify(map, null, 2) + '\n')
  const out = [
`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
`
  ]
  for (let code in map) {
    out.push(`  <dict>
    <key>phrase</key>
    <string>${map[code]}</string>
    <key>shortcut</key>
    <string>${code}</string>
  </dict>`)
  }
  out.push('</array>', '</plist>', '')

  fs.writeFileSync('emojis.plist', out.join('\n'), 'utf8')
}

run()
