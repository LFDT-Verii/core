const hasValue = (value) => {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  return Boolean(value);
};

const hasRequiredFields = (fields, formData) => {
  if (!formData) {
    return false;
  }

  return fields.every((field) => hasValue(formData[field]));
};

const requiredFieldsByServiceType = [
  {
    isActive: ({ isIssuingOrInspection }) => isIssuingOrInspection,
    requiredFields: ['serviceEndpoint', 'serviceCAO'],
  },
  {
    isActive: ({ isCAO }) => isCAO,
    requiredFields: ['serviceEndpoint'],
  },
  {
    isActive: ({ isWebWallet }) => isWebWallet,
    requiredFields: ['name', 'logo', 'serviceEndpoint', 'supportedExchangeProtocols'],
  },
  {
    isActive: ({ isHolderWallet }) => isHolderWallet,
    requiredFields: [
      'name',
      'logo',
      'serviceEndpoint',
      'supportedExchangeProtocols',
      'playStoreUrl',
      'googlePlayId',
      'appleAppStoreUrl',
      'appleAppId',
    ],
  },
];

export const isAddButtonDisabled = (
  inProgress,
  isIssuingOrInspection,
  isCAO,
  isWebWallet,
  isHolderWallet,
  formData,
) => {
  if (inProgress) {
    return true;
  }

  const serviceType = requiredFieldsByServiceType.find((item) =>
    item.isActive({ isIssuingOrInspection, isCAO, isWebWallet, isHolderWallet }),
  );

  if (!serviceType) {
    return true;
  }

  return !hasRequiredFields(serviceType.requiredFields, formData);
};
