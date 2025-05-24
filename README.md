# chart-object

Library to manipulate CWP charts, to encode them to files and decode them from files,
and to convert them to CBT format.

## Installation

If you use npm (or alike) to manage dependencies, run

```bash
npm install @charwasp/chart-object
```

to install this library.
Then, you can either use ESM-style `import` or CommonJS-style `require` to load the library:

```javascript
import { Chart } from '@charwasp/chart-object';
const chart = new Chart(0, 2, 1);
```

```javascript
const { Chart } = require('@charwasp/chart-object');
const chart = new Chart(0, 2, 1);
```

## Use in browsers

If you want to load the library in a webpage, you can use the self-contained IIFE version

```html
<script src="https://cdn.jsdelivr.net/npm/@charwasp/chart-object@latest/dist/index.iife.min.js"></script>
```

(replace `latest` with a specific version to avoid breaking changes;
remove the `.min` to use the unminified version).
After loading this script, the library will be exposed as a global variable `CharWasP`:

```javascript
const chart = new CharWasP.Chart(0, 2, 1);
```

You can also use the files in the
[`dist` directory](https://github.com/charwasp/chart-object/tree/package/dist) of the
`package` branch on GitHub to get the library built from the latest commit in the `master` branch.
Some CDN sources allow you to load files from GitHub, such as jsDelivr:

```html
<script src="https://cdn.jsdelivr.net/gh/charwasp/chart-object@package/dist/index.iife.min.js"></script>
```

## Documentation

There is
[online documentation](https://charwasp.github.io/doc/chart-object).

The [`doc` branch](https://github.com/charwasp/chart-object/tree/doc)
on GitHub contains the documentation generated from the latest commit in the `master` branch.

## Development

To compile the TypeScript code to JavaScript, run

```bash
npm run build
```

and then the JavaScript code will be in the `dist` directory.

To run tests, run

```bash
npm test
```

There are also some tests that you can run in a browser.
First build the JavaScript with `npm run build`, and then
use your favorite web server to host the repo, and then access `/test/index.html`.

To build the documentation, run

```bash
npm run doc
```

and then the documentation will be in the `doc` directory.

## License

AGPL-3.0-or-later.
