# Command line usage
All   system   functions   are   available    from   the   command   line.   Run
`project-root/bin/cli --help` to see available commands.

```bash
➜ bin/cli
run> node ./packages/services/dist/src/cli
CLI Error:
      You need at least one command before moving on

cli <command>

Commands:
  cli extraction-summary  Show A Summary of Spidering/Extraction Progress
  cli run-fetch-service     Fetch new OpenReview URLs into local DB for
                          spidering/extraction
  cli run-extraction-service   Spider new URLs, extract metadata, and POST results
                          back to OpenReview API
  cli mongo-tools         Create/Delete/Update Mongo Database
  cli pm2-restart         Notification/Restart scheduler
  cli test-scheduler      Testing app for scheduler
  cli scheduler           Notification/Restart scheduler
  cli echo                Echo message to stdout, once or repeating
  cli preflight-check     Run checks at startup and halt pm2 apps if anything
                          looks wrong
  cli spider-url          spider the give URL, save results in corpus
  cli extract-url         spider and extract field from given URL
  cli extract-urls        spider and extract field from list of URLs in given
                          file

Options:
  --version  Show version number                                     [boolean]
  --help     Show help                                               [boolean]
```

