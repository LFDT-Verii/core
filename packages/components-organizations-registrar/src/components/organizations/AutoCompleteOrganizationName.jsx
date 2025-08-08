import { useCallback, useState, useEffect } from 'react';
import { Box, Autocomplete, Typography, useTheme, TextField, Button } from '@mui/material';
import { useDataProvider } from 'react-admin';
import { useFormContext } from 'react-hook-form';
import parse from 'autosuggest-highlight/parse';
import match from 'autosuggest-highlight/match';
import { Add as AddIcon } from '@mui/icons-material';
import PropTypes from 'prop-types';
import { dataResources } from '@/utils/remoteDataProvider';
import useDebounce from '@/utils/hooks/useDebounceValue';

const DID_START = 'did:';
const ERRORS = {
  DID_NOT_FOUND: 'DID not found',
  REQUIRED: 'Required',
};

const AutoCompleteOrganizationName = ({ defaultValue }) => {
  const form = useFormContext();
  const [value, setValue] = useState(defaultValue);
  const [text, setText] = useState(defaultValue?.name || '');
  const [options, setOptions] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const dataProvider = useDataProvider();
  const debouncedText = useDebounce(text, 500);
  const theme = useTheme();
  const [stopSearch, setStopSearch] = useState(false);

  form.register('org.name', { required: true });

  useEffect(() => {
    form.setValue('org', value, { shouldValidate: true });
  }, [form, value]);

  useEffect(() => {
    const searchProfiles = async () => {
      if (stopSearch) {
        return;
      }

      setLoading(true);
      try {
        if (debouncedText.includes(DID_START)) {
          const result = await dataProvider.getOne(dataResources.VERIFIED_PROFILE, {
            id: debouncedText,
          });
          setError('');
          setText(result.data.credentialSubject.name);
          setValue(result.data.credentialSubject);
          setIsOpen(false);
          return;
        }

        if (!debouncedText) {
          setOptions([]);

          return;
        }

        const result = await dataProvider.getList(dataResources.SEARCH_PROFILES, {
          search: debouncedText,
        });

        setOptions(result.data.slice(0, 5));
      } catch {
        setOptions([]);

        if (debouncedText.includes(DID_START)) {
          setError(ERRORS.DID_NOT_FOUND);
        }
      } finally {
        setLoading(false);
      }
    };

    if (debouncedText) {
      searchProfiles();
    }
  }, [dataProvider, debouncedText, stopSearch]);

  useEffect(() => {
    if (!isOpen) {
      setOptions([]);
    }
  }, [isOpen]);

  const handleChangeText = useCallback((event) => {
    setText(event?.target?.value);
    setValue({ name: event?.target?.value });
  }, []);

  const handleBlur = useCallback(() => {
    if (!text) {
      setValue(null);
      setError(ERRORS.REQUIRED);
    }

    if (text && !options.length) {
      setValue({ name: text });
    }
  }, [options, text]);

  const handleFocus = useCallback(() => {
    setError('');
  }, []);

  const handleStopSearch = useCallback(() => {
    setStopSearch(true);
    setOptions([]);

    setTimeout(() => {
      setStopSearch(false);
    }, 10000);
  }, []);

  return (
    <Box marginBottom={5}>
      <Autocomplete
        fullWidth
        options={text?.length && !loading ? options : []}
        inputValue={text || ''}
        open={isOpen}
        onOpen={() => setIsOpen(true)}
        onClose={() => setIsOpen(false)}
        onInputChange={handleChangeText}
        getOptionLabel={(params) => params?.name?.toString()}
        getOptionKey={(params) => params.id}
        loading={loading}
        freeSolo
        disableClearable
        blurOnSelect
        value={value}
        filterOptions={(x) => x}
        onChange={(_event, newValue) => {
          if (typeof newValue === 'string') {
            setText(text);
            setValue({ name: text });
            setOptions([]);

            return;
          }

          setValue(newValue);
          setText(newValue.name);
        }}
        renderOption={(props, option, { inputValue }) => {
          const matches = match(option.name, inputValue, { insideWords: true });
          const parts = parse(option.name, matches);
          // eslint-disable-next-line react/prop-types
          const isLastItem = props['data-option-index'] === options.length - 1;

          return (
            <>
              <li {...props} style={isLastItem ? styles.lastItem : styles.item}>
                <div>
                  <div>
                    {parts.map((part, index) => (
                      <Typography
                        /* eslint-disable-next-line react/no-array-index-key */
                        key={index}
                        style={{ fontWeight: part.highlight ? 700 : 400 }}
                        variant="pl"
                      >
                        {part.text}
                      </Typography>
                    ))}
                  </div>
                  <Typography variant="ps" color={theme.palette.secondary.light}>
                    {option.id}
                  </Typography>
                </div>
              </li>

              {isLastItem ? (
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleStopSearch}
                  sx={styles.inviteButton}
                >
                  <AddIcon sx={styles.plus} />
                  Invite New Organization
                </Button>
              ) : null}
            </>
          );
        }}
        renderInput={(params) => (
          <Box style={styles.inputBox}>
            <TextField
              label="Legal Name"
              {...params}
              value={params.inputProps.value.name}
              onBlur={handleBlur}
              onFocus={handleFocus}
              error={error}
            />
            {value?.id ? (
              <Typography
                style={styles.did}
                variant="ps"
                color={theme.palette.secondary.light}
                sx={styles.inviteButton}
              >
                {value.id}
              </Typography>
            ) : null}
          </Box>
        )}
      />
      {error ? (
        <Typography variant="ps" color={theme.palette.error.light}>
          {error}
        </Typography>
      ) : null}
    </Box>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
AutoCompleteOrganizationName.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  defaultValue: PropTypes.object,
};

const styles = {
  inputBox: { position: 'relative' },
  item: {
    padding: '8px 12px',
    borderBottomWidth: '1px',
    borderBottomStyle: 'solid',
    borderBottomColor: '#D1D4D8',
  },
  lastItem: {
    padding: '8px 12px',
  },
  did: {
    position: 'absolute',
    left: '0px',
    bottom: '-12px',
  },
  inviteButton: {
    color: (theme) => theme.customColors.grey2,
    marginBottom: '16px',
    marginLeft: '12px',
    marginTop: '16px',
    fontSize: '12px',
  },
  plus: {
    width: '16px',
    height: '16px',
    marginRight: '6px',
  },
};

export default AutoCompleteOrganizationName;
