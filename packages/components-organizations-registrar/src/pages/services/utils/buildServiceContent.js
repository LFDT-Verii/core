export const buildServiceContent = (item, title) => {
  if (!item) return [];

  const value = Array.isArray(item) ? item.join(', ') : item;
  return [{ name: title, value }];
};
