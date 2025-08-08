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

import { Box, CircularProgress } from '@mui/material';
import PropTypes from 'prop-types';

const Loading = ({ sx = {}, color = 'secondary', size = 40 }) => (
  <Box sx={[defaultSx.loader, sx]}>
    <CircularProgress color={color} size={size} />
  </Box>
);

export default Loading;

// eslint-disable-next-line better-mutation/no-mutation
Loading.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  sx: PropTypes.object,
  color: PropTypes.string,
  size: PropTypes.number,
};

const defaultSx = {
  loader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
};
