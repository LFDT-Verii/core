export const isAddButtonDisabled = (
  inProgress,
  isIssueOrInspection,
  selectedCAO,
  serviceEndpoint,
) => {
  return (
    !(
      (isIssueOrInspection && serviceEndpoint && selectedCAO) ||
      (!isIssueOrInspection && serviceEndpoint)
    ) || inProgress
  );
};
