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

import { Paper, Button, Typography } from '@mui/material';
import PropTypes from 'prop-types';
import { useSimpleFormIterator } from 'react-admin';

const checkPosition = (position) => {
  return position === 3 || (position > 3 && (position - 3) % 2 === 0);
};

const PlusButtonBlock = ({ style, disabled: isDisabled, position }) => {
  const { add } = useSimpleFormIterator();
  return (
    <Paper sx={[sx.paper, style && style, checkPosition(position) && sx.fixPosition]} elevation={0}>
      <Button variant="outlined" onClick={() => add()} sx={sx.button} disabled={isDisabled}>
        <Typography sx={sx.title}>+</Typography>
      </Button>
    </Paper>
  );
};

const sx = {
  paper: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '99%',
    background: 'none',
    border: '1px dashed',
    borderColor: 'info.main',
    borderRadius: 1.5,
  },
  button: {
    border: '2px solid',
    borderRadius: '5rem',
    width: '6rem',
    height: '6rem',
    margin: 0,
    color: 'primary.main',
    backgroundColor: 'inherit',
    '&:disabled': {
      borderColor: 'divider.main',
      color: (theme) => theme.customColors.grey2,
    },
  },
  title: {
    fontSize: '5rem',
    lineHeight: 1,
    fontWeight: '100',
    pb: '.5rem',
  },
  fixPosition: { position: 'absolute', bottom: '2em', right: '0', width: 'calc(96%/2)' },
};

export default PlusButtonBlock;

// eslint-disable-next-line better-mutation/no-mutation
PlusButtonBlock.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  style: PropTypes.object,
  disabled: PropTypes.bool,
  position: PropTypes.number,
};
