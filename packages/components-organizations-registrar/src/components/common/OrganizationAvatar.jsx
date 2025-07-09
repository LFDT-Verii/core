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

import React, { useEffect } from 'react';
import { Avatar, Box } from '@mui/material';
import PropTypes from 'prop-types';
import Loading from '../Loading.jsx';

let timer;

const OrganizationAvatar = ({ logo, name, size }) => {
  const sx = useSx(size, name);
  const [reloadAttempts, setReloadAttempts] = React.useState(0);
  const errorHandle = () => {
    if (logo && reloadAttempts < 10) {
      // eslint-disable-next-line better-mutation/no-mutation
      timer = setTimeout(() => {
        setReloadAttempts(reloadAttempts + 1);
      }, 500);
    }
  };
  const loadHandle = () => {
    clearTimeout(timer);
    setReloadAttempts(0);
  };

  useEffect(() => {
    return () => {
      clearTimeout(timer);
    };
  }, []);

  return (
    <Box sx={sx.avatarBorder}>
      <Avatar
        key={`image-${reloadAttempts}`}
        sx={sx.avatar}
        src={logo}
        alt={name}
        onError={errorHandle}
        onLoad={loadHandle}
      >
        {logo && reloadAttempts < 10 ? <Loading /> : name.charAt(0)}
      </Avatar>
    </Box>
  );
};

// eslint-disable-next-line better-mutation/no-mutation
OrganizationAvatar.propTypes = {
  logo: PropTypes.string,
  name: PropTypes.string.isRequired,
  size: PropTypes.number.isRequired,
};

export default OrganizationAvatar;

const useSx = (size, name) => {
  return React.useMemo(() => {
    return {
      avatar: {
        width: size,
        height: size,
        bgcolor: selectColor(name),
        border: `${Math.round(size / 10)}px solid white`,
      },
      avatarBorder: {
        borderRadius: '50%',
        border: (theme) => `1px solid ${theme.palette.divider.main}`,
      },
    };
  }, [size, name]);
};

// Color selection is based on name,
// cause for same organization name we want to see same color across the page refreshes
const selectColor = (name) => {
  const hue = (2 * name.length + name.charCodeAt(name.length - 1)) * 137.508; // use golden angle approximation
  return `hsl(${Math.round(hue % 360)},50%,50%)`;
};
