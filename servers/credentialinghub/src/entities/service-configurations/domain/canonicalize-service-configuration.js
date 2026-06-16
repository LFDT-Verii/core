const canonicalizeServiceConfiguration = (issuerService) => {
  if (issuerService.deactivationDate != null) {
    // eslint-disable-next-line better-mutation/no-mutation
    issuerService.deactivationDate = new Date(issuerService.deactivationDate);
  }

  return issuerService;
};

module.exports = {
  canonicalizeServiceConfiguration,
};
