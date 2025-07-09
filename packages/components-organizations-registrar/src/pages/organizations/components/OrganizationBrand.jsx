import React from 'react';
import { Box } from '@mui/material';
import { TextInput } from 'react-admin';
import { useFormContext } from 'react-hook-form';
import { maxLength, required } from 'ra-core';
import CustomImageInput from '../../../components/common/CustomImageInput/index.jsx';

/* eslint-disable react/prop-types */
export const OrganizationBrand = ({ formData, scopedFormData }) => {
  let brandNameValidate = [maxLength(100)];
  if (scopedFormData && scopedFormData.logo) {
    brandNameValidate = [...brandNameValidate, required('Commercial name field is required')];
  }
  const form = useFormContext();
  const index = formData?.profile?.commercialEntities?.indexOf(scopedFormData) || 0;
  const innerSource = `profile.commercialEntities[${index}]`;
  return (
    <>
      <TextInput
        fullWidth
        label="Commercial Name"
        placeholder="Commercial Name"
        source="name"
        validate={brandNameValidate}
        defaultValue=""
      />
      <Box mt={2} sx={sx.brandLogoContainer}>
        <CustomImageInput
          label={false}
          labelText="Logo"
          editMode
          addTo={innerSource}
          imgSrc={scopedFormData?.logo}
          style={sx.brandLogo}
          isRequired={!!scopedFormData?.name}
          onChange={() => {
            form.setFocus(`${innerSource}.name`);
            form.trigger(`${innerSource}.name`);
          }}
        />
      </Box>
    </>
  );
};
/* eslint-enable */

const sx = {
  brandLogo: { minHeight: '272px' },
};
