const getDisclosureId = ({ params, query, exchange }) =>
  exchange?.disclosureId.toString() || params?.id || query?.id;

const getDisclosure = async (ctx) => {
  const { repos } = ctx;
  if (ctx.disclosure) {
    return ctx.disclosure;
  }
  const disclosureId = getDisclosureId(ctx);
  const disclosure = await repos.disclosures.findOne({
    filter: { _id: disclosureId },
  });
  return disclosure;
};

module.exports = {
  getDisclosure,
};
