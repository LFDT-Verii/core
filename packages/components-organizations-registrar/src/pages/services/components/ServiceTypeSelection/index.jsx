import { Box, Button, Typography } from '@mui/material';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { Form } from 'react-admin';
import PropTypes from 'prop-types';
import Loading from '@/components/Loading.jsx';
import CustomDropDown from '@/components/common/CustomDropDown.jsx';
import serviceTypes from '@/utils/serviceTypes';

import { getTitle } from '../../utils';

const selectedStep = 1;

export const ServiceTypeSelection = ({
  handleNext,
  isLoading,
  selectedServiceType,
  setSelectedServiceType,
  onDoLater,
}) => {
  return (
    <>
      <Typography variant="pm" sx={styles.step}>
        Step 1/2
      </Typography>
      <Typography variant="h1" mb={2}>
        {getTitle(selectedStep)}
      </Typography>
      <Typography mb={4}>Select the type of service you wish to add.</Typography>
      <Form record={{}}>
        <CustomDropDown
          source="selectedServiceType"
          label="Select type of service"
          value={selectedServiceType}
          onChange={setSelectedServiceType}
          items={serviceTypes}
          stringValue={(item) => item.title}
          parse={(value) => value.id}
          disabled={false}
        />
        <Box sx={[styles.buttonBlock, !onDoLater && styles.rightButton]}>
          {onDoLater && (
            <Button sx={[styles.button]} variant="outlined" color="secondary" onClick={onDoLater}>
              Do Later
            </Button>
          )}
          <Button
            disabled={!selectedServiceType || isLoading}
            variant="outlined"
            sx={[styles.button]}
            endIcon={
              selectedServiceType && isLoading ? (
                <Loading color="error" sx={styles.loader} size={26} />
              ) : (
                <KeyboardArrowRightIcon />
              )
            }
            onClick={handleNext}
          >
            Next
          </Button>
        </Box>
      </Form>
    </>
  );
};

const styles = {
  buttonBlock: {
    display: 'flex',
    marginTop: '40px',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '30px',
  },
  rightButton: {
    justifyContent: 'flex-end',
  },
  step: { color: (theme) => theme.palette.primary.main, pb: '20px', display: 'block' },
  button: { px: 4, py: 1, fontSize: '16px', width: '160px' },
};
// eslint-disable-next-line better-mutation/no-mutation
ServiceTypeSelection.propTypes = {
  handleNext: PropTypes.func.isRequired,
  isLoading: PropTypes.bool,
  selectedServiceType: PropTypes.oneOfType([PropTypes.object, PropTypes.string, PropTypes.number]),
  setSelectedServiceType: PropTypes.func.isRequired,
  onDoLater: PropTypes.func,
};

// eslint-disable-next-line better-mutation/no-mutation
ServiceTypeSelection.defaultProps = {
  isLoading: false,
  selectedServiceType: null,
  onDoLater: null,
};

export default ServiceTypeSelection;
