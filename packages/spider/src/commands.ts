import { arglib } from '@watr/commonlib';
import { scrapeUrlAndQuit } from './scraper';
// import { insertNewAlphaRecords, runLocalSpider } from './spider-service';
const { opt, config, registerCmd } = arglib;

// registerCmd(
//   arglib.YArgs,
//   'scrape-url',
//   'spider via puppeteer ...',
//   config(
//     opt.cwd,
//     opt.existingDir('working-directory: root directory for logging/tmpfile/downloading'),
//     opt.ion('url', {
//       required: true
//     })
//   )
// )((args: any) => {
//   const { url } = args;

//   scrapeUrlAndQuit(url)
//     .then(() => undefined)
// });

// registerCmd(
//   arglib.YArgs,
//   'run-spider',
//   'run spider service locally',
//   config(
//     opt.cwd,
//     opt.existingDir('working-directory: root directory for logging/tmpfile/downloading'),
//     opt.existingFile('alpha-recs: csv file with alpha records')
//   )
// )((args: any) => {
//   const { alphaRecs } = args;

//   runLocalSpider(
//     alphaRecs,
//   ).then(() => undefined);

// });

// registerCmd(
//   arglib.YArgs,
//   'insert-alpha-records',
//   'update the database with new alpha records',
//   config(
//     opt.existingFile('alpha-recs: csv file with alpha records')
//   )
// )((args: any) => {
//   const { alphaRecs } = args;
//   insertNewAlphaRecords(alphaRecs);
// });
