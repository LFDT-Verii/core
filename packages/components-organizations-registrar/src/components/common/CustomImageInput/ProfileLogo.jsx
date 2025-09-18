import { Avatar, Button, Stack } from '@mui/material';
import PropTypes from 'prop-types';
import OrganizationAvatar from '../OrganizationAvatar.jsx';

const ProfileLogo = ({ changeMode, imgSrc, orientation = 'horizontal' }) => {
  const alt = 'logo';
  const avatarSize = orientation === 'vertical' ? 120 : 200;
  return (
    <Stack sx={[sx.container, orientation === 'vertical' ? sx.verticalContainer : {}]}>
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={[
          sx.profileLogoContainer,
          orientation === 'vertical' ? sx.profileLogoVerticalContainer : {},
        ]}
      >
        <Avatar
          alt={alt}
          src={imgSrc}
          variant="square"
          sx={[sx.profileLogo, orientation === 'vertical' ? sx.verticalProfileLogo : {}]}
        >
          <OrganizationAvatar size={avatarSize} name={alt} logo="" />
        </Avatar>
      </Stack>
      <Stack alignItems="center" sx={sx.buttonContainer}>
        <Button variant="outlined" color="primary" sx={sx.button} onClick={() => changeMode(true)}>
          CHANGE IMAGE
        </Button>
      </Stack>
    </Stack>
  );
};

const sx = {
  profileLogoContainer: {
    flex: 1,
    maxHeight: '200px',
  },
  profileLogoVerticalContainer: {
    maxHeight: '120px !important',
  },
  profileLogo: {
    width: 'fit-content',
    height: 'auto',
    maxHeight: '160px',
    background: 'transparent',
    '& .MuiAvatar-fallback': {
      width: '12rem',
      height: '12rem',
    },
  },
  verticalProfileLogo: {
    maxHeight: '120px !important',
    maxWidth: '100%',
    py: 1,
    '& img': {
      maxHeight: '120px !important',
      maxWidth: '100% !important',
      height: 'auto !important',
      width: 'auto !important',
      objectFit: 'contain',
    },
    '& .MuiAvatar-fallback': {
      width: '7.5rem !important',
      height: '7.5rem !important',
    },
  },
  container: {
    height: '100%',
    position: 'relative',
    '& .RaFileInput-dropZone': { height: '100%', background: 'transparent', p: 0 },
    '& .RaFileInput-removeButton': {
      position: 'absolute',
      top: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-around',
      gap: '20px',
      alignItems: 'center',
      overflow: 'hidden',
      p: 1,
      '& button': {
        position: 'relative',
        opacity: 1,
        top: 'auto',
        right: 'auto',
        '&:first-of-type': {
          display: 'none',
        },
      },
    },
    '& .MuiFormHelperText-root': {
      position: 'absolute',
      bottom: '-2.5em',
    },
  },
  verticalContainer: {
    maxHeight: '200px !important',
    height: '200px !important',
    overflow: 'hidden',
  },
  button: { width: '200px', px: 3, py: 1, mx: '1em', my: '1em', fontWeight: 600 },
  buttonContainer: { flexBasis: '35%', width: '100%' },
};

// eslint-disable-next-line better-mutation/no-mutation
ProfileLogo.propTypes = {
  changeMode: PropTypes.func,
  imgSrc: PropTypes.string,
  orientation: PropTypes.oneOf(['vertical', 'horizontal']),
};

export default ProfileLogo;
