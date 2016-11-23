const R = require('ramda')
const fs = require('fs')
const postcss = require('postcss')

// Create the full directory tree for a file path
const createDirs =
  R.compose(
    R.map(dir => fs.mkdirSync(dir)) // create all missing directories
  , R.filter(dir => !fs.existsSync(dir)) // filter out only dirs that do not exist
  , R.dropLast(1) // we don't want the path with the filename at the end (last element in the scan)
  , R.drop(1) // we don't want the first empty array from the scan
  , R.map(R.join('/')) // Array of directory levels ['', 'css', 'css/nonprofits', 'css/nonprofits/recurring_donations.css']
  , R.scan((arr, p) => R.append(p, arr), []) // an array of arrays of directory levels [[], ['css'], ['css', 'nonprofits'], ['css', 'nonprofits', 'recurring_donations.css']]
  , R.split('/')
  )

const logCompileErr = err => process.stderr.write('!!! compile error: ' + err.message)

// Postcss compile an input file to an output path using a postcss compiler object
const compile = (plugins, from, to, log) => {
  postcss(plugins)
    .process(fs.readFileSync(from), {from, to})
    .then(result => {
      fs.writeFileSync(to, result.css)
      if(result.map) fs.writeFileSync(to + '.map', result.map)
      log('=> compiled from ' + from + ' to ' + to)
      result.warnings().forEach(warn => log('XX compile warning: ' + warn.toString()))
    })
    .catch(logCompileErr)
}

const watch = (file, cb) => {
  fs.watch(file, {}, eventType => {
    if(eventType === 'change') cb()
  })
}

// If using postcss-import, watch all the children to the main css file and recompile the main file on child changes
const watchChildren = (plugins, from, to, log) => { 
  postcss(plugins)
    .process(fs.readFileSync(from), {from, to})
    .then(result =>
      // Get all dependency paths and watch them
      R.compose(
        R.map(f => watch(f, ()=> compile(plugins, from, to, log)))
      , R.map(dep => dep.file)
      , R.filter(m => m && m.type === 'dependency')
      )(result.messages || [])
    )
    .catch(logCompileErr)
}

// - create an object of index filenames that map to arrays
// - for each key in the object, compile it and find all the dependent filepaths
// - watch each file path and compile the index on changes
// - watch each index and recompile itself on changes

// options.plugins is an array of postcss plugin modules
// options.input is the top-level directory of containing all input css files
// options.output is the top-level directory that will contain all output/compiled css files
const initialize = options => {
  // Set defaults
  options = R.merge({
    copyAssets: []
  , indexName: 'index.css'
  , plugins: []
  , input: ''
  , output: ''
  }, options)
  // Log is a no-op unless options.log is true
  // Should this be stdout
  const log = options.log ? console.log.bind(console) : (()=>{})
  // Initialize postcss compiler object
  const postcssObj = postcss(options.plugins)
  const inputRegex = new RegExp("^" + options.input.replace('/', '\/'))
  // get absolute paths of each child file/dir under the input directory
  let stack = R.map(R.concat(options.input + '/'), fs.readdirSync(options.input)) 
  // Tree traversal of directory structure using stack recursion
  while(stack.length) {
    const path = stack.pop()
    const stats = fs.lstatSync(path)
    const output = R.replace(inputRegex, options.output, path)
    if(stats.isDirectory()) {
      const children = R.map(R.concat(path + '/'), fs.readdirSync(path))
      stack.push.apply(stack, children)
    } else if(stats.isFile() && path.match(options.indexName)) {
      createDirs(output)
      compile(options.plugins, path, output, log)
      watch(path, ()=> compile(options.plugins, path, output, log))
      // For every dependent child to this mainfile, watch each one and recompile this mainfile on their changes
      watchChildren(options.plugins, path, output, log)
    } else {
      // Find any asset extension matches
      const ext = path.split('.').pop()
      if(R.contains(ext, options.copyAssets)) copyAsset(path, output, log)
    }
  }
}

// copy a file over to an output dir
const copyAsset = (path, output, log) => {
  createDirs(output)
  log('>> copying asset from ' + path + ' to ' + output)
  let rd = fs.createReadStream(path)
  rd.on('error', err => log('>! read error copying ' + path + " - " + err))
  let wr = fs.createWriteStream(output)
  wr.on('error', err => log('>! write error copying ' + path + ' - ' + err))
  rd.pipe(wr)
}

module.exports = initialize
