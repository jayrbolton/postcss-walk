const assert = require('assert')
const postcssWatch = require('../')
const fs = require('fs')
const flyd = require('flyd')

const input = 'test/lib/test.css'
const output = 'test/public/test.css'

const changes1 = 'body {background: pink;}'

describe('postcss-watch', () => {

  it('watches for changes and compiles', done => {
    fs.writeFileSync(input, '')
    const compile$ = postcssWatch({ input, output, plugins: [], verbose: true })

    flyd.map(data => {
      const contents = fs.readFileSync(output).toString()
      assert.equal(contents, changes1)
      done()
    }, compile$)

    fs.writeFileSync(input, changes1)
  })
})
