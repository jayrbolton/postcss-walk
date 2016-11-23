const postcssWatch = require('../')
const fs = require('fs')
const pimport = require('postcss-import')

const input = 'test/lib'
const output = 'test/public'
const plugins = [
   require('postcss-import')
 , require('precss')
 , require('postcss-color-function')
 , require('autoprefixer')
]

const changes1 = 'body {background: pink;}'

postcssWatch({ input, output, plugins, log: true, copyAssets: ['jpg'] })
