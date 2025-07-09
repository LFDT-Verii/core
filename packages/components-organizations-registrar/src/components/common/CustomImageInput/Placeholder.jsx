import { Stack, Typography, Button, Divider } from '@mui/material';
import PropTypes from 'prop-types';
import SvgIcon from '@mui/material/SvgIcon';
import Loading from '../../Loading.jsx';

const AddImageIcon = (props) => (
  <SvgIcon {...props} width="63" height="63" viewBox="0 0 63 63" fill="none">
    <path
      // eslint-disable-next-line max-len
      d="M61.2375 16.3459C60.9664 16.0725 60.6438 15.8556 60.2884 15.7075C59.933 15.5594 59.5517 15.4832 59.1667 15.4832C58.7817 15.4832 58.4004 15.5594 58.045 15.7075C57.6896 15.8556 57.367 16.0725 57.0959 16.3459L53.3334 20.1376V3.83341C53.3334 3.05987 53.0261 2.318 52.4791 1.77102C51.9321 1.22404 51.1903 0.916748 50.4167 0.916748C49.6432 0.916748 48.9013 1.22404 48.3543 1.77102C47.8073 2.318 47.5 3.05987 47.5 3.83341V20.1376L43.7375 16.3459C43.1883 15.7967 42.4434 15.4881 41.6667 15.4881C40.89 15.4881 40.1451 15.7967 39.5959 16.3459C39.0467 16.8951 38.7381 17.64 38.7381 18.4167C38.7381 19.1935 39.0467 19.9384 39.5959 20.4876L48.3459 29.2376C48.6233 29.5031 48.9504 29.7113 49.3084 29.8501C49.6575 30.0044 50.035 30.0841 50.4167 30.0841C50.7984 30.0841 51.1759 30.0044 51.525 29.8501C51.8831 29.7113 52.2102 29.5031 52.4875 29.2376L61.2375 20.4876C61.5109 20.2164 61.7279 19.8939 61.876 19.5384C62.0241 19.183 62.1003 18.8018 62.1003 18.4167C62.1003 18.0317 62.0241 17.6505 61.876 17.2951C61.7279 16.9396 61.5109 16.6171 61.2375 16.3459V16.3459ZM50.4167 35.9167C49.6432 35.9167 48.9013 36.224 48.3543 36.771C47.8073 37.318 47.5 38.0599 47.5 38.8334V39.9417L43.1834 35.6251C41.6592 34.1129 39.5992 33.2644 37.4521 33.2644C35.3051 33.2644 33.2451 34.1129 31.7209 35.6251L29.6792 37.6668L22.4459 30.4334C20.9004 28.9623 18.8484 28.1417 16.7146 28.1417C14.5809 28.1417 12.5289 28.9623 10.9834 30.4334L6.66671 34.7501V18.4167C6.66671 17.6432 6.974 16.9013 7.52098 16.3544C8.06796 15.8074 8.80983 15.5001 9.58337 15.5001H32.9167C33.6903 15.5001 34.4321 15.1928 34.9791 14.6458C35.5261 14.0988 35.8334 13.357 35.8334 12.5834C35.8334 11.8099 35.5261 11.068 34.9791 10.521C34.4321 9.97404 33.6903 9.66675 32.9167 9.66675H9.58337C7.26273 9.66675 5.03713 10.5886 3.39619 12.2296C1.75525 13.8705 0.833374 16.0961 0.833374 18.4167V53.4167C0.833374 55.7374 1.75525 57.963 3.39619 59.6039C5.03713 61.2449 7.26273 62.1667 9.58337 62.1667H44.5834C46.904 62.1667 49.1296 61.2449 50.7706 59.6039C52.4115 57.963 53.3334 55.7374 53.3334 53.4167V38.8334C53.3334 38.0599 53.0261 37.318 52.4791 36.771C51.9321 36.224 51.1903 35.9167 50.4167 35.9167ZM9.58337 56.3334C8.80983 56.3334 8.06796 56.0261 7.52098 55.4791C6.974 54.9322 6.66671 54.1903 6.66671 53.4167V43.0043L15.125 34.5459C15.5535 34.1376 16.1227 33.9098 16.7146 33.9098C17.3065 33.9098 17.8757 34.1376 18.3042 34.5459L27.55 43.7917L40.0917 56.3334H9.58337ZM47.5 53.4167C47.4958 53.9751 47.3117 54.5172 46.975 54.9626L33.8209 41.7501L35.8625 39.7084C36.0716 39.495 36.3212 39.3255 36.5967 39.2097C36.8721 39.094 37.1679 39.0343 37.4667 39.0343C37.7655 39.0343 38.0613 39.094 38.3367 39.2097C38.6122 39.3255 38.8618 39.495 39.0709 39.7084L47.5 48.1959V53.4167Z"
    />
  </SvgIcon>
);

const DragAndDrop = ({ show }) =>
  show && (
    <>
      <Stack>
        <AddImageIcon sx={sx.icon} />
      </Stack>
      <Typography variant="h5">Drag & Drop logo (png, jpg, svg)</Typography>
      <Typography variant="caption" sx={sx.caption}>
        Image height and width must be equal. Minimum 300×300, Maximum 400×400. Up to 500 kb.
      </Typography>
    </>
  );

const Processing = ({ show }) =>
  show && (
    <>
      <Loading size={75} color="info" />
      <Typography variant="h5" mt={4}>
        Processing...
      </Typography>
    </>
  );

const PlaceHolder = ({ isDropAccepted, isLoading, errorMessage, orientation, style }) => {
  return (
    <Stack alignItems="center" justifyContent="end" py={2} sx={[sx.placeHolderContainer, style]}>
      <Stack sx={sx.placeHolder} alignItems="center" justifyContent="end">
        <DragAndDrop show={!isDropAccepted} />
        <Processing show={isLoading} />
      </Stack>
      {!isDropAccepted && (
        <Stack sx={sx.dividerContainer}>
          <Divider
            flexItemsx
            sx={[
              sx.divider,
              {
                '&::before, &::after': {
                  ...(orientation === 'horizontal'
                    ? { borderTop: 'thin solid' }
                    : { borderLeft: 'thin solid' }),
                },
              },
            ]}
            variant="fullWidth"
            orientation={orientation}
          >
            or
          </Divider>
        </Stack>
      )}
      <Stack sx={{ flexBasis: isDropAccepted ? '15%' : '30%' }} alignItems="center">
        {!isDropAccepted && (
          <Button variant="outlined" color="primary" sx={sx.button}>
            BROWSE IMAGE
          </Button>
        )}
        {errorMessage && (
          <Stack mt={-1}>
            <Typography variant="caption" display="block" sx={sx.errorMessage}>
              {errorMessage}
            </Typography>
          </Stack>
        )}
      </Stack>
    </Stack>
  );
};

const sx = {
  errorMessage: {
    fontSize: '10px',
    color: 'primary.main',
    wordBreak: 'break-word',
    whiteSpace: 'pre-line',
    lineHeight: '0.75',
  },
  button: { width: '200px', px: 3, py: 1, mx: '1em', my: '1em', fontWeight: 600 },
  icon: {
    fontSize: '4rem',
    color: 'info.main',
    my: 2,
  },
  caption: {
    fontSize: '10px',
    lineHeight: '12px',
    py: 1,
    color: 'text.secondary',
  },
  placeHolderContainer: { height: '100%' },
  placeHolder: { flex: 1, width: '100%', px: '1em' },
  dividerContainer: {
    alignSelf: 'stretch',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  divider: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexBasis: '100%',
    height: '100%',
    '&::before, &::after': {
      borderColor: 'info.main',
    },
  },
};

// eslint-disable-next-line better-mutation/no-mutation
DragAndDrop.propTypes = {
  show: PropTypes.bool,
};

// eslint-disable-next-line better-mutation/no-mutation
Processing.propTypes = {
  show: PropTypes.bool,
};

// eslint-disable-next-line better-mutation/no-mutation
PlaceHolder.propTypes = {
  isDropAccepted: PropTypes.bool,
  isLoading: PropTypes.bool,
  errorMessage: PropTypes.string,
  orientation: PropTypes.string,
  // eslint-disable-next-line react/forbid-prop-types
  style: PropTypes.object,
};

export default PlaceHolder;
