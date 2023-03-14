# System Architecture

## Components

### OpenExchange
- Low-level communication with OpenReview REST Api,
- login/credentials, GET/POST

### Gateway
- Uses OpenExchange
- Higher level communication with OpenReview

### ShadowDB
- Uses Gateway
- Proxies Gateway operations
- Maintains local DB to cache OpenReview data

### Fetch Service
- Uses ShadowDB
- Runs scheduled data fetches from OpenReview

### Extraction Service
- Uses ShadowDB
- Runs field extractors on any unprocessed data

### Summary Data Service
- Uses ShadowDB
- Summarizes extraction progress,
- Send notifications with summary


### Resource Monitor TODO
- Monitors disk usage
- Log files
- Browser /tmp files
- Corpus files
- Clean up and/or sends notifications when disk usage is high
