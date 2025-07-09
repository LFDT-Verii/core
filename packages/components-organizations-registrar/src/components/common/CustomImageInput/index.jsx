/* eslint-disable complexity */
/**
 * Copyright 2023 Velocity Team
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import { useCallback, useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ImageInput, useDataProvider, required, useStore } from 'react-admin';
// eslint-disable-next-line import/no-extraneous-dependencies
import { useFormContext } from 'react-hook-form';
import { dataResources } from '../../../utils/remoteDataProvider';
import theme from '../../../theme/theme';
import { toBase64, ERRORS, IMAGE_STATUS_REFETCH_INTERVAL } from './utils.jsx';
import ProfileLogo from './ProfileLogo.jsx';
import Preview from './Preview.jsx';
import PlaceHolder from './Placeholder.jsx';

const CustomImageInput = ({
  label = '',
  editMode,
  addTo,
  style,
  labelText = 'Logo',
  isRequired = true,
  orientation = 'horizontal',
  onChange,
  imgSrc,
}) => {
  const form = useFormContext();
  const dataProvider = useDataProvider();

  const [errorMessage, setErrorMessage] = useState('');
  const [isDropInFocus, setIsDropInFocus] = useState(false);
  const [isDropAccepted, setIsDropAccepted] = useState(false);
  const [isImageLoading, setIsImageLoading] = useState(false);
  const [imageSrc, setImageSrc] = useState(null);
  const [acceptedFile, setAcceptedFile] = useState(null);
  const [isEditMode, setIsEditMode] = useState(editMode);
  const [imageHeight, setImageHeight] = useState(null);
  const [imageWidth, setImageWidth] = useState(null);
  const [isSVG, setIsSVG] = useState(null);
  const [imageExtension, setImageExtension] = useState(null);
  const [imageShow, setImageShow] = useState(false);
  const [imageMetadata, setImageMetadata] = useState(null);
  const [timerIdUploadStatus, setTimerIdUploadStatus] = useStore('timerId', null);
  const showLoader = useMemo(() => {
    return (
      isDropAccepted &&
      (isImageLoading || !imageSrc || (imageMetadata && imageMetadata.state !== 'upload_done'))
    );
  }, [isDropAccepted, isImageLoading, imageSrc, imageMetadata]);

  const handleSetupImageUpload = useCallback(
    async (image, extension) => {
      const file = await toBase64(image);
      const { data } = await dataProvider.create(dataResources.SETUP_IMAGE_UPLOAD, {
        data: { extension: extension.startsWith('svg') ? 'svg' : extension },
      });
      if (addTo) {
        const formValue = form.getValues(addTo);
        form.setValue(addTo, { ...formValue, ...{ logo: data.imageMetadata.url } });
      } else {
        form.setValue('logo', data.imageMetadata.url);
      }
      await dataProvider.create(dataResources.IMAGE_UPLOAD, {
        data: { file },
        meta: { url: data.imageMetadata.uploadUrl, contentType: extension },
      });
      setImageMetadata(data.imageMetadata);
    },
    [addTo, dataProvider, form],
  );

  const handleDropAccepted = useCallback(
    async (acceptedFiles) => {
      setImageHeight(null);
      setImageWidth(null);
      setImageShow(false);
      setIsDropInFocus(false);
      setIsDropAccepted(true);
      setErrorMessage('');
      clearInterval(timerIdUploadStatus);
      const extension = acceptedFiles[0].type.split('/')[1];
      setIsSVG(extension.startsWith('svg'));
      setImageExtension(extension);
      setImageSrc(URL.createObjectURL(acceptedFiles[0]));
      setAcceptedFile(acceptedFiles[0]);

      if (onChange) {
        onChange();
      }
    },
    [onChange, timerIdUploadStatus],
  );

  const handleDropRejected = useCallback((fileRejections) => {
    setIsDropInFocus(false);
    switch (fileRejections[0].errors[0].code) {
      case 'file-too-large':
        setErrorMessage(ERRORS.weight);
        break;
      case 'file-invalid-type':
        setErrorMessage(ERRORS.format);
        break;
      default:
        setErrorMessage(ERRORS.default);
    }
  }, []);

  const resetImage = useCallback(() => {
    setIsEditMode(true);
    setImageSrc(null);
    setIsDropAccepted(false);
    setIsImageLoading(false);
    setImageMetadata(null);
    clearInterval(timerIdUploadStatus);
    setTimerIdUploadStatus(null);
    setAcceptedFile(null);
  }, [setTimerIdUploadStatus, timerIdUploadStatus]);

  const updateImageUploadStatus = useCallback(
    async (url, timer) => {
      const results = await dataProvider.getOne(dataResources.IMAGE_UPLOAD, {
        id: url,
      });
      const resetInterval = () => {
        setIsImageLoading(false);
        clearInterval(timer);
        setTimerIdUploadStatus(null);
      };

      setImageMetadata(results.data);
      if (results.data?.uploadSucceeded) {
        resetInterval();
      }
      if (results.data?.state === 'error') {
        setErrorMessage(ERRORS.failed);
        resetInterval();
      }
    },
    [dataProvider, setTimerIdUploadStatus],
  );

  // Size and shape validation
  useEffect(() => {
    if (imageHeight && imageWidth) {
      if (imageHeight < 300 || imageWidth < 300) {
        setErrorMessage(isSVG ? ERRORS.svgSize : ERRORS.minSize);
      } else if (imageHeight > 400 || imageWidth > 400) {
        setErrorMessage(ERRORS.maxSize);
      } else if (imageHeight !== imageWidth) {
        setErrorMessage(ERRORS.shape);
      } else {
        setImageShow(true);
      }
    }
  }, [imageHeight, imageWidth, isSVG]);

  // Upload valid image
  useEffect(() => {
    if (acceptedFile && !errorMessage && imageShow && imageExtension && !imageMetadata) {
      handleSetupImageUpload(acceptedFile, imageExtension);
    }
  }, [
    acceptedFile,
    errorMessage,
    handleSetupImageUpload,
    imageExtension,
    imageMetadata,
    imageShow,
  ]);

  useEffect(() => {
    if (isEditMode) {
      setTimerIdUploadStatus(null);
    }
  }, [isEditMode, setTimerIdUploadStatus]);

  useEffect(() => {
    if (errorMessage) {
      setIsDropAccepted(false);
      setImageSrc(null);
      setIsImageLoading(false);
      clearInterval(timerIdUploadStatus);
    }
  }, [errorMessage, timerIdUploadStatus]);

  useEffect(() => {
    if (
      imageMetadata?.state === 'pending_upload' &&
      imageMetadata?.url &&
      !timerIdUploadStatus &&
      !errorMessage
    ) {
      setIsImageLoading(true);
      // eslint-disable-next-line better-mutation/no-mutation
      const timer = setInterval(
        () => updateImageUploadStatus(imageMetadata.url, timer),
        IMAGE_STATUS_REFETCH_INTERVAL,
      );
      setTimerIdUploadStatus(timer);
    }
  }, [
    errorMessage,
    imageMetadata,
    setTimerIdUploadStatus,
    timerIdUploadStatus,
    updateImageUploadStatus,
  ]);

  return (
    <fieldset style={sx.fieldset}>
      <legend style={!labelText ? { padding: 0 } : {}}>{`${labelText}${
        isRequired ? ' *' : ''
      }`}</legend>
      {isEditMode ? (
        <ImageInput
          source={addTo ? `${addTo}.logo` : 'logo'}
          fullWidth
          label={label}
          accept={{ 'image/*': ['.png', '.jpg', '.jpeg', '.svg'] }}
          placeholder={
            <PlaceHolder
              isLoading={showLoader}
              isDropAccepted={isDropAccepted}
              errorMessage={errorMessage}
              orientation={orientation}
              style={style}
            />
          }
          sx={[
            sx.container,
            { borderColor: isDropInFocus ? 'primary.main' : 'info.main' },
            { '& .RaFileInput-removeButton': { zIndex: imageSrc ? '1' : '-1' } },
          ]}
          maxSize={500000}
          validate={[isRequired && required(`${labelText}* is required`)]}
          options={{
            onDrop: () => setIsImageLoading(true),
            onDropRejected: handleDropRejected,
            onDropAccepted: handleDropAccepted,
            onDragOver: () => setIsDropInFocus(true),
            onDragLeave: () => setIsDropInFocus(false),
          }}
          helperText={false}
        >
          <Preview
            imageSrc={imageSrc}
            errorMessage={errorMessage}
            imageShow={imageShow}
            showLoader={showLoader}
            setImageHeight={setImageHeight}
            setImageWidth={setImageWidth}
            resetImage={resetImage}
          />
        </ImageInput>
      ) : (
        <ProfileLogo changeMode={setIsEditMode} imgSrc={imgSrc} />
      )}
    </fieldset>
  );
};

export default CustomImageInput;

// eslint-disable-next-line better-mutation/no-mutation
CustomImageInput.propTypes = {
  label: PropTypes.oneOfType([PropTypes.bool, PropTypes.string]),
  editMode: PropTypes.bool,
  addTo: PropTypes.string || PropTypes.undefined,
  style: PropTypes.object || PropTypes.undefined,
  labelText: PropTypes.string,
  isRequired: PropTypes.bool,
  orientation: PropTypes.oneOf(['vertical', 'horizontal']),
  onChange: PropTypes.func,
  imgSrc: PropTypes.string,
};

const sx = {
  fieldset: {
    borderRadius: '6px',
    height: '100%',
    border: '1px solid',
    borderColor: theme.palette.info.main,
    color: theme.palette.text.secondary,
    marginTop: '-12px',
    fontSize: '0.75rem',
    width: '100%',
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
};
