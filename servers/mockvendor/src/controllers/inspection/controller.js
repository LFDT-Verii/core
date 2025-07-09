const { map, omit } = require('lodash/fp');

const prepCreds = (body) => {
  const metadata = omit(['credentials'], body);
  return map((c) => ({ ...c, ...metadata }), body.credentials);
};

module.exports = async (fastify) => {
  fastify.post('/find-or-create-applicant', async (request) => {
    const { body, repos } = request;
    const applicant = await repos.applicants.insert(body);
    return { vendorApplicantId: applicant._id };
  });

  fastify.post('/add-credentials-to-applicant', async (request) => {
    const { body, repos } = request;
    await repos.applicants.findById(body.vendorApplicantId);
    const inserted = await repos.credentialSubmissions.insertMany(
      prepCreds(body)
    );
    return { numProcessed: inserted.length };
  });

  fastify.post('/receive-unchecked-credentials', async (request) => {
    const { body, repos } = request;
    const inserted = await repos.credentialSubmissions.insertMany(
      prepCreds(body)
    );
    return { numProcessed: inserted.length };
  });

  fastify.post('/receive-checked-credentials', async (request) => {
    const { body, repos } = request;
    const inserted = await repos.credentialSubmissions.insertMany(
      prepCreds(body)
    );
    return { numProcessed: inserted.length };
  });
};
