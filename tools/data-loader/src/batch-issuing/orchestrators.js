const { omitBy, isNil, find, isString, isEmpty, values } = require('lodash/fp');
const { validateDirectoryExists } = require('./validate-directory-exists');
const { initFetchers } = require('./fetchers');
const {
  prepareNewDisclosureRequest,
  prepareExchangeOffers,
} = require('./prepare-data');
const { printInfo } = require('../helpers/common');
const {
  writeQrCodeFile,
  writeJsonFile,
  writeOutputCsv,
} = require('./file-writers');
const { CREDENTIAL_TYPES, DisclosureType } = require('./constants');
const {
  askDisclosureType,
  askDisclosureList,
  askUseNewDisclosure,
} = require('./prompts');
const { loadCsv, getColName } = require('../helpers/load-csv');

const defaultOptions = {
  vendorUseridColumn: 0,
  identifierMatchColumn: 0,
  authTokenExpiresIn: 525600,
  legacy: false,
  outputCsvName: 'output',
  idCredentialType: 'EmailV1.0',
};

// eslint-disable-next-line consistent-return
const runBatchIssuing = async (opts) => {
  const options = { ...defaultOptions, ...opts };
  validateOptions(options);

  const context = { fetchers: initFetchers(options) };
  await setupDidOption(options, context);
  const [csvHeaders, csvRows] = await loadCsv(options.csvFilename);

  const disclosureRequest = await loadOrPrepareNewDisclosureRequest(
    csvHeaders,
    options,
    context
  );

  const newExchangeOffers = await prepareExchangeOffers(
    csvHeaders,
    csvRows,
    options
  );

  if (options.dryrun) {
    printInfo('Dry Run would create:');
    printInfo(
      JSON.stringify(
        omitBy(isNil, { disclosureRequest, newExchangeOffers }),
        0,
        2
      )
    );

    return { disclosureRequest, newExchangeOffers };
  }

  const issuingDisclosure =
    disclosureRequest.id != null
      ? disclosureRequest
      : await createDisclosureRequest(disclosureRequest, context);

  await writeDisclosureToJson(issuingDisclosure, options);

  const outputs = options.legacy
    ? await runLegacyBatchIssuing(
        issuingDisclosure,
        newExchangeOffers,
        options,
        context
      )
    : await runSingleQrCodeBatchIssuing(
        issuingDisclosure,
        newExchangeOffers,
        options,
        context
      );

  writeOutput(outputs, {
    ...options,
    vendorUserIdColName: getColName(csvHeaders, options.vendorUseridColumn),
  });
};

const loadExistingDisclosuresIfRequired = async (options, context) => {
  if (options.new) {
    return [];
  }

  const disclosures = await loadIntegratedIdentificationDisclosures(context);
  if (options.disclosure) {
    return disclosures;
  }

  // interactive mode is handled below

  if (isEmpty(disclosures)) {
    const useNewDisclosure = await askUseNewDisclosure();
    if (!useNewDisclosure)
      throw new Error(
        'no existing disclosures on the target agent. Use a new disclosure'
      );

    return [];
  }

  const disclosureType = await askDisclosureType();
  return disclosureType === DisclosureType.NEW ? [] : disclosures;
};

const writeOutput = (outputs, options) => {
  if (options.outputcsv && options.legacy) {
    writeOutputCsv(outputs, options);
  }
};

const runLegacyBatchIssuing = async (
  disclosureRequest,
  newExchangeOffers,
  options,
  context
) => {
  const outputs = [];
  for (const newExchangeOffer of newExchangeOffers) {
    outputs.push(
      // eslint-disable-next-line no-await-in-loop
      await createOfferExchangeAndQrCode(
        {
          ...newExchangeOffer,
          disclosureRequest,
        },
        options,
        context
      )
    );
  }

  return outputs;
};

const runSingleQrCodeBatchIssuing = async (
  disclosureRequest,
  newExchangeOffers,
  options,
  context
) => {
  const outputs = [];
  for (const newExchangeOffer of newExchangeOffers) {
    outputs.push(
      // eslint-disable-next-line no-await-in-loop
      await createOfferExchange(
        {
          ...newExchangeOffer,
          disclosureRequest,
        },
        context
      )
    );
  }

  const { fetchers } = context;
  printInfo('Generating qrcode & deep link');
  const deeplink = await fetchers.loadDisclosureDeeplink(disclosureRequest);
  printInfo(`Deep link: ${deeplink}`);
  const qrcode = await fetchers.loadDisclosureQrcode(disclosureRequest);
  const { filePath } = await writeQrCodeFile('qrcode-generic', qrcode, options);
  printInfo(`QRCode saved: ${filePath}`);

  return outputs;
};

const loadOrPrepareNewDisclosureRequest = async (
  csvHeaders,
  options,
  context
) => {
  const disclosures = await loadExistingDisclosuresIfRequired(options, context);

  if (isEmpty(disclosures)) {
    return prepareNewDisclosureRequest(csvHeaders, options);
  }

  const disclosureId = isString(options.disclosure)
    ? options.disclosure
    : await askDisclosureList(disclosures);
  const disclosure = find({ id: disclosureId }, disclosures);
  if (disclosure == null) {
    throw new Error('existing disclosure not found');
  }
  return disclosure;
};

const loadIntegratedIdentificationDisclosures = async ({ fetchers }) =>
  fetchers.getDisclosureList(['integrated-issuing-identification']);

const createDisclosureRequest = async (newDisclosureRequest, { fetchers }) => {
  return fetchers.createDisclosure(newDisclosureRequest);
};

const setupDidOption = async (options, { fetchers }) => {
  if (options.did != null) {
    return;
  }
  let did = 'did to be determined at runtime';
  if (options.dryrun == null) {
    const tenant = await fetchers.getTenant();
    // eslint-disable-next-line better-mutation/no-mutation
    ({ did } = tenant);
  }
  // eslint-disable-next-line better-mutation/no-mutation
  options.did = did;
};

const writeDisclosureToJson = async (disclosureRequest, options) => {
  printInfo(`Using disclosureId:${disclosureRequest.id}`);
  printInfo('');

  const { filePath: disclosureFilePath } = await writeJsonFile(
    disclosureRequest,
    `disclosure-${disclosureRequest.id}`,
    options
  );
  await writeJsonFile(
    {
      disclosureId: disclosureRequest.id,
      disclosureFile: disclosureFilePath,
      timestamp: new Date().toISOString(),
      ...options,
    },
    'lastrun',
    options
  );
};

const createOfferExchangeAndQrCode = async (
  { newExchange, newOffer, disclosureRequest },
  options,
  context
) => {
  const { fetchers } = context;
  const { exchange, offer, vendorUserId } = await createOfferExchange(
    {
      newExchange,
      newOffer,
      disclosureRequest,
    },
    context
  );

  const deeplink = await fetchers.loadExchangeDeeplink(exchange);
  const qrcode = await fetchers.loadExchangeQrcode(exchange);
  const { filePath } = await writeQrCodeFile(
    `qrcode-${vendorUserId}`,
    qrcode,
    options
  );
  printInfo(`${vendorUserId} Done. Qrcode file:${filePath}`);
  printInfo('');

  return {
    exchange,
    offer,
    qrcode,
    qrcodeFilePath: filePath,
    deeplink,
    vendorUserId,
  };
};

const createOfferExchange = async (
  { newExchange, newOffer, disclosureRequest },
  context
) => {
  const { fetchers } = context;
  const { vendorUserId } = newOffer.credentialSubject;
  printInfo(`Setting up vendorUserId:${vendorUserId}`);
  const exchange = await fetchers.createOfferExchange({
    ...newExchange,
    disclosureId: disclosureRequest.id,
  });
  const offer = await fetchers.createOffer(exchange, newOffer);
  await fetchers.submitCompleteOffer(exchange, [offer]);
  return {
    exchange,
    offer,
    vendorUserId,
  };
};

const validateOptions = (options) => {
  if (options.dryrun == null && options.endpoint == null) {
    throw new Error(
      '"-e" or "--endpoint" is required unless executing a "dryrun"'
    );
  }
  if (options.endpoint != null && options.authToken == null) {
    throw new Error('"-a" or "--auth-token" is required');
  }

  validateTenantAndDidArgs(options);

  validateDirectoryExists(options);

  validateCredentialType(options.idCredentialType);
};

const validateTenantAndDidArgs = (options) => {
  if (options.tenant == null && options.did == null) {
    throw new Error('one of "--tenant" or "--did" is required');
  }
};

const validateCredentialType = (idCredentialType) => {
  const allowedIdCredentialTypes = values(CREDENTIAL_TYPES);
  if (
    !idCredentialType ||
    !allowedIdCredentialTypes.includes(idCredentialType)
  ) {
    throw new Error(
      `${idCredentialType} doesn't exist. Please use one of ${allowedIdCredentialTypes}`
    );
  }
};

module.exports = { runBatchIssuing };
