import { HostStatus, NoteStatus } from './schemas';
import _ from 'lodash';

import { subDays } from 'date-fns';
import { prettyPrint } from '@watr/commonlib';

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

interface NoteStatusSummary {
    noteCount: Total[];
    updateByDay: StrIDCounts[];
    totalWithUrls: BoolIDCounts[];
    withUrlsByDomain: StrIDCounts[];
}

interface ExtractionStatusSummary {
    noteCount: Total[];
    updateByDay: StrIDCounts[];
    workflowStatus: StrIDCounts[];
    totalWithAbstracts: BoolIDCounts[];
    withAbstractsByDomain: StrIDCounts[];
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

function collateStrIDCounts(recs: StrIDCounts[]): string[] {
    return _.map(recs, ({ _id, count }) => {
        return `    ${_id}: ${count}`;
    });
}

function formatAbstractStatusByDomain(title: string, byDomain: StrIDCounts[]): string[] {
    const byDomain1: DomainPresentOrMissing[] = _.map(byDomain, ({ _id, count }) => {
        const [domain, hasAbstract] = _id.split('__')
        if (hasAbstract === 'true') {
            return { domain, present: count, missing: 0 };
        }
        return { domain, present: 0, missing: count };
    });

    const domainsWithMissing = _.filter(byDomain1, ({ missing }) => missing !== undefined && missing > 0);
    const domainsWithoutMissing = _.filter(byDomain1, ({ missing }) => missing == undefined || missing === 0);
    const domainsSorted = _.concat(
        domainsWithoutMissing,
        domainsWithMissing
    );


    const byDomain3 = _.map(domainsSorted, (rec) => {
        const present = rec.present !== undefined ? rec.present : 0;
        const missing = rec.missing !== undefined ? rec.missing : 0;
        return `    ${present} of ${present + missing}: ${rec.domain}`;
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
            _id: '$validUrl',
            count: {
                $sum: 1
            },
        }
    };

    const selectValidResponse = {
        $match: {
            validResponseUrl: true,
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

    const groupByWorkflowStatus = {
        $group: {
            _id: '$workflowStatus',
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

    const noteStatusRes = await NoteStatus.aggregate([{
        $facet: {
            noteCount: [count],
            updateByDay: [selectOneWeek, groupByUpdateDay, { $sort: { _id: 1 } }],
            totalWithUrls: [groupByHaveUrl],
        }
    }]);

    const noteStatusSummary: NoteStatusSummary = noteStatusRes[0];

    const res = await HostStatus.aggregate([{
        $facet: {
            noteCount: [count],
            updateByDay: [selectOneWeek, groupByUpdateDay, { $sort: { _id: 1 } }],
            totalWithAbstracts: [groupByHaveAbs],
            workflowStatus: [groupByWorkflowStatus],
            withAbstractsByDomain: [selectValidResponse, groupByDomainHasAbstract, { $sort: { _id: 1 } }],
            withHttpStatusByDomain: [selectValidResponse, groupByDomainHttpStatus, { $sort: { _id: 1 } }],
        }
    }]);

    const hostStatusSummary: ExtractionStatusSummary = res[0]

    // prettyPrint({ res })

    const noteCount = noteStatusSummary.noteCount.length === 0 ? 0 : noteStatusSummary.noteCount[0].total

    const updateByDayMessage: string[] = [
        'Updated Notes Per Day, Last 7 days',
        ..._.map(hostStatusSummary.updateByDay, ({ _id, count }) => {
            return `    ${_id}: ${count}`
        })
    ];


    const totalWithAbstractsMessage: string[] = _.flatMap(hostStatusSummary.totalWithAbstracts, ({ _id, count }) => {
        return _id ? [`Notes With Abstracts: ${count}`] : []
    })

    const totalWithUrlsMessage = _.flatMap(noteStatusSummary.totalWithUrls, ({ _id, count }) => {
        return _id ? [`Notes With Valid URL Field (content.html): ${count}`] : [];
    });

    const absByDomainMessages = formatAbstractStatusByDomain(
        'Extracted Abstracts By Domain, out of Notes with valid URLs',
        hostStatusSummary.withAbstractsByDomain
    );

    const httpStatusByDomainMessages = formatHttpStatusByDomain(hostStatusSummary.withHttpStatusByDomain);
    const workflowStatus = [
        "Workflow Status Counts",
        ...collateStrIDCounts(hostStatusSummary.workflowStatus)
    ];

    return [
        [`Recorded Note Count: ${noteCount}`,],
        totalWithUrlsMessage,
        totalWithAbstractsMessage,
        updateByDayMessage,
        absByDomainMessages,
        httpStatusByDomainMessages,
        workflowStatus
    ];
}

export function formatStatusMessages(msgs: string[][]): string {
    return _.map(msgs, m => m.join('\n')).join('\n\n')
}
