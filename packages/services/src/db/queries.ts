import { prettyPrint } from '@watr/commonlib';
import { connectToMongoDB, createCollections, HostStatus, NoteStatus } from './mongodb';


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

export async function showStatusSummary() {

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

    const groupByDomainHasAbstract = {
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

    const groupByDomainHttpStatus = {
        $group: {
            _id: {
                $concat: [
                    '$responseHost', '__', { $concat: [{ $substr: [{ $toString: '$httpStatus' }, 0, 1] }, '**'] }
                ]
            },
            count: {
                $sum: 1
            },
        }
    };


    const res = await HostStatus.aggregate([
        {
            $facet: {
                updateByDay: [groupByUpdateDay, { $sort: { _id: 1 } }],
                totalWithAbstracts: [groupByHaveAbs],
                totalWithUrls: [groupByHaveUrl],
                withAbstractsByDomain: [groupByDomainHasAbstract, { $sort: { _id: 1 } }],
                withHttpStatusByDomain: [groupByDomainHttpStatus, { $sort: { _id: 1 } }],
            }
        }
    ]);
    const numResponses = res.length

    prettyPrint({ numResponses, res });
}
