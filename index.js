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
    .process(fs.readFileSync(from), {from, to})
    .then(result => {
      fs.writeFileSync(to, result.css)
      if(result.map) fs.writeFileSync(to + '.map', result.map)
      log(chalk.green.bold('=>     compiled: ' + from + ' to ' + to))
      result.warnings().forEach(warn => log(chalk.red('!!      warning: ' + warn.toString())))
      // Get all dependency paths and watch them
      R.compose(
        R.map(f => watchDep(from, f, ()=> {compile(plugins, from, to, log)} ))
      , deps => unwatchRemovedDeps(from, deps)
      , R.map(dep => dep.file)
      , R.filter(m => m && m.type === 'dependency')
      )(result.messages || [])
    })
    .catch(logCompileErr)
}


let watching = {}
// Unwatch all dependents that have been removed from an index file
const unwatchRemovedDeps = (index, deps) => {
  const keys = R.keys(watching[index].deps)
  const missing = R.without(deps, keys)
  R.map(
    f => unwatchDep(index, f)
  , missing)
  return deps
}
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
const watchDep = (index, file, cb) => {
  if(watching[index].deps[file]) return
  watching[index].deps[file] = watch(file, ()=> {
    if(!fileExists(index)) {
      unwatchIndex(index)
    } else if(!fileExists(file)) {
      unwatchDep(index, file)
    } else {
      cb()
    }
  })
}

const watch = (file, cb) => {
  log(chalk.gray('<>     watching: ' + file))
  return fs.watch(file, {}, cb)
}

// - create an object of index filenames that map to arrays
// - for each key in the object, compile it and find all the dependent filepaths
// - watch each file path and compile the index on changes
// - watch each index and recompile itself on changes

let log = ()=>{}
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
  if(options.log) log = console.log.bind(console)
  walkDir(options.input, options)
}

// Recursively walk through a directory, finding all index css files or assets
// Uses a stack, not actual recursion
const walkDir = (input, options) => {
  const inputRegex = new RegExp("^" + options.input.replace('/', '\/'))
  let stack = [input]
  // Tree traversal of directory structure using stack recursion
  while(stack.length) {
    input = stack.pop()
    const stats = fs.lstatSync(input)
    const output = R.replace(inputRegex, options.output, input)
    if(stats.isDirectory()) {
      // Watch the directory for new files
      // Push all children in the directory to the stack
      watchDir(input, output, options)
      const children = R.map(R.concat(input + '/'), fs.readdirSync(input))
      stack.push.apply(stack, children)
    } else if(stats.isFile()) {
      watchNewFile(input, output, options)
    }
  }
}

let watchingDirs = {}
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
    watchIndex(input, ()=> compile(options.plugins, input, output))
  } else {
    // Find any asset extension matches
    const ext = input.split('.').pop()
    if(R.contains(ext, options.copyAssets)) {
      copyAsset(input, output)
      watchAsset(input, output)
    }
  }
}

const watchAsset = (input, output) => {
  log(chalk.gray('<>     watching: ' + input))
  let watcher = fs.watch(input, {}, ()=> {
    if(!fs.lstatSync(input).isFile()) {
      log(chalk.gray('<>      closing: ' + input))
      watcher.close()
    }
    else copyAsset(input, output)
  })
}

// copy a file over to an output dir
const copyAsset = (input, output) => {
  createDirs(output)
  log(chalk.blue('>>      copying: ' + input + ' to ' + output))
  let rd = fs.createReadStream(input)
  rd.on('error', err => log('!! read error: ' + input + " - " + err))
  let wr = fs.createWriteStream(output)
  wr.on('error', err => log(chalk.red('!! write error: ' + input + ' - ' + err)))
  rd.pipe(wr)
}

module.exports = initialize
