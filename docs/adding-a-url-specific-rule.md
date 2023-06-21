
All rules are aggregated in `📄 packages/field-extractors/src/core/url-specific-rules.ts`

Rules are grouped according to the method used to extract them.

<br/>

As a first example, consider this rule for pages in the "dl.acm.org" domain.

### 📄 packages/field-extractors/src/core/url-specific-rules-1.ts
```typescript
export const dlAcmOrgRule: ExtractionRule = compose(
  urlFilter(/dl.acm.org/),
  withResponsePage(compose(
    collectFanout(
      gatherDublinCoreTags,
      selectElemTextEvidence('.citation__title'),
      selectElemTextEvidence('.abstractInFull'),
      selectAllElemAttrEvidence('a[class="author-name"]', 'title'),
      selectElemAttrEvidence('a[title="PDF"]', 'href'),
    ),
    validateEvidence({
      'DC.Title?': 'title',
      'citation__title?': 'title',
      abstractInFull: 'abstract',
      'DC.Creator?': 'author',
      'PDF?': 'pdf-link',
    }),
  )),
);
```

<br/>

<br/>

<br/>

### 📄 packages/field-extractors/src/core/html-query-primitives.ts
```typescript
export function expandCaseVariations(seed: string, sub: (s: string) => string): string {
  const variations = _.reduce(seed, (acc, char) => {
```
