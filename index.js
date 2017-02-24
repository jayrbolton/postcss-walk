const R = require('ramda')
const fs = require('fs')
const postcss = require('postcss')
const chalk = require('chalk')

const fileExists = path => {
  try {
    fs.accessSync(path)
    return true
  } catch(e) {
    return false
  }
}

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

const logCompileErr = err => 
  process.stderr.write(chalk.red('!!        error: ' + err.message + '\n'))

// Postcss compile an input file to an output path using a postcss compiler object
const compile = (plugins, from, to) => {
  postcss(plugins)
    .process(fs.readFileSync(from), {from, to, map: true})
    .then(result => {
      fs.writeFileSync(to, result.css)
      if(result.map) fs.writeFileSync(to + '.map', result.map)
      log(chalk.green.bold('=>     compiled: ' + from + ' to ' + to))
      result.warnings().forEach(warn => log(chalk.red('!!      warning: ' + warn.toString())))
      // Get all dependency paths and watch them
      const recurseCompile = ()=> compile(plugins, from, to)
      const notModule = p => p.indexOf('node_modules') === -1
      const isDep = m => m && m.type === 'dependency'
      R.compose(
        R.map(watchDep(from, recurseCompile))
      , R.filter(notModule)
      , unwatchRemovedDeps(from)
      , R.map(R.prop('file'))
      , R.filter(isDep)
      )(result.messages || [])
    })
    .catch(logCompileErr)
}


var watching = {}
// Unwatch all dependents that have been removed from an index file
const unwatchRemovedDeps = R.curryN(2, (index, deps) => {
  if(watching[index]) {
    const keys = R.keys(watching[index].deps)
    const missing = R.without(deps, keys)
    R.map(f => unwatchDep(index, f), missing)
  }
  return deps
})
// Unwatch an index file (plus all its dependents)
const unwatchIndex = index => {
  if(!watching[index]) return
  log(chalk.gray('<>      closing: ' + index))
  watching[index].watcher.close()
  R.map(w => w.close(), watching[index].deps)
  delete watching[index]
}
// Unwatch a dependent file
const unwatchDep = (index, file) => {
  if(!watching[index].deps[file]) return
  log(chalk.gray('<>      closing: ' + file))
  watching[index].deps[file].close()
  delete watching[index].deps[file]
}
// Start watching an index file (unwatch it if it is removed)
const watchIndex = (file, cb) => {
  watching[file] = {
    deps: {}
  , watcher: watch(file, ()=> { fileExists(file) ? cb() : unwatchIndex(file) })
  }
}
// Start watching a depndent file (compile the parent on dependent file changes)
// Unwatch the index file if it is removed, and unwatch the dependent if it is removed
const watchDep = R.curryN(3, (index, cb, file) => {
  if(!watching[index] || watching[index].deps[file]) return
  watching[index].deps[file] = watch(file, ()=> {
    if(!fileExists(index)) {
      unwatchIndex(index)
    } else if(!fileExists(file)) {
      unwatchDep(index, file)
    } else {
      cb()
    }
  })
})

const watch = (file, cb) => {
  log(chalk.gray('<>     watching: ' + file))
  return fs.watch(file, {}, cb)
}

var log = ()=>{}
// options.plugins is an array of postcss plugin modules
// options.input is the top-level directory of containing all input css files
// options.output is the top-level directory that will contain all output/compiled css files
const initialize = options => {
  // Set defaults
  options = R.merge({
    indexName: 'index.css'
  , plugins: []
  , input: ''
  , output: ''
  , watch: false
  }, options)
  // Log is a no-op unless options.log is true
  if(options.log) log = console.log.bind(console)
  walkDir(options.input, options)
}

// Recursively walk through a directory, finding all index css files
// Uses a stack, not actual recursion
const walkDir = (input, options) => {
  const inputRegex = new RegExp("^" + options.input.replace('/', '\/'))
  var stack = [input]
  // Tree traversal of directory structure using stack recursion
  while(stack.length) {
    input = stack.pop()
    const stats = fs.lstatSync(input)
    const output = R.replace(inputRegex, options.output, input)
    if(stats.isDirectory()) {
      // Watch the directory for new files
      // Push all children in the directory to the stack
      if(options.watch) watchDir(input, output, options)
      const children = R.map(R.concat(input + '/'), fs.readdirSync(input))
      stack.push.apply(stack, children)
    } else if(stats.isFile()) {
      watchNewFile(input, output, options)
    }
  }
}

var watchingDirs = {}
const unwatchDir = (input, output, options) => {
  if(!watchingDirs[input]) return
  watchingDirs[input].close()
  delete watchingDirs[input]
}
const watchDir = (input, output, options) => {
  watchingDirs[input] = fs.watch(input, (ev, filename) => {
    if(ev === 'rename') {
      handleRename(input + '/' + filename, output + '/' + filename, options)
    }
  })
}

const handleRename = (input, output, options) => {
  if(fileExists(input)) {
    const stats = fs.lstatSync(input)
    // New file created
    if(stats.isFile()) {
      watchNewFile(input, output, options)
    // New directory created
    } else if(stats.isDirectory()) {
      watchDir(input, output, options)
      walkDir(input, options)
    }
  } else { // File has been removed
    if(watching[input]) unwatchIndex(input)
    if(watchingDirs[input]) unwatchDir(input)
  }
}

const watchNewFile = (input, output, options) => {
  if(input.match(new RegExp('\/' + options.indexName + '$'))) {
    createDirs(output)
    compile(options.plugins, input, output)
    if(options.watch) watchIndex(input, ()=> compile(options.plugins, input, output))
  }
}

module.exports = initialize
