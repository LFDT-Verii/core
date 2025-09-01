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

const submitOffer = async (
  { offer, tenantDID, exchangeId },
  { agentFetch }
) => {
  const response = await agentFetch.post(
    `operator-api/v0.8/tenants/${tenantDID}/exchanges/${exchangeId}/offers`,
    {
      json: offer,
    }
  );

  return response.json();
};

const completeSubmitOffer = async (
  { exchangeId, tenantDID },
  { agentFetch }
) => {
  const response = await agentFetch.post(
    `operator-api/v0.8/tenants/${tenantDID}/exchanges/${exchangeId}/offers/complete`
  );

  return response.json();
};

module.exports = {
  submitOffer,
  completeSubmitOffer,
  submitCreateExchange,
  getExchangeQrCode,
};
