
# postcss-watch

Postcss runner that crawls a whole directory tree, finds all `index.css` (or a custom main-file name), and compiles each index file into the corresponding path in the output directory, matching the input's directory tree and filepath. It will also copy other assets, like images and fonts. If you are using `postcss-import`, it will listen to changes on dependent css files and re-compile their parents.

This will compile many index.css files within any directory tree into an output directory matching the same directory tree, which can be useful for multi-page apps. Of course you can also just use it to watch/compile a single file.

```js
postcssWatch({
  input      // String path of input directory holding all css files
, output     // String path of output directory in which to put all compiled css
, plugins    // Array of postcss plugins to use
, verbose    // Boolean, whether to log progress, warnings, errors, etc
, indexName  // String name of the main index file(s) that you wish to 
, copyAssets // Array of asset extension names to copy over to the output dir (eg ['jpg', 'png', 'tiff', 'otf'])
})
```

```js
const postcssWatch = require('postcss-watch')

const input = process.argv[2]
if(input === undefined) {
  console.log('Arguments', process.argv)
  throw "Pass in an input css file (eg `node scripts/watch-css.js lib/assets/css/test.css`)"
}
const output = input.replace(/^lib\//, 'public/')

const plugins = [
  require('postcss-import')
]

postcssWatch({ input, output, plugins, verbose: true })
```

If you save the above to `watch.js`, then in bash you can:

```sh
node watch.js lib/test.js
```

it will watch that file and output (in this example) to public/test.js
