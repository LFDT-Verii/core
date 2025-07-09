const submitCreateExchange = (tenantDID, type, { agentFetch }) =>
  agentFetch
    .post(`operator-api/v0.8/tenants/${tenantDID}/exchanges`, {
      json: { type },
    })
    .json();

const getExchangeQrCode = (
  tenantDID,
  exchangeId,
  vendorOriginContext,
  { agentFetch }
) => {
  const urlSearchParams = new URLSearchParams();
  if (vendorOriginContext != null) {
    urlSearchParams.set('vendorOriginContext', vendorOriginContext);
  }
  return agentFetch.get(
    `operator-api/v0.8/tenants/${tenantDID}/exchanges/${exchangeId}/qrcode.png?${urlSearchParams.toString()}`
  );
};

const submitOffer = ({ offer, tenantDID, exchangeId }, { agentFetch }) =>
  agentFetch
    .post(
      `operator-api/v0.8/tenants/${tenantDID}/exchanges/${exchangeId}/offers`,
      {
        json: offer,
      }
    )
    .json();

const completeSubmitOffer = ({ exchangeId, tenantDID }, { agentFetch }) =>
  agentFetch
    .post(
      `operator-api/v0.8/tenants/${tenantDID}/exchanges/${exchangeId}/offers/complete`
    )
    .json();

module.exports = {
  submitOffer,
  completeSubmitOffer,
  submitCreateExchange,
  getExchangeQrCode,
};
