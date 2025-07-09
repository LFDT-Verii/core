import { Avatar, Button, Stack } from '@mui/material';
import PropTypes from 'prop-types';
import OrganizationAvatar from '../OrganizationAvatar.jsx';

const ProfileLogo = ({ changeMode, imgSrc }) => {
  const alt = 'logo';
  return (
    <Stack sx={sx.container}>
      <Stack alignItems="center" justifyContent="center" sx={sx.profileLogoContainer}>
        <Avatar alt={alt} src={imgSrc} variant="square" sx={sx.profileLogo}>
          <OrganizationAvatar size={200} name={alt} logo="" />
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
  profileLogoContainer: { flex: 1 },
  profileLogo: {
    width: 'fit-content',
    height: 'auto',
    maxHeight: '200px',
    background: 'transparent',
    py: 2,
    '& .MuiAvatar-fallback': {
      width: '12rem',
      heigth: '12rem',
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
  button: { width: '200px', px: 3, py: 1, mx: '1em', my: '1em', fontWeight: 600 },
  buttonContainer: { flexBasis: '35%', width: '100%' },
};

// eslint-disable-next-line better-mutation/no-mutation
ProfileLogo.propTypes = {
  changeMode: PropTypes.func,
  imgSrc: PropTypes.string,
};

export default ProfileLogo;
