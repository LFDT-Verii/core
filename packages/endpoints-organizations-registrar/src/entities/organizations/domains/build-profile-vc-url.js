const initBuildProfileVcUrl =
  ({ registrarUrl }) =>
  (didDoc, vcId) =>
    `${registrarUrl}/api/v0.6/organizations/${didDoc.id}/resolve-vc/${vcId}`;

module.exports = {
  initBuildProfileVcUrl,
};
