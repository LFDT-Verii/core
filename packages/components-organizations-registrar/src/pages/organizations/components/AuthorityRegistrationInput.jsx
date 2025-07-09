import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { get } from 'lodash';
import { Box, FormControl, FormControlLabel, Radio, RadioGroup, Tooltip } from '@mui/material';
import {
  TextInput,
  required,
  ArrayInput,
  SimpleFormIterator,
  ResourceContextProvider,
  FormDataConsumer,
} from 'react-admin';
import InfoIcon from '@mui/icons-material/Info';
// eslint-disable-next-line import/no-extraneous-dependencies
import { useFormContext } from 'react-hook-form';
import {
  DUNS_HINT,
  LEI_HINT,
  NATIONAL_AUTHORITY_HINT,
  LINKEDIN_ORGANIZATION_ID,
} from '@/utils/index.jsx';
import { validateWebsite } from '@/components/organizations/CreateOrganization.utils';

export const registrationNumbers = {
  DunnAndBradstreet: {
    authority: 'DunnAndBradstreet',
    label: `D-U-N-S${String.fromCodePoint(174)} Number`,
    hint: DUNS_HINT,
  },
  GLEIF: {
    authority: 'GLEIF',
    label: 'LEI',
    hint: LEI_HINT,
  },
  NationalAuthority: {
    authority: 'NationalAuthority',
    label: 'Local Country Registration ID',
    hint: NATIONAL_AUTHORITY_HINT,
  },
};

export const preservedRegistrationNumbers = {
  LinkedIn: {
    authority: 'LinkedIn',
    label: 'LinkedIn Company Page ID',
    hint: LINKEDIN_ORGANIZATION_ID,
  },
};

export const defaultAuthority = registrationNumbers.DunnAndBradstreet.authority;

const getInitialAuthority = (values, source) => {
  const authority = get(values, source)?.find(
    (r) => r.authority && r.authority !== preservedRegistrationNumbers.LinkedIn.authority,
  )?.authority;

  return typeof authority === 'string' ? authority : defaultAuthority;
};

export const AuthorityRegistrationInput = ({
  orientation = 'horizontal',
  source = 'registrationNumbers',
  isRequired = true,
}) => {
  const { watch, setValue } = useFormContext();
  const formValues = watch();

  const initialAuthority = useMemo(
    () => getInitialAuthority(formValues, source),
    [formValues, source],
  );

  const [selectedAuthority, setSelectedAuthority] = useState(() => initialAuthority);

  const activeAuthorityEntry = useMemo(() => {
    return (get(formValues, source) || []).find((item) => item.authority === selectedAuthority);
  }, [formValues, source, selectedAuthority]);

  const preservedAuthorities = useMemo(() => {
    return (get(formValues, source) || []).filter(
      (r) => r.authority === preservedRegistrationNumbers.LinkedIn.authority,
    );
  }, [formValues, source]);

  const isNationalAuthority = selectedAuthority === registrationNumbers.NationalAuthority.authority;
  const isHorizontal = orientation === 'horizontal';

  useEffect(() => {
    if (!selectedAuthority || activeAuthorityEntry) return;
    // Create empty entry for the selected authority
    const updated = {
      authority: selectedAuthority,
      number: '',
      ...(isNationalAuthority ? { uri: '' } : {}),
    };

    setValue(source, [...preservedAuthorities, updated]);
  }, [
    selectedAuthority,
    source,
    setValue,
    isNationalAuthority,
    preservedAuthorities,
    activeAuthorityEntry,
  ]);

  const handleSelectAuthority = (event) => {
    const authority = event.target.value;
    setSelectedAuthority(() => authority);
  };

  return (
    <FormControl component="fieldset" fullWidth>
      <RadioGroup
        row={isHorizontal}
        value={selectedAuthority}
        onChange={handleSelectAuthority}
        sx={styles.radioGroup}
        mb={isHorizontal ? 2 : 1}
      >
        {Object.entries(registrationNumbers).map(([key, { label }]) => (
          <FormControlLabel
            key={key}
            value={key}
            control={<Radio />}
            label={
              <Box display="flex" alignItems="center" gap={2}>
                {label}
                <Tooltip title={registrationNumbers[key]?.hint || ''}>
                  <InfoIcon color="info" fontSize="small" cursor="pointer" />
                </Tooltip>
              </Box>
            }
          />
        ))}
      </RadioGroup>

      <Box sx={styles.authorityContainer} flexDirection={isNationalAuthority ? 'row' : 'column'}>
        <ResourceContextProvider value="organizations">
          <ArrayInput
            source={source}
            fullWidth
            label={false}
            defaultValue={[{ authority: defaultAuthority, number: '' }]}
          >
            <SimpleFormIterator
              inline={isHorizontal}
              disableAdd
              disableRemove
              disableReordering
              fullWidth
              sx={styles.simpleFormIterator}
              helperText={false}
            >
              <FormDataConsumer>
                {({ scopedFormData }) => {
                  if (scopedFormData?.authority !== selectedAuthority) return null;
                  return (
                    <>
                      {isNationalAuthority && (
                        <TextInput
                          source="uri"
                          label="Local Country Registration Authority Website"
                          validate={[isRequired && required(), ...validateWebsite]}
                          fullWidth
                        />
                      )}

                      <TextInput
                        source="number"
                        label={`${registrationNumbers[selectedAuthority].label}`}
                        validate={isRequired && required()}
                        fullWidth
                      />
                    </>
                  );
                }}
              </FormDataConsumer>
            </SimpleFormIterator>
          </ArrayInput>
        </ResourceContextProvider>
      </Box>
    </FormControl>
  );
};

const styles = {
  radioGroup: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '16px 32px',
    backgroundColor: '#F5F7FB',
  },
  authorityContainer: {
    marginTop: '1em',
    display: 'flex',
  },
  simpleFormIterator: {
    '& .RaSimpleFormIterator-line > .MuiFormHelperText-root + .MuiFormHelperText-root': {
      display: 'none',
    },
    '& .RaSimpleFormIterator-line': {
      border: 'none',
    },
  },
};
// eslint-disable-next-line better-mutation/no-mutation
AuthorityRegistrationInput.propTypes = {
  orientation: PropTypes.oneOf(['horizontal', 'vertical']),
  source: PropTypes.string,
  isRequired: PropTypes.bool,
};

export default AuthorityRegistrationInput;
