import { Button } from 'react-admin';
import { useFormContext } from 'react-hook-form';

export const OrganizationSubmitButton = () => {
  const form = useFormContext();

  return (
    <Button
      disabled={!form.formState.isValid}
      variant="outlined"
      color="primary"
      type="submit"
      size="large"
      sx={sx.submit}
    >
      Add Service
    </Button>
  );
};

const sx = {
  submit: {
    minWidth: 196,
  },
};

export default OrganizationSubmitButton;
