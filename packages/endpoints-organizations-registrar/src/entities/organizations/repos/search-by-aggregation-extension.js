const { omit, partition, isNumber, reduce } = require('lodash/fp');
const {
  ServiceCategories,
  ServiceTypesOfServiceCategory,
} = require('@verii/organizations-registry');
const {
  DEFAULT_SIZE,
  DEFAULT_SKIP,
  transformToSortDocument,
} = require('@verii/rest-queries');

const {
  getServiceTypesFromCategories,
} = require('../../organization-services/domains');

const { transformDidFilter } = require('./transform-did-filter');

const searchByAggregationExtension = (parent) => ({
  searchByAggregation: (input) => {
    const serviceTypes = getServiceTypesFromCategories(input);
    const aggregationPipeline = [];

    const matchStage = {
      $match: {
        activatedServiceIds: {
          $exists: true,
        },
        deletedAt: { $exists: false },
        ...transformIdFilter(input),
      },
    };

    if (input.q) {
      matchStage.$match['profile.name'] = {
        $regex: new RegExp(input.q, 'igu'),
      };
    }
    aggregationPipeline.push(matchStage);

    if (serviceTypes) {
      aggregationPipeline.push(buildServiceAggregationStage(serviceTypes));
      aggregationPipeline.push({
        $match: {
          services: { $type: 'array', $ne: [] },
        },
      });
    }

    aggregationPipeline.push(buildSortStage(input));
    aggregationPipeline.push(buildPageSkipStage(input));
    aggregationPipeline.push(buildPageSizeStage(input));

    return parent.collection().aggregate(aggregationPipeline).toArray();
  },
});
const ISSUER_SERVICE_TYPES =
  ServiceTypesOfServiceCategory[ServiceCategories.Issuer];

const transformIdFilter = (input) =>
  input?.filter?.did == null
    ? {}
    : transformDidFilter({
        ...omit(['did'], input.filter),
        'didDoc.id': { $in: input.filter.did },
      });

const buildServiceAggregationStage = (serviceTypes) => {
  const [issuerServiceTypes, nonIssuerServiceTypes] = partition(
    (s) => ISSUER_SERVICE_TYPES.includes(s),
    serviceTypes
  );

  const projectStage = {
    $project: {
      didDoc: 1,
      profile: 1,
      activatedServiceIds: 1,
      verifiableCredentialJwt: 1,
      services: {
        $filter: {
          input: '$services',
          as: 'itemService',
          cond: {
            $and: [
              {
                $in: [
                  '$$itemService.type',
                  [...issuerServiceTypes, ...nonIssuerServiceTypes],
                ],
              },
              {
                $in: ['$$itemService.id', '$activatedServiceIds'],
              },
            ],
          },
        },
      },
    },
  };

  return projectStage;
};

const buildSortStage = (input) => {
  const $sort = reduce(
    (acc, el) => ({ ...acc, ...{ [el[0]]: el[1] } }),
    {},
    transformToSortDocument(input)
  );

  return { $sort };
};

const buildPageSizeStage = ({ page }) => {
  if (!isNumber(page?.size)) {
    return { $limit: DEFAULT_SIZE };
  }
  return { $limit: page.size };
};

const buildPageSkipStage = ({ page } = {}) => {
  if (!isNumber(page?.skip) || !isNumber(page?.size)) {
    return { $skip: DEFAULT_SKIP * DEFAULT_SIZE };
  }
  return { $skip: page.skip * page.size };
};

module.exports = { searchByAggregationExtension };
