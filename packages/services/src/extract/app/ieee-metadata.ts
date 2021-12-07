//

export interface GlobalDocumentMetadata {
  title: string;
  abstract: string;
  authors: Author[];
  pdfPath: string;
}
export interface Author {
  name: string;
  firstName: string;
  lastName: string;
  affiliation: string;
}

// {
//   "title": "Deep Gaussian Conditional Random Field Network: A Model-Based Deep Network for Discriminative Denoising",
//   "abstract": "We propose a novel end-to-end trainable deep network ...",
//   "pdfUrl": "/stamp/stamp.jsp?tp=&arnumber=7780888",
//   "pdfPath": "/iel7/7776647/7780329/07780888.pdf",
//   "authors": [
//     {
//       "name": "Raviteja Vemulapalli",
//       "affiliation": [
//         "Center for Autom. Res., UMIACS Univ. of Maryland, College Park, MD, USA"
//       ],
//       "firstName": "Raviteja",
//       "lastName": "Vemulapalli",
//       "id": "37392304700"
//     },
//   ],
//
//
//
//   "userInfo": {
//     "customerNameRaw": "University of Massachusetts Amherst",
//     "institutionName": "University of Massachusetts Amherst",
//     "institute": true,
//     "member": false,
//     "individual": false,
//     "guest": false,
//     "subscribedContent": false,
//     "fileCabinetContent": false,
//     "fileCabinetUser": false,
//     "institutionalFileCabinetUser": false,
//     "instType": "Academic",
//     "userIds": [
//       11089
//     ],
//     "showPatentCitations": true,
//     "showGet802Link": true,
//     "openUrlImgLoc": "http://www.library.umass.edu/assets/branding/sfxbutton80.gif",
//     "openUrlLink": "http://sfxhosted.exlibrisgroup.com/umass",
//     "instLogoFile": "11089_umawordmark200x50.gif",
//     "showOpenUrlLink": true,
//     "marketingInfoCaptured": false,
//     "tracked": false,
//     "ringGoldId": "14707",
//     "delegatedAdmin": false,
//     "desktop": false,
//     "isInstitutionDashboardEnabled": false,
//     "isInstitutionProfileEnabled": false,
//     "isRoamingEnabled": true,
//     "isDelegatedAdmin": false,
//     "isMdl": false,
//     "isCwg": false
//   },
//   "isbn": [
//     {
//       "format": "Electronic ISBN",
//       "value": "978-1-4673-8851-1",
//       "isbnType": ""
//     },
//   ],
//   "issn": [
//     {
//       "format": "Electronic ISSN",
//       "value": "1063-6919"
//     }
//   ],
//   "articleNumber": "7780888",
//   "dbTime": "5 ms",
//   "metrics": {
//     "citationCountPaper": 24,
//     "citationCountPatent": 0,
//     "totalDownloads": 199
//   },
//   "purchaseOptions": {
//     "showOtherFormatPricingTab": false,
//     "showPdfFormatPricingTab": true,
//     "pdfPricingInfoAvailable": true,
//     "otherPricingInfoAvailable": false,
//     "mandatoryBundle": false,
//     "optionalBundle": false,
//     "pdfPricingInfo": [
//       {
//         "memberPrice": "$14.95",
//         "nonMemberPrice": "$33.00",
//         "partNumber": "7780888",
//         "type": "PDF/HTML"
//       }
//     ],
//     "openUrlFullLink": "http://sfxhosted.exlibrisgroup.com/umass?url_ver=Z39.88-2004&rfr_id=info:sid/IEEE.org:XPLORE&rft_id=info:doi/10.1109/CVPR.2016.519&url_ctx_fmt=info:ofi/fmt:kev:mtx:ctx&rft_val_fmt=info:ofi/fmt:kev:mtx:journal&rft.atitle=Deep Gaussian Conditional Random Field Network: A Model-Based Deep Network for Discriminative Denoising&rft.jtitle=2016 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)&rft.date=2016&rft.spage=4801&rft.epage=4809&rft.eissn=1063-6919&rft.au=Raviteja Vemulapalli&rft.aulast=Raviteja Vemulapalli&rft.isbn=978-1-4673-8851-1"
//   },
//   "getProgramTermsAccepted": false,
//   "sections": {
//     "abstract": "true",
//     "authors": "true",
//     "figures": "true",
//     "multimedia": "false",
//     "references": "true",
//     "citedby": "true",
//     "keywords": "true",
//     "definitions": "false",
//     "algorithm": "false",
//     "dataset": "false",
//     "cadmore": "false",
//     "footnotes": "true",
//     "disclaimer": "false",
//     "metrics": "true"
//   },
//   "formulaStrippedArticleTitle": "Deep Gaussian Conditional Random Field Network: A Model-Based Deep Network for Discriminative Denoising",
//   "standardTitle": "Deep Gaussian Conditional Random Field Network: A Model-Based Deep Network for Discriminative Denoising",
//   "pubLink": "/xpl/conhome/7776647/proceeding",
//   "allowComments": false,
//   "keywords": [
//     {
//       "type": "IEEE Keywords",
//       "kwd": [
//         "Noise level",
//         "Image denoising",
//         "Noise reduction",
//         "Noise measurement",
//         "Training",
//         "Computational modeling",
//         "Optimization"
//       ]
//     },
//     {
//       "type": "INSPEC: Controlled Indexing",
//       "kwd": [
//         "Gaussian processes",
//         "image denoising",
//         "iterative methods"
//       ]
//     },
//     {
//       "type": "INSPEC: Non-Controlled Indexing",
//       "kwd": [
//         "deep Gaussian conditional random field network",
//         "end-to-end trainable deep network architecture",
//         "image denoising",
//         "discriminative denoising methods",
//         "individual noise level",
//         "input noise variance",
//         "parameter generation network",
//         "pairwise potential parameters",
//         "iterative GCRF inference procedure"
//       ]
//     }
//   ],
//   "rightsLink": "http://s100.copyright.com/AppDispatchServlet?publisherName=ieee&publication=proceedings&title=Deep+Gaussian+Conditional+Random+Field+Network%3A+A+Model-Based+Deep+Network+for+Discriminative+Denoising&isbn=978-1-4673-8851-1&publicationDate=June+2016&author=Raviteja+Vemulapalli&ContentID=10.1109/CVPR.2016.519&orderBeanReset=true&startPage=4801&endPage=4809&proceedingName=2016+IEEE+Conference+on+Computer+Vision+and+Pattern+Recognition+%28CVPR%29",
//   "startPage": "4801",
//   "endPage": "4809",
//   "doi": "10.1109/CVPR.2016.519",
//   "publicationTitle": "2016 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)",
//   "displayPublicationTitle": "2016 IEEE Conference on Computer Vision and Pattern Recognition (CVPR)",
//   "issueLink": "/xpl/tocresult.jsp?isnumber=7780329",
//   "doiLink": "https://doi.org/10.1109/CVPR.2016.519",
//   "isGetArticle": false,
//   "isGetAddressInfoCaptured": false,
//   "isMarketingOptIn": false,
//   "applyOUPFilter": false,
//   "pubTopics": [
//     {
//       "name": "Computing and Processing"
//     }
//   ],
//   "publisher": "IEEE",
//   "isNotDynamicOrStatic": false,
//   "isACM": false,
//   "isOUP": false,
//   "isPromo": false,
//   "isNow": false,
//   "isCustomDenial": false,
//   "htmlAbstractLink": "/document/7780888/",
//   "chronOrPublicationDate": "27-30 June 2016",
//   "xploreDocumentType": "Conference Publication",
//   "isFreeDocument": false,
//   "isSAE": false,
//   "conferenceDate": "27-30 June 2016",
//   "isDynamicHtml": true,
//   "isOpenAccess": false,
//   "isConference": true,
//   "publicationDate": "June 2016",
//   "accessionNumber": "16541171",
//   "isEarlyAccess": false,
//   "isJournal": false,
//   "isBook": false,
//   "isBookWithoutChapters": false,
//   "isChapter": false,
//   "isStaticHtml": true,
//   "isProduct": false,
//   "isEphemera": false,
//   "isMorganClaypool": false,
//   "dateOfInsertion": "12 December 2016",
//   "htmlLink": "/document/7780888/",
//   "persistentLink": "https://ieeexplore.ieee.org/servlet/opac?punumber=7776647",
//   "isSMPTE": false,
//   "isStandard": false,
//   "openAccessFlag": "F",
//   "ephemeraFlag": "false",
//   "confLoc": "Las Vegas, NV, USA",
//   "html_flag": "true",
//   "ml_html_flag": "true",
//   "sourcePdf": "8851e801.pdf",
//   "content_type": "Conferences",
//   "mlTime": "PT0.117938S",
//   "chronDate": "27-30 June 2016",
//   "xplore-pub-id": "7776647",
//   "isNumber": "7780329",
//   "rightsLinkFlag": "1",
//   "contentType": "conferences",
//   "publicationNumber": "7776647",
//   "citationCount": "24",
//   "xplore-issue": "7780329",
//   "articleId": "7780888",
//   "onlineDate": "",
//   "publicationYear": "2016",
//   "subType": "IEEE Conference",
//   "_value": "IEEE",
//   "lastupdate": "2020-08-12",
//   "mediaPath": "/mediastore_new/IEEE/content/media/7776647/7780329/7780888"
// }
