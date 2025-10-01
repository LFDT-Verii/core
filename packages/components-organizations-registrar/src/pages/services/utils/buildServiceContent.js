export const buildServiceContent = (item, title, isLink = false) => {
  if (!item) return [];

  const value = Array.isArray(item) ? item.join(', ') : item;
  return [{ name: title, value, isLink }];
};
