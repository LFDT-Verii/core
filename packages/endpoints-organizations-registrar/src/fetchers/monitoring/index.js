module.exports = {
  ...require('./monitor-create-fetcher'),
  ...require('./monitor-delete-fetcher'),
  ...require('./monitor-get-all-fetcher'),
  ...require('./monitor-add-to-page-fetcher'),
  ...require('./section-create-fetcher'),
  ...require('./section-get-all-fetcher'),
  ...require('./service-version-fetcher'),
};
