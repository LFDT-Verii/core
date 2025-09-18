const submitCreateExchange = async (tenantDID, type, { agentFetch }) => {
  const response = await agentFetch.post(
    `operator-api/v0.8/tenants/${tenantDID}/exchanges`,
    { type }
  );

  return response.json();
};

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
    offer
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
