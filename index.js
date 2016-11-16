const R = require("ramda")
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

const compile = (input, output, postcssObj, log) => {
  let css = fs.readFileSync(input)
  postcssObj
    .process(css, { from: input, to: output })
    .then(result => {
      fs.writeFileSync(output, result.css)
      if(result.map) fs.writeFileSync(output + '.map', result.map)
      log('=> compiled from', input, 'to', output)
    })
    .catch(err => log('!!! compile error: ', err.message))
}

const fullpath = prefix => name => prefix + '/' + name

// options.plugins is an array of postcss plugin modules
// options.input is the top-level directory of containing all input css files
// options.output is the top-level directory that will contain all output/compiled css files
const initialize = options => {
  if(!options.plugins) throw "Don't forget to pass in some postcss plugins to postcss-watch"
  let postcssObj = postcss(options.plugins)
  // Find all files recursively under the input directory
  // Watch every file 
  const log = options.verbose ? console.log.bind(console) : function(){}
  const inputRegex = new RegExp("^" + options.input.replace('/', '\/'))
  // Tree traversal of directory structure using stack recursion
  let stack = R.map(fullpath(options.input), fs.readdirSync(options.input)) // we want fullpaths
  while(stack.length) {
    let path = stack.pop()
    let stats = fs.lstatSync(path)
    let output = path.replace(inputRegex, options.output)
    if(stats.isDirectory()) {
      stack = stack.concat(R.map(fullpath(path), fs.readdirSync(path)))
    } else if(stats.isFile() && /^.+\.css$/.test(path)) {
      createDirs(output)
      compile(path, output, postcssObj, log)
      fs.watch(path, {}, (eventType, filename) => {
        if(eventType === 'change') compile(path, output, postcssObj, log)
      })
    } else {
      // copy other (presumably asset) files over to matching output dir
      createDirs(output)
      log('>> copying asset from', path, 'to', output)
      let rd = fs.createReadStream(path)
      rd.on('error', err => log('>! read error copying', path, " - ", err))
      let wr = fs.createWriteStream(output)
      wr.on('error', err => log('>! write error copying', path, ' - ', err))
      rd.pipe(wr)
    }
  }
}

module.exports = initialize
