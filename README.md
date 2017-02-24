# postcss-walk

Postcss runner that crawls a whole directory tree, finds all `page.css` (or any main-file name you want), and compiles each main file into the corresponding path in the output directory, matching the input's directory tree and filepath. It can either build everything and exit, or it can watch for file changes indefinitely. If you are using `postcss-import`, it will listen to changes on dependent css files and re-compile their parent files.

Compiling multiple css files from a source directory to a matching output directory can be useful for multi-page apps. Of course, you can also just use it to watch/compile a single file.

```js
postcssWatch({
  input      // String path of input directory holding all css files
, output     // String path of output directory in which to put all compiled css
, indexName  // String name of the main index file(s) that you wish to (defaults to 'index.css')
, plugins    // Array of postcss plugins to use
, log        // Boolean, whether to log to stdout the file paths that are compiled (and compile warnings)
, watch      // Boolean, whether to watch files for changes (defaults to false)
})
```

```js
const postcssWatch = require('postcss-watch')

// Source files from:
const input  = 'lib/css'
// Output compiled files to:
const output = 'public/css'

const plugins = [ require('postcss-import') ]

postcssWatch({ input, output, plugins, log: true, watch: true })
```

Then run `node your-css-compile-script.js`

