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

/* eslint-disable complexity */
import {
  Button,
  Card,
  CardActions,
  CardContent,
  Divider,
  Stack,
  Typography,
  Box,
} from '@mui/material';
import PropTypes from 'prop-types';
import Chip from './Chip.jsx';

const ListItemDeleted = (onUndoDelete, undoText) => (
  <Stack alignItems="center" sx={sx.undoContainer}>
    <Typography sx={sx.undoText}>{undoText || 'Item was deleted'}</Typography>
    <Button onClick={onUndoDelete} variant="contained" elevation={0} sx={sx.undoButton}>
      UNDO
    </Button>
  </Stack>
);

const ListItem = ({
  id,
  title,
  status,
  date,
  email,
  content,
  showActions,
  actions,
  markForDelete,
  onUndoDelete,
  undoText,
}) => {
  return (
    <Card sx={sx.card} elevation={3}>
      <Stack
        direction="row"
        width="100%"
        sx={{
          ...(markForDelete && { visibility: 'hidden' }),
        }}
      >
        <Stack sx={{ flex: 1 }}>
          <CardContent sx={sx.cardContent}>
            <Stack
              flexDirection="row"
              key={`${id}-${title}`}
              justifyContent="space-between"
              sx={{ py: 1, pb: 1.5 }}
            >
              <Typography component="div" variant="h4" alignSelf="center">
                {title}
              </Typography>
              <Stack
                flexDirection="column"
                alignItems="flex-end"
                sx={{ height: 'fit-content', mb: -10 }}
                key={`${id}-${title}`}
              >
                {!!status.title && (
                  <Stack sx={{ pb: 1.5 }}>
                    <Chip label={status.title} color={status.color} />
                  </Stack>
                )}
                {!!email && (
                  <>
                    <Typography
                      variant="body2"
                      alignSelf="center"
                      component="div"
                      sx={{ py: 0.5, pb: 0.5 }}
                    >
                      {email}
                    </Typography>
                    <Typography variant="caption">{date}</Typography>
                  </>
                )}
              </Stack>
            </Stack>

            {content.map((service, i) => (
              // eslint-disable-next-line react/no-array-index-key
              <Box key={i}>
                {service.map(({ name, value }) => (
                  <Stack flexDirection="row" key={`${id}-${value}`} sx={{ py: 1 }}>
                    <Typography sx={sx.name}>{name}</Typography>
                    <Typography sx={sx.value}>{value}</Typography>
                  </Stack>
                ))}
                {i < content.length - 1 && <Divider flexItem sx={{ my: 1 }} />}
              </Box>
            ))}
          </CardContent>
        </Stack>
        {showActions && (
          <>
            <Divider orientation="vertical" flexItem />
            <CardActions sx={{ flexBasis: 'fit-content', p: 0 }}>
              <Stack justifyContent="center" sx={{ px: 4, py: '20px' }}>
                {actions[0] && (
                  <Button
                    variant="outlined"
                    sx={sx.button}
                    startIcon={actions[0].icon}
                    onClick={() => actions[0].action(id)}
                  >
                    {actions[0].title}
                  </Button>
                )}
                {actions[1] && (
                  <Button
                    variant="contained"
                    startIcon={actions[1].icon}
                    onClick={() => actions[1].action(id)}
                  >
                    {actions[1].title}
                  </Button>
                )}
              </Stack>
            </CardActions>
          </>
        )}
      </Stack>
      {markForDelete && ListItemDeleted(onUndoDelete, undoText)}
    </Card>
  );
};

const sx = {
  card: { display: 'flex', my: 2, position: 'relative' },
  cardContent: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    px: 4,
    py: 3,
  },
  name: {
    textTransform: 'uppercase',
    flexBasis: '180px',
    fontWeight: 500,
    pr: 1,
  },
  button: {
    mb: '10px',
    color: 'secondary.light',
    borderColor: 'secondary.light',
  },
  value: { flex: 1, fontWeight: 600, overflowWrap: 'anywhere' },
  undoButton: {
    backgroundColor: 'background.light',
    boxShadow: 'none',
    color: 'secondary.main',
    px: 4,
    width: 'fit-content',
    mt: 3,
    fontWeight: '600',
  },
  undoContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
  },
  undoText: { color: 'secondary.light', fontWeight: '500' },
};

// eslint-disable-next-line better-mutation/no-mutation
ListItem.propTypes = {
  id: PropTypes.string,
  title: PropTypes.string.isRequired,
  status: PropTypes.shape({
    title: PropTypes.string,
    color: PropTypes.string,
  }),
  date: PropTypes.string,
  email: PropTypes.string,
  showActions: PropTypes.bool.isRequired,
  actions: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string,
      icon: PropTypes.element,
      action: PropTypes.func,
    }),
  ),
  content: PropTypes.arrayOf(
    PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.string.isRequired,
        value: PropTypes.string.isRequired,
      }),
    ),
  ),
  markForDelete: PropTypes.bool,
  onUndoDelete: PropTypes.func,
  undoText: PropTypes.string,
};

export default ListItem;
