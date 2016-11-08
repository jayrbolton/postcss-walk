const R = require("ramda")
const flyd = require("flyd")
const fs = require('fs')
const postcss = require('postcss')

const input = process.argv[2]
if(input === undefined) {
  console.log('Arguments', process.argv)
  throw "Pass in an input css file (eg `node scripts/watch-css.js lib/assets/css/test.css`)"
}
const output = input.replace(/^lib\//, 'public/')
console.log('input:', input)
console.log('output:', output)

const change$ = flyd.stream()

const createDirs = path => {
  const prefix = 'public'
  // Every directory in an array (eg ['css', 'css/nonprofits', 'css/nonprofits/recurring_donations']
  const everyDir = R.compose(
    R.dropLast(1) // we don't want the filename
  , R.drop(2) // we don't want the initial dot or the /lib directory
  , R.map(R.join('/'))
  , R.scan((arr, p) => R.append(p, arr), [])
  , R.split('/')
  )(path)
  console.log('everyDir', everyDir)
  everyDir.map(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir)
  })
}
createDirs(output)

const compile = css => {
  postcss([require('postcss-import')])
    .process(css, { from: input, to: output })
    .then(result => {
      fs.writeFileSync(output, result.css)
      if(result.map) fs.writeFileSync(output + '.map', result.map)
      console.log('-> compiled to', output)
    })
    .catch(err => console.log('!!! compile error: ', err.message))
  }

const readFile = () => fs.readFile(input, (err, data) => change$(data))
readFile()

fs.watch(input, {}, (eventType, filename) => {
  if(eventType === 'change') readFile()
})

flyd.map(css => console.log(`\n:o] css change detected!`), change$)
flyd.map(compile, change$)

