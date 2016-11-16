const assert = require('assert')
const postcssWatch = require('../')
const fs = require('fs')
const flyd = require('flyd')

const input = 'test/lib'
const output = 'test/public'

const changes1 = 'body {background: pink;}'

describe('postcss-watch', () => {

  it('watches for changes and compiles', done => {
    postcssWatch({ input, output, plugins: [], verbose: true })
    done()
  })
})
