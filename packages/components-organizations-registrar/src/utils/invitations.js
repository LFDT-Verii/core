export const getNewServiceIndex = (services, kebabType) => {
  // eslint-disable-next-line better-mutation/no-mutating-methods
  const servicesOfSameType = services
    .filter((item) => item.id.split('#')[1]?.startsWith(kebabType))
    .sort();

  return (
    // eslint-disable-next-line better-mutation/no-mutating-methods
    parseInt(servicesOfSameType[servicesOfSameType.length - 1]?.id.split('-').reverse()[0], 10) +
      1 || 1
  );
};
