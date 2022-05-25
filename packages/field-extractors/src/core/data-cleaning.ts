import _ from 'lodash';

import { Change } from '@watr/commonlib';

export interface CleaningRule {
  name: string;
  guards: RegExp[];
  run(str: string, guards: RegExp[]): string | undefined;
}

export interface CleaningRuleResult {
  rule: string;
  changes: Change[]
}

/* eslint-disable  @typescript-eslint/explicit-module-boundary-types */
export const AbstractCleaningRules: CleaningRule[] = [
  {
    name: 'starts w/\'abstract\'',
    guards: [
      /^abstract/i
    ],
    run: (str) => {
      return str.replace(/^abstract */i, '');
    }
  },
  {
    name: 'starts w/\'motivation\'',
    guards: [
      /^motivation/i
    ],
    run: (str) => {
      return str.replace(/^motivation */i, '');
    }
  },

  {
    name: 'clip @ \'References\'',
    guards: [
      /(References|REFERENCES)/
    ],
    run: (str) => {
      const regex = /(References|REFERENCES).*$/;
      return str.replace(regex, '');
    }
  },


  {
    name: 'clip @ \'Keywords\'',
    guards: [
      /(Keywords).*$/
    ],
    run: (str, guards) => {
      const regex = guards[0];
      return str.replace(regex, '');
    }
  },

  {
    name: 'starts w/non-word',
    guards: [
      /^\W+/i
    ],
    run: (str, guards) => {
      const regex = guards[0];
      return str.replace(regex, '');
    }
  },

  {
    name: 'clip @ Cite This Paper',
    guards: [
      /cite this paper abstract/i
    ],
    run: (str, guards) => {
      const regex = guards[0];
      let [, post] = str.split(regex);
      post = post ? post.trim() : '';
      return post;
    }
  },

  {
    name: 'clip @ Disqus comments',
    guards: [
      /comments[\d ]+comments.*$/i
    ],
    run: (str, guards) => {
      const regex = guards[0];
      return str.replace(regex, '');
    }
  },
  {
    name: 'clip @ trailing tags <.. />',
    guards: [
      /<etx.*$/i
    ],
    run: (str, guards) => {
      const regex = guards[0];
      return str.replace(regex, '');
    }
  },
  {
    name: 'clip @ trailing <',
    guards: [
      /<$/i
    ],
    run: (str, guards) => {
      const regex = guards[0];
      return str.replace(regex, '');
    }
  },
  {
    name: 'remove newlines',
    guards: [
    ],
    run: (str) => {
      return str.split('\n').join(' ');
    }
  },

  {
    name: 'trim extra space',
    guards: [
      / {2,}/g
    ],
    run: (str) => {
      const regex = / +/gm;
      return str.replace(regex, ' ');
    }
  },

  {
    name: 'clip @ \'Full Text: PDF\'',
    guards: [
      /(Full Text:).*$/
    ],
    run: (str, guards) => {
      const regex = guards[0];
      return str.replace(regex, '');
    }
  },
  {
    name: 'clip @ \'Related Material\'',
    guards: [
      /Related Material.*$/
    ],
    run: (str, guards) => {
      const regex = guards[0];
      return str.replace(regex, '');
    }
  },

  {
    name: 'clip before /Graphical abstract Download/',
    guards: [
      /graphical abstract download/i
    ],
    run: (str, guards) => {
      const regex = guards[0];

      let [pre,] = str.split(regex);
      pre = pre ? pre.trim() : '';
      return pre;
    }
  },

  {
    name: 'Catch-alls: e.g., /^Home Page Papers|^Complexity/..',
    guards: [
      /home page papers/i,
      /Complexity . Journal Menu/,
      /no abstract available/i,
      /^download.article/i,
      /open access article/i,
      /For authors For reviewers/,
      /banner art adapted from/i,
      /a collection of accepted abstracts/i,
    ],
    run: () => ''
  },
  {
    name: '/Home Archives/ >> maybe /Abstract.*/',
    guards: [
      /^Home Archives/
    ],
    run: (str) => {
      const regex = /Abstract/;
      let [, post] = str.split(regex);
      post = post ? post.trim() : '';
      return post;
    }
  },

  {
    name: 'abstract too short',
    guards: [],
    run: (str) => {
      if (str.length < 200) return '';
    }
  },

];

