/**
 * Copyright 2023 Velocity Team
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
 */

import { fetchUtils } from 'react-admin';
import httpClient from './httpClient';

export const dataResources = {
  ORGANIZATIONS: 'organizations',
  SERVICES: 'services',
  USERS: 'users',
  CONSENTS: 'consents',
  INVITATIONS: 'invitations',
  TEST_WEBHOOK: 'test-secure-webhook-url',
  VERIFIED_PROFILE: 'verified-profile',
  SEARCH_PROFILES: 'search-profiles',
  SETUP_IMAGE_UPLOAD: 'setup_image_upload',
  IMAGE_UPLOAD: 'image_upload',
};

const remoteDataProvider = (config, auth) => {
  const apiUrl = config.registrarApi;
  const apiOrigin = new URL(config.registrarApi).origin;
  const client = httpClient(config, auth);

  return {
    apiOrigin,
    apiUrl,
    client,
    baseDataProvider: {
      // eslint-disable-next-line complexity
      getList: (resource, params) => {
        let url;

        switch (resource) {
          case dataResources.ORGANIZATIONS: {
            url = `${apiUrl}/${resource}/full`;
            break;
          }

          case 'reference/countries': {
            return client(`${apiOrigin}/${resource}`).then(({ json }) => {
              return {
                data: json.map((item) => {
                  // eslint-disable-next-line better-mutation/no-mutation
                  item.id = item.code;
                  return item;
                }),
                total: json.length,
              };
            });
          }
          case dataResources.INVITATIONS: {
            return client(
              `${apiUrl}/${dataResources.ORGANIZATIONS}/${params.meta.id}/${dataResources.INVITATIONS}?page.size=10&page.skip=${params?.meta?.skip}`,
            ).then(({ json }) => {
              return {
                // TODO temporary fix remove when fix VL-4289
                data: json.invitations,
                total: json.invitations.length,
              };
            });
          }
          case dataResources.SEARCH_PROFILES: {
            return client(
              `${apiUrl}/${dataResources.ORGANIZATIONS}/${dataResources.SEARCH_PROFILES}?${
                params?.filter?.serviceTypes
                  ? `filter.serviceTypes=${params?.filter?.serviceTypes}`
                  : ''
              }&page.size=250&q=${params?.search || ''}`,
            ).then(({ json }) => {
              return {
                data: json.result,
                total: json.result.length,
              };
            });
          }
          default: {
            url = `${apiUrl}/${resource}`;
          }
        }

        const fullUrl = new URL(url);
        // eslint-disable-next-line better-mutation/no-mutation
        fullUrl.search = new URLSearchParams({ 'page.size': 1000 }).toString();

        return client(fullUrl).then(({ json }) => {
          return {
            data: json.result,
            total: 1000, // TODO: update BE is needed here
          };
        });
      },

      // eslint-disable-next-line complexity
      getOne: (resource, params) => {
        let url;

        switch (resource) {
          case dataResources.ORGANIZATIONS: {
            url = `${apiUrl}/${resource}/full/${params.id}`;
            break;
          }

          case dataResources.VERIFIED_PROFILE: {
            url = `${apiUrl}/${dataResources.ORGANIZATIONS}/${params.id}/${resource}`;
            break;
          }

          case dataResources.IMAGE_UPLOAD: {
            return client(
              `${apiUrl}/${dataResources.IMAGE_UPLOAD}/${encodeURIComponent(params.id)}`,
            ).then(({ json }) => {
              return { data: { ...json.imageMetadata, id: params.id }, id: params.id };
            });
          }

          case dataResources.INVITATIONS: {
            if (params.id) {
              return client(`${apiUrl}/${resource}/${params.id}`).then(({ json }) => {
                return {
                  id: json.invitation.code,
                  // TODO temporary fix remove after a BE fix
                  data: { ...json.invitation, id: json.invitation.code },
                };
              });
            }

            if (params.meta.code) {
              return client(`${apiUrl}/${resource}/${params.meta.code}`).then(({ json }) => {
                return { id: json.id, data: json.invitation };
              });
            }

            url = `${apiUrl}/${resource}/${params.id}`;
            break;
          }

          default: {
            url = `${apiUrl}/${resource}/${params.id}`;
          }
        }

        return client(url).then(({ json }) => ({
          data: json,
        }));
      },

      // getMany: (resource, params) => {
      //   const query = {
      //     filter: JSON.stringify({ ids: params.ids }),
      //   };
      //   const url = `${apiUrl}/${resource}?${stringify(query)}`;
      //   return client(url).then(({ json }) => ({ data: json }));
      // },
      //
      // getManyReference: (resource, params) => {
      //   const { page, perPage } = params.pagination;
      //   const { field, order } = params.sort;
      //   const query = {
      //     sort: JSON.stringify([field, order]),
      //     range: JSON.stringify([(page - 1) * perPage, page * perPage - 1]),
      //     filter: JSON.stringify({
      //       ...params.filter,
      //       [params.target]: params.id,
      //     }),
      //   };
      //   const url = `${apiUrl}/${resource}?${stringify(query)}`;
      //
      //   return client(url).then(({ json }) => ({
      //     data: json,
      //     total: 300,
      //   }));
      // },
      //
      // eslint-disable-next-line complexity
      create: (resource, params) => {
        let url;

        switch (resource) {
          case dataResources.ORGANIZATIONS: {
            url = `${apiUrl}/${resource}/full`;
            break;
          }
          case dataResources.SERVICES: {
            url = `${apiUrl}/${dataResources.ORGANIZATIONS}/${params.data.organizationId}/${resource}`;

            return client(url, {
              method: 'POST',
              body: JSON.stringify(params.data.payload),
            }).then(({ json }) => ({ data: { ...json.service, authClient: json.authClient } }));
          }
          case dataResources.INVITATIONS: {
            url = `${apiUrl}/${dataResources.ORGANIZATIONS}/${params.meta.id}/${resource}`;
            return client(url, {
              method: 'POST',
              body: JSON.stringify(params.data),
            }).then(({ json }) => ({ data: { ...json, id: json.invitation.id } }));
          }
          case dataResources.TEST_WEBHOOK: {
            url = `${apiUrl}/${resource}`;
            return client(url, {
              method: 'POST',
              body: JSON.stringify(params.data),
            })
              .then((res) => ({ data: { id: '', status: res.status } }))
              .catch((res) => ({ data: { id: '', status: res.status } }));
          }
          case dataResources.SETUP_IMAGE_UPLOAD: {
            url = `${apiUrl}/${resource}`;
            return client(url, {
              method: 'POST',
              body: JSON.stringify(params.data),
            }).then(({ json }) => ({ data: { ...json, id: json.imageMetadata.url } }));
          }
          case dataResources.IMAGE_UPLOAD: {
            url = `${params.meta.url}`;
            const customHeaders = new Headers({});
            customHeaders.set('Content-Type', `image/${params.meta.contentType}`);
            return fetchUtils
              .fetchJson(url, {
                method: 'PUT',
                headers: customHeaders,
                body: params.data.file,
              })
              .then(({ json }) => ({ data: { ...json, id: Date.now() } }));
          }
          default: {
            url = `${apiUrl}/${resource}`;
          }
        }

        return client(url, {
          method: 'POST',
          body: JSON.stringify(params.data),
        }).then(({ json }) => ({
          data: { ...params.data, ...json },
        }));
      },

      update: (resource, params) => {
        let url;
        let { data } = params;
        switch (resource) {
          case dataResources.ORGANIZATIONS: {
            url = `${apiUrl}/${resource}/profile/${params.id}`;
            data = params.data.profile;
            break;
          }
          case dataResources.SERVICES: {
            url = `${apiUrl}/${dataResources.ORGANIZATIONS}/${
              data.organizationId
            }/${resource}/${params.id.replace('#', '')}`;
            data = params.data.payload;

            break;
          }
          case dataResources.INVITATIONS: {
            url = `${apiUrl}/${dataResources.ORGANIZATIONS}/${data.organizationId}/${resource}/${params.id}`;
            data = params.data.payload;
            return client(url, {
              method: 'PUT',
              body: JSON.stringify(data),
            }).then(({ json }) => ({ data: { id: params.id, ...json } }));
          }
          default: {
            url = `${apiUrl}/${resource}/${params.id}`;
          }
        }
        return client(url, {
          method: 'PUT',
          body: JSON.stringify(data),
        }).then(({ json }) => ({ data: json }));
      },
      //
      // updateMany: (resource, params) => {
      //   const query = {
      //     filter: JSON.stringify({ id: params.ids }),
      //   };
      //   return client(`${apiUrl}/${resource}?${stringify(query)}`, {
      //     method: 'PUT',
      //     body: JSON.stringify(params.data),
      //   }).then(({ json }) => ({ data: json }));
      // },
      //
      delete: (resource, params) => {
        let url;

        switch (resource) {
          case dataResources.SERVICES: {
            url = `${apiUrl}/${dataResources.ORGANIZATIONS}/${
              params.previousData.organizationId
            }/${resource}/${params.id.replace('#', '')}`;
            break;
          }
          case dataResources.INVITATIONS: {
            url = `${apiUrl}/${dataResources.ORGANIZATIONS}/${params.meta.organizationId}/${resource}/${params.id}`;
            break;
          }
          default: {
            url = `${apiUrl}/${resource}/${params.id}`;
          }
        }
        return client(url, {
          method: 'DELETE',
        });
      },
      //
      // deleteMany: (resource, params) => {
      //   const query = {
      //     filter: JSON.stringify({ id: params.ids }),
      //   };
      //   return client(`${apiUrl}/${resource}?${stringify(query)}`, {
      //     method: 'DELETE',
      //     body: JSON.stringify(params.data),
      //   }).then(({ json }) => ({ data: json }));
      // },
    },
  };
};

const extendedDataProvider = (config, auth, customDataProvider) => {
  const { apiUrl, client, baseDataProvider } = remoteDataProvider(config, auth);

  return {
    ...baseDataProvider,
    ...(customDataProvider
      ? customDataProvider(client, apiUrl, baseDataProvider, dataResources)
      : {}),
  };
};

export default extendedDataProvider;
