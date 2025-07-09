export const getTitle = (step) => {
  switch (step) {
    case 2:
      return "You're one step away from setting up your new service on Velocity Network™";
    case 3:
      return 'Set a Secure Messages URL';
    case 4:
      return 'Congratulations!';
    default:
      return 'Select type of service to add';
  }
};
