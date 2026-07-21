class RegistrarUnavailableError extends Error {
  constructor() {
    super('Wallet search is temporarily unavailable.');
    this.code = 'REGISTRAR_UNAVAILABLE';
  }
}

const disabledReason = (eligible) =>
  eligible ? undefined : 'Phase one requires Velocity Network support.';

const mapWallet = (organization, service) => {
  const protocols = service.supportedExchangeProtocols ?? [];
  const eligible = protocols.includes('VN_API');
  return {
    id: service.id,
    organizationId: organization.id,
    name: service.name ?? organization.name,
    organizationName: organization.name,
    logoUrl: service.logoUrl ?? organization.logo,
    protocols,
    eligible,
    disabledReason: disabledReason(eligible),
    appleAppStoreUrl: service.appleAppStoreUrl,
    playStoreUrl: service.playStoreUrl,
  };
};

const createRegistrarClient = ({ baseUrl, fetchImpl = fetch }) => ({
  searchWallets: async (query) => {
    const url = new URL('/api/v0.6/organizations/search-profiles', baseUrl);
    url.searchParams.set('filter.serviceTypes', 'HolderAppProvider');
    url.searchParams.set('page.size', '20');
    url.searchParams.set('q', query);

    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(5000) });
    } catch {
      throw new RegistrarUnavailableError();
    }
    if (!response.ok) {
      throw new RegistrarUnavailableError();
    }
    const body = await response.json();
    if (!Array.isArray(body.result)) {
      throw new RegistrarUnavailableError();
    }
    return body.result.flatMap((organization) =>
      (organization.service ?? []).map((service) =>
        mapWallet(organization, service),
      ),
    );
  },
});

module.exports = {
  RegistrarUnavailableError,
  createRegistrarClient,
  mapWallet,
};
