import { useRef } from 'react';
import { Button } from '@mui/material';
import PropTypes from 'prop-types';

const Preview = ({
  imageSrc,
  errorMessage,
  imageShow,
  showLoader,
  setImageHeight,
  setImageWidth,
  resetImage,
}) => {
  const imgRef = useRef(null);

  return (
    imageSrc && (
      <>
        <img
          src={imageSrc}
          alt="logo"
          ref={imgRef}
          style={{
            ...sx.avatarPreview,
            ...{
              display: errorMessage ? 'none' : 'block',
              opacity: imageShow && !showLoader ? 1 : 0,
            },
          }}
          onLoad={() => {
            setImageHeight(imgRef.current.naturalHeight);
            setImageWidth(imgRef.current.naturalWidth);
          }}
        />
        {!showLoader && (
          <Button variant="outlined" color="primary" sx={sx.button} onClick={resetImage}>
            CHANGE IMAGE
          </Button>
        )}
      </>
    )
  );
};

const sx = {
  avatarPreview: {
    zIndex: '-1',
    minHeight: '168px',
    p: '1em',
  },
  button: { width: '200px', px: 3, py: 1, mx: '1em', my: '1em', fontWeight: 600 },
};

// eslint-disable-next-line better-mutation/no-mutation
Preview.propTypes = {
  imageSrc: PropTypes.string,
  errorMessage: PropTypes.string,
  imageShow: PropTypes.bool,
  showLoader: PropTypes.bool,
  setImageHeight: PropTypes.func,
  setImageWidth: PropTypes.func,
  resetImage: PropTypes.func,
};

export default Preview;
