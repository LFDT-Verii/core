import { Box, Tooltip, Typography } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import PropTypes from 'prop-types';

const DataItem = ({ title, value, hint, sxValue }) => {
  return (
    <Box>
      {hint ? (
        <Typography
          component="div"
          display="flex"
          mb={1}
          textTransform=""
          variant="pm"
          sx={sx.title}
        >
          <Box component="span" mr={0.5}>
            {title}
          </Box>
          <Tooltip title={hint}>
            <InfoIcon color="info" fontSize="small" cursor="pointer" />
          </Tooltip>
        </Typography>
      ) : (
        <Typography component="div" mb={1} textTransform="" variant="pm" sx={sx.title}>
          {title}
        </Typography>
      )}
      {typeof value === 'string' && (
        <Typography component="div" variant="pl" sx={sxValue}>
          {value || '-'}
        </Typography>
      )}
      {Array.isArray(value) && (
        <>
          {value.map((item) => (
            // eslint-disable-next-line react/jsx-key
            <Typography component="div" variant="pl" sx={sxValue}>
              {item || '-'}
            </Typography>
          ))}
        </>
      )}
    </Box>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
DataItem.propTypes = {
  title: PropTypes.string,
  value: PropTypes.string,
  hint: PropTypes.string,
  // eslint-disable-next-line react/forbid-prop-types
  sxValue: PropTypes.object,
};

const sx = {
  title: { height: '1em' },
};

export default DataItem;
