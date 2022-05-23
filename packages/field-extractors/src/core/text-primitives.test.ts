import _ from 'lodash';

import { prettyPrint, putStrLn, setLogEnvLevel } from "@watr/commonlib";
import { findMultiMatchIndex, mgrepDropUntil, mgrepTakeUntil } from './text-primitives';

describe('HTML jquery-like css queries', () => {

    setLogEnvLevel('info');

    it('smokescreen', async () => {
        const text = `
apple
banana
cherry
apple
horse
banana
monkey
cherry
cat
`.split('\n').filter(s => s.trim().length > 0);

        const tests: RegExp[][] = [
            [/apple/],
            [/banana/],
            [/apple/, /banana/],
            [/apple/, /horse/],
            [/banana/, /mon/],
            [/cherry/, /.*/, /horse/],
        ];

        const lines = _.map(text, (l, i) => `${i}. ${l}`).join('\n');
        putStrLn(lines)

        const results = _.map(tests, (regexes) => {
            const startLine = findMultiMatchIndex(text, regexes);
            const dropUntilInc = mgrepDropUntil(text, regexes, true).join('; ');
            const dropUntilExc = mgrepDropUntil(text, regexes, false).join('; ');
            const takeUntilInc = mgrepTakeUntil(text, regexes, true).join('; ');
            const takeUntilExc = mgrepTakeUntil(text, regexes, false).join('; ');
            prettyPrint({
                matcher: regexes.map(r => r.source).join(' __ '),
                dropUntilInc,
                dropUntilExc,
                takeUntilInc,
                takeUntilExc
            })
            return `${startLine} <- ${regexes.map(r => r.source).join(' _ ')}`
        });

        prettyPrint({ results })
        // const m1 = getMatchingLines([/banana/], defaultLineMatchOptions, text )

    });

});
