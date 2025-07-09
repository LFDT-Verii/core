/*
 * Copyright 2025 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

const { map, first, includes, isEmpty, filter } = require('lodash/fp');
const { ServiceTypes } = require('@verii/organizations-registry');

const {
  createMonitor,
  deleteMonitor,
  getAllMonitors,
  addMonitorToStatusPage,
  serviceVersion,
  getAllSections,
  createSection,
} = require('../../../fetchers');

const addMonitor = async ({ orgId, orgName, service }, context) => {
  const monitorParams = await createMonitorParams(
    { orgId, orgName, service },
    context
  );

  if (isEmpty(monitorParams)) {
    return undefined;
  }
  const { statusPageId } = first(monitorParams);
  const pageSection = await ensureSectionExists(
    { orgName, statusPageId },
    context
  );

  const monitorsAsResourceResponse = await Promise.all(
    map(async (monitor) => createMonitor(monitor, context), monitorParams)
  );

  return Promise.all(
    map(
      async (monitor) =>
        addMonitorToStatusPage(
          {
            resourceId: monitor.data.id,
            publicName:
              monitor.data.attributes.pronounceable_name.split(' : ')[1],
            statusPageId,
            statusPageSectionId: pageSection.id,
          },
          context
        ),
      monitorsAsResourceResponse
    )
  );
};

const createMonitorParams = async ({ orgId, orgName, service }, ctx) => {
  const monitorNameTemplate = `${getMonitorPrefix(
    ctx.config
  )}, ${orgName}, ${orgId} : ${service.id}`;
  const monitorParams = [];

  if (service.type === ServiceTypes.CredentialAgentOperatorType) {
    const version = await getServiceVersion(service.serviceEndpoint, ctx);
    monitorParams.push({
      url: service.serviceEndpoint,
      pronounceableName: `${monitorNameTemplate}, version-${version}`,
      monitorType: 'status',
      statusPageId: ctx.config.servicesStatusPageId,
    });
  } else if (service.type === ServiceTypes.NodeOperatorType) {
    const paramsTemplate = {
      monitorType: 'keyword',
      requiredKeyword: '"status" : "UP"',
      statusPageId: ctx.config.nodesStatusPageId,
    };
    monitorParams.push({
      ...paramsTemplate,
      pronounceableName: `${monitorNameTemplate} - liveness`,
      url: `${service.serviceEndpoint}/liveness`,
    });
    monitorParams.push({
      ...paramsTemplate,
      pronounceableName: `${monitorNameTemplate} - readiness`,
      url: `${service.serviceEndpoint}/readiness`,
    });
  }
  return monitorParams;
};

const getServiceVersion = async (url, context) => {
  try {
    const response = await serviceVersion(url, context);
    const contentArray = response.body?.split('\n');

    const versionMark = 'version:';

    const result = filter(
      (value) => includes(versionMark, value.toLowerCase()),
      contentArray
    );

    if (isEmpty(result) || first(result) == null) {
      return undefined;
    }

    return first(result).toLowerCase().replace(versionMark, '').trim();
  } catch (error) {
    const { log } = context;
    log.error({ err: error }, 'Failed to retrieve service version');
    return undefined;
  }
};

const synchronizeMonitors = async (context) => {
  const { repos } = context;
  const organizations = await repos.organizations.find();

  const allMonitorsResponse = await getAllMonitors(context);

  return Promise.all(
    map(
      async (organization) =>
        ensureMonitorsExist(organization, allMonitorsResponse.data, context),
      organizations
    )
  );
};

const findMonitorByPartialMatch = (monitorsArray, { orgId, serviceId }) =>
  filter(
    (monitor) =>
      includes(orgId, monitor.attributes.pronounceable_name) &&
      includes(serviceId, monitor.attributes.pronounceable_name),
    monitorsArray
  );

const ensureMonitorExists = async (
  { orgId, orgName, service },
  monitors,
  context
) => {
  const monitorExist = findMonitorByPartialMatch(monitors, {
    orgId,
    serviceId: service.id,
  });
  if (isEmpty(monitorExist)) {
    return addMonitor({ orgId, orgName, service }, context);
  }
  return undefined;
};

const ensureSectionExists = async ({ orgName, statusPageId }, ctx) => {
  const pageSections = await getAllSections(statusPageId, ctx);

  let pageSection = first(
    filter(
      (section) => includes(orgName, section.attributes.name),
      pageSections.data
    )
  );

  if (isEmpty(pageSection)) {
    pageSection = (await createSection({ orgName, statusPageId }, ctx)).data;
  }

  return pageSection;
};

const ensureMonitorsExist = async (organisation, monitors, context) => {
  const { services, didDoc } = organisation;

  return Promise.all(
    map(
      async (service) =>
        ensureMonitorExists(
          { orgId: didDoc.id, orgName: organisation.profile.name, service },
          monitors,
          context
        ),
      services
    )
  );
};

const addMonitors = async ({ orgId, orgName, orgServices }, context) => {
  return Promise.all(
    map(
      (service) => addMonitor({ orgId, orgName, service }, context),
      orgServices
    )
  );
};
const removeMonitor = async ({ orgId, serviceId }, context) => {
  // TODO: Currently account plan is limited by 50 monitors, once plan will be upgraded, pagination will be needed to be implemented
  const allMonitorsResponse = await getAllMonitors(context);

  const monitorsToRemove = findMonitorByPartialMatch(
    allMonitorsResponse?.data,
    { orgId, serviceId }
  );

  return Promise.all(
    map(
      async (monitor) => deleteMonitor({ monitorId: monitor.id }, context),
      monitorsToRemove
    )
  );
};

const getMonitorPrefix = ({ nodeEnv }) => {
  return nodeEnv.toUpperCase();
};

module.exports = {
  addMonitors,
  removeMonitor,
  synchronizeMonitors,
};
