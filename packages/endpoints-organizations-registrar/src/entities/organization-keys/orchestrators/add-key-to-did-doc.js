const { first } = require('lodash/fp');
const { addKeysToDidDoc } = require('@verii/did-doc');

const addKeyToDidDoc = async (
  { organization, kidFragment, publicKey },
  { repos }
) => {
  const { didDoc, newVerificationMethods } = addKeysToDidDoc({
    didDoc: organization.didDoc,
    keys: [{ id: kidFragment, publicKey }],
  });

  await repos.organizations.update(organization._id, { didDoc });
  return first(newVerificationMethods);
};

module.exports = {
  addKeyToDidDoc,
};
