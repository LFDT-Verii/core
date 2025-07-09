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

import { Link } from 'react-router';
import PropTypes from 'prop-types';
import { Button, Stack, Grid, Paper, Typography, TablePagination } from '@mui/material';
import { useCallback, useEffect, useState } from 'react';
import ListItem from '../common/ListItem.jsx';

const getDateAndTimeFormated = (dateString) => {
  const twoDigits = (number) => `0${number}`.slice(-2);
  const date = new Date(dateString);
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${date.getDate()} ${twoDigits(
    date.getHours(),
  )}:${twoDigits(date.getMinutes())}`;
};

const ROWS_PER_PAGE = 10;

const InvitationsListContainer = ({
  invitations,
  withdrawAction,
  resendAction,
  onCreateInvite,
  changePage,
  currentPage,
  invitationToDelete,
  onUndoDelete,
}) => {
  const [pagesCount, setPagesCount] = useState(-1);
  const getStatus = (invitation) => {
    if (invitation.acceptedAt) {
      return { title: 'ACCEPTED', color: 'primary.success' };
    }
    if (new Date() >= new Date(invitation.expiresAt)) {
      return { title: 'EXPIRED', color: 'primary.main' };
    }
    return { title: 'INVITED', color: 'primary.warning' };
  };

  const updatePagination = useCallback(
    (nextPage) => {
      if (invitations.length === ROWS_PER_PAGE || nextPage < currentPage) {
        setPagesCount(-1);
        changePage(nextPage);
      } else {
        setPagesCount(currentPage * ROWS_PER_PAGE + invitations.length);
      }
    },
    [changePage, currentPage, invitations.length],
  );

  useEffect(() => {
    if (invitations.length < ROWS_PER_PAGE) {
      setPagesCount(currentPage * ROWS_PER_PAGE + invitations.length);
    }
  }, [currentPage, invitations]);

  return (
    <>
      <Stack sx={sx.inviteButton}>
        <Button variant="outlined" onClick={onCreateInvite}>
          Invite Client +
        </Button>
      </Stack>

      {!!invitations.length &&
        invitations.map((invitation) => (
          <ListItem
            key={invitation.id}
            id={invitation.id}
            markForDelete={invitationToDelete === invitation.id}
            onUndoDelete={onUndoDelete}
            undoText="INVITATION WAS DELETED"
            title={invitation.inviteeProfile.name}
            status={getStatus(invitation)}
            date={getDateAndTimeFormated(invitation.acceptedAt || invitation.updatedAt)}
            showActions={!invitation.acceptedAt}
            actions={[resendAction, withdrawAction]}
            email={invitation.inviteeEmail}
            content={invitation.inviteeService.map((service) => [
              { name: 'service type', value: service.type },
              {
                name: 'service endpoint',
                value: service.serviceEndpoint,
              },
            ])}
          />
        ))}
      {/* TODO Fix paging after api retun total */}
      {(invitations.length > 0 || currentPage > 0) && (
        <TablePagination
          component="div"
          count={pagesCount}
          page={currentPage}
          onPageChange={(e, nextPage) => updatePagination(nextPage)}
          rowsPerPage={ROWS_PER_PAGE}
          rowsPerPageOptions={[]}
        />
      )}

      {!invitations.length && currentPage === 0 && (
        <Grid container>
          <Grid item xs={12}>
            <Paper sx={sx.paper} elevation={1}>
              <Typography sx={sx.text}>
                {'Send your first invitation '}
                <Link to="/invitations/create/step-1">
                  <Typography sx={sx.link} component="a">
                    now
                  </Typography>
                </Link>
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      )}
    </>
  );
};

export default InvitationsListContainer;

const sx = {
  inviteButton: {
    mb: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  paper: {
    height: 158,
    minWidth: 275,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    border: 'none',
    boxShadow: '0px 0px 4px #0000001a, 0px 6px 12px #0000001a',
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    fontWeight: 600,
    color: 'text.primary',
  },
  link: {
    color: 'primary.main',
    textDecoration: 'underline',
    fontWeight: 600,
  },
};

// eslint-disable-next-line better-mutation/no-mutation
InvitationsListContainer.propTypes = {
  // eslint-disable-next-line react/forbid-prop-types
  invitations: PropTypes.array,
  // eslint-disable-next-line react/forbid-prop-types
  withdrawAction: PropTypes.object,
  // eslint-disable-next-line react/forbid-prop-types
  resendAction: PropTypes.object,
  onCreateInvite: PropTypes.func.isRequired,
  changePage: PropTypes.func.isRequired,
  currentPage: PropTypes.number.isRequired,
  invitationToDelete: PropTypes.string,
  onUndoDelete: PropTypes.func.isRequired,
};
