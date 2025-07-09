import { useEffect, useCallback, useMemo, forwardRef } from 'react';
import { AutocompleteInput, useInput } from 'react-admin';
import PropTypes from 'prop-types';

// eslint-disable-next-line prefer-arrow-functions/prefer-arrow-functions
const Autocomplete = forwardRef(function Autocomplete(
  {
    label,
    value: defaultValue,
    onChange,
    disabled,
    items,
    stringValue: format,
    inputText,
    styles,
    source = '',
    parse = (value) => value,
  },
  ref,
) {
  const {
    field,
    fieldState: { error },
  } = useInput({ source, defaultValue, onChange, parse });

  const sortedItems = useMemo(() => {
    return items
      ? [...items].sort((a, b) => {
          return (a.name || '').localeCompare(b.name || '');
        })
      : [];
  }, [items]);

  const defaultInputText = useCallback(
    (choice) => {
      const formatted = format(choice);
      if (typeof formatted === 'string') {
        return formatted;
      }
      return formatted && formatted.props && formatted.props.children
        ? formatted.props.children.toString()
        : '';
    },
    [format],
  );

  useEffect(() => {
    if (sortedItems?.length === 1) {
      field.onChange(sortedItems[0]);
    }
  }, [sortedItems, field]);

  return (
    <AutocompleteInput
      {...field}
      ref={ref}
      label={label}
      choices={sortedItems || []}
      optionText={format}
      inputText={inputText || defaultInputText}
      optionValue="id"
      disabled={disabled || (items && items.length === 1)}
      sx={styles}
      error={!!error}
      helperText={error ? error.message : ''}
      fullWidth
    />
  );
});

// eslint-disable-next-line better-mutation/no-mutation
Autocomplete.propTypes = {
  label: PropTypes.string.isRequired,
  // eslint-disable-next-line react/forbid-prop-types
  value: PropTypes.any,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  // eslint-disable-next-line react/forbid-prop-types
  items: PropTypes.array,
  stringValue: PropTypes.func,
  inputText: PropTypes.func,
  // eslint-disable-next-line react/forbid-prop-types
  styles: PropTypes.object,
  source: PropTypes.string,
  // eslint-disable-next-line react/forbid-prop-types
  defaultValue: PropTypes.any,
  parse: PropTypes.func,
};

export default Autocomplete;
