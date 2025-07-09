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

import { Paper, Typography } from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import PropTypes from 'prop-types';

const InfoBlock = ({ text }) => (
  <Paper sx={sx.paper} elevation={0}>
    <Typography color="divider.main" mb={2}>
      <InfoIcon sx={{ fontSize: 50 }} />
    </Typography>
    <Typography sx={sx.text}>{text}</Typography>
  </Paper>
);

const sx = {
  paper: {
    minWidth: 275,
    backgroundColor: 'background.light',
    borderRadius: 4,
    height: '55vh',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    mb: 4,
  },
  text: {
    fontSize: 18,
    maxWidth: 540,
    textAlign: 'center',
    fontWeight: 600,
    color: 'text.primary',
  },
};

export default InfoBlock;

// eslint-disable-next-line better-mutation/no-mutation
InfoBlock.propTypes = {
  text: PropTypes.string,
};
