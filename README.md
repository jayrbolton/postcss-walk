
# postcss-watch

Simple helper module that you can import and use to create a postcss watcher script

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
