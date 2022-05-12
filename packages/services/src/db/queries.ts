import { prettyPrint } from '@watr/commonlib';
import { HostStatus } from './mongodb';
import _ from 'lodash';

import { format, compareAsc, subDays } from 'date-fns';


/**
 * Wanted Stats:
 * - [X] How many new abstracts in past week (by day)
 * - [ ] How many notes processed overall
 *     - [X] With html field?
 *     - [X] With abstract field?
 * - [ ] For each spidered domain:
 *     - [ ]  http status code buckets
 *     - [ ]  # of extracted abstracts
 *     - [ ]  # of missing extracts
 **/

interface BoolIDCounts {
    _id: boolean;
    count: number;
}

interface StrIDCounts {
    _id: string;
    count: number;
}

interface Total {
    total: number;
}

interface ExtractionStatusSummary {
    noteCount: Total[];
    updateByDay: StrIDCounts[];
    totalWithAbstracts: BoolIDCounts[];
    totalWithUrls: BoolIDCounts[];
    withUrlsByDomain: StrIDCounts[];
    withAbstractsByDomain: StrIDCounts[];
    withAbstractsAndUrlByDomain: StrIDCounts[];
    withHttpStatusByDomain: StrIDCounts[];
}

type DomainPresentOrMissing = {
    domain: string,
    missing?: number,
    present?: number
};

type DomainCodeCounts = {
    domain: string,
    httpCode: string,
    count: number
};

function formatAbstractStatusByDomain(title: string, byDomain: StrIDCounts[]): string[] {
    const byDomain1: DomainPresentOrMissing[] = _.map(byDomain, ({ _id, count }) => {
        const [domain, hasAbstract] = _id.split('__')
        if (hasAbstract === 'true') {
            return { domain, present: count, missing: undefined };
        }
        return { domain, present: undefined, missing: count };
    });

    const byDomain2 = _.values(_.groupBy(byDomain1, (r) => r.domain));
    const byDomain3 = _.map(byDomain2, (sdf3a) => {
        const merged = _.merge({}, ...sdf3a)
        return `    ${merged.domain}: ${merged.present} out of ${merged.present + merged.missing}`;
    });

    return [
        title,
        ...byDomain3
    ];
}

function formatHttpStatusByDomain(byDomain: StrIDCounts[]): string[] {
    const byDomain1: DomainCodeCounts[] = _.map(byDomain, ({ _id, count }) => {
        const [domain, httpCode] = _id.split('__')
        return { domain, httpCode, count };
    });

    const byDomain2 = _.values(_.groupBy(byDomain1, (r) => r.domain))
    const byDomain3 = _.map(byDomain2, (domainRecs) => {
        const compressed = _.map(domainRecs, ({ domain, httpCode, count }) => {
            const rec: Record<string, string | number> = {};
            rec['domain'] = domain;
            rec[httpCode] = count;
            return rec;
        });
        const merged = _.merge({}, ...compressed);
        const asString = _.join(
            _.map(
                _.toPairs(merged), ([k, v]) => {
                    if (k === 'domain') {
                        return `${v}:    `;
                    }
                    return `${k}: ${v};  `;
                }
            ), ' '
        )
        return '    ' + asString;
    });

    return ['Http Status Counts By Domain', ...byDomain3];
}



export async function showStatusSummary(): Promise<string[][]> {
    const daysAgo7 = subDays(new Date(), 7)
    const selectOneWeek = {
        $match: {
            updatedAt: {
                $gte: daysAgo7
            },
        }
    };

    const selectHasUrl = {
        $match: { hasUrl: true }
    };

    const groupByUpdateDay = {
        $group: {
            _id: {
                $dateToString: {
                    format: "%Y-%m-%d",
                    date: "$updatedAt",
                }
            },
            count: {
                $sum: 1
            },
        }
    };
    const groupByHaveAbs = {
        $group: {
            _id: '$hasAbstract',
            count: {
                $sum: 1
            },
        }
    };

    const groupByHaveUrl = {
        $group: {
            _id: '$hasUrl',
            count: {
                $sum: 1
            },
        }
    };

    const groupByDomainHasURL = {
        $group: {
            _id: {
                $concat: [
                    '$responseHost', '__', { $toString: '$hasUrl' }
                ]
            },
            count: {
                $sum: 1
            },
        }
    };

    const groupByDomainHasAbstract = {
        $group: {
            _id: {
                $concat: [
                    '$responseHost', '__', { $toString: '$hasAbstract' }
                ]
            },
            count: {
                $sum: 1
            },
        }
    };

    const groupByDomainHttpStatus = {
        $group: {
            _id: {
                $concat: [
                    '$responseHost', '__', { $concat: [{ $substr: [{ $toString: '$httpStatus' }, 0, 1] }, '0x'] }
                ]
            },
            count: {
                $sum: 1
            },
        }
    };

    const count = { $count: 'total' };


    const res = await HostStatus.aggregate([
        {
            $facet: {
                noteCount: [count],
                updateByDay: [selectOneWeek, groupByUpdateDay, { $sort: { _id: 1 } }],
                totalWithAbstracts: [groupByHaveAbs],
                totalWithUrls: [groupByHaveUrl],
                withUrlsByDomain: [groupByDomainHasURL, { $sort: { _id: 1 } }],
                withAbstractsByDomain: [groupByDomainHasAbstract, { $sort: { _id: 1 } }],
                withAbstractsAndUrlByDomain: [selectHasUrl, groupByDomainHasAbstract, { $sort: { _id: 1 } }],
                withHttpStatusByDomain: [groupByDomainHttpStatus, { $sort: { _id: 1 } }],
            }
        }
    ]);

    const statusObj: ExtractionStatusSummary = res[0]
    // prettyPrint({ statusObj })

    const noteCount = statusObj.noteCount[0].total

    const updateByDayMessage: string[] = [
        'Updated Notes Per Day, Last 7 days',
        ..._.map(statusObj.updateByDay, ({ _id, count }) => {
            return `    ${_id}: ${count}`
        })
    ];


    const totalWithAbstractsMessage: string[] = _.flatMap(statusObj.totalWithAbstracts, ({ _id, count }) => {
        return _id ? [`Notes With Abstracts: ${count}`] : []
    })

    const totalWithUrlsMessage = _.flatMap(statusObj.totalWithUrls, ({ _id, count }) => {
        return _id ? [`Notes With URL Field (content.html): ${count}`] : [];
    });


    // const absByDomainMessages = formatAbstractStatusByDomain(
    //     'Extracted Abstract Count By Domain, out of all known Notes',
    //     statusObj.withAbstractsByDomain
    // );

    const absAndUrlByDomainMessages = formatAbstractStatusByDomain(
        'Extracted Abstracts By Domain, out of Notes with valid URLs',
        statusObj.withAbstractsAndUrlByDomain
    );

    const urlByDomainMessages = formatAbstractStatusByDomain(
        'Valid Note URLs (content.html) By Domain',
        statusObj.withUrlsByDomain
    );

    const httpStatusByDomainMessages = formatHttpStatusByDomain(statusObj.withHttpStatusByDomain);

    return [
        [`Total Note Count: ${noteCount}`],
        totalWithAbstractsMessage,
        totalWithUrlsMessage,
        updateByDayMessage,
        urlByDomainMessages,
        absAndUrlByDomainMessages,
        httpStatusByDomainMessages
    ]
}

export function formatStatusMessages(msgs: string[][]): string {
    return _.map(msgs, m => m.join('\n')).join('\n\n')
}
