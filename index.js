const R = require("ramda")
const flyd = require("flyd")
const fs = require('fs')
const postcss = require('postcss')


const createDirs = path => {
  // Every directory level in an array (eg ['css', 'css/nonprofits', 'css/nonprofits/recurring_donations']
  const everyDir = R.compose(
    R.dropLast(1) // we don't want the path with the filename at the end (last element in the scan)
  , R.drop(1) // we don't want the first empty array from the scan
  , R.map(R.join('/'))
  , R.scan((arr, p) => R.append(p, arr), [])
  , R.split('/')
  )(path)
  everyDir.map(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir)
  })
}

const compile = (input, output, postcssObj, log) => css =>
  postcssObj
    .process(css, { from: input, to: output })
    .then(result => {
      fs.writeFileSync(output, result.css)
      if(result.map) fs.writeFileSync(output + '.map', result.map)
      console.log('-> compiled to', output)
    })
    .catch(err => console.log('!!! compile error: ', err.message))

const readFile = (input, change$) => 
  fs.readFile(input, (err, data) => change$(data))

const initialize = options => {
  if(!options.plugins) throw "Don't forget to pass in some postcss plugins to postcss-watch"
  let postcssObj = postcss(options.plugins)
  const change$ = flyd.stream()
  createDirs(options.output)
  // readFile(options.input, change$)
  fs.watch(options.input, {}, (eventType, filename) => {
    if(eventType === 'change') readFile(options.input, change$)
  })
  const log = options.verbose ? console.log : function(){}
  flyd.map(css => log(`\n:o] css change detected!`), change$)
  const compile$ = flyd.map(compile(options.input, options.output, postcssObj, log), change$)
  return compile$
}

module.exports = initialize
