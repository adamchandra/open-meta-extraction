# _Overview_
The spidering package  provides an API to build simple  web page scrapers. Under
the hood  it uses Puppeteer  to manage a  headless browser. It  provides several
preconfigured  levels  of script  and  resource  blocking, utilities  to  manage
collections of  downloaded pages, and  extensive logging for  monitoring browser
events.


## Example Include

[include headtag-scripts.ts](packages/field-extractors/src/core/headtag-scripts.ts ':include :type=code typescript :fragment=DEMO')

# _API Usage_

_A basic fetch function might look like the following:_

```typescript
const runScraper: Transform<URL, unknown> = compose(
  cleanArtifacts(), // delete any previously downloaded files for input URL
  fetchUrl(), // run the fetcher
  writeResponseBody() // write to disk
);
```

A more complex example might allow JavaScript to run on certain domains, while other domains would only fetch the HTML document and block all other resources (the default behavior)

```typescript
const tryAlternates = eachOrElse( // try each function, stopping at first success
  compose(
    urlFilterAny([/aaai.org/, /umass.edu/]),
    fetchUrl({javaScriptEnabled=true, allowedResources=['document', 'script'] }),
  ),
  fetchUrl(),
);
```

A working example is available in `📄 packages/spider/src/app/cli.ts`,

Scraping primitives are defined in `📄 packages/spider/src/app/scraping-primitives.ts`, and control-flow primitives are defined in `📄 packages/spider/src/core/taskflow-defs.ts`.

<br/>

