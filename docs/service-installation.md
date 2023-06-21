# Overview
The  Services  package is  responsible  for  integrating  the spider  and  field
extractors with  OpenReview. It regularly  retrieves updated lists of  URLs from
OpenReview and runs the extraction pipeline. It includes:

- Deployment definitions for running services under PM2.
- Service monitoring and restart
- A local database to maintain the current state of the extractor
- Scheduled messages summarizing the state and progress of the system
- Communication with OpenReview via REST API

# OpenReview Gateway
Polls the openreview REST API to keep a local cache of notes and their state (have abstract/pdf, etc)


# Extraction Service
Process the available URLs from the local DB,
POST results back when appropriate


# PM2

# Command-line Usage

# Summary Reports

# Preflight Checks

# Email Notifications

