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

import { defaultTheme } from 'react-admin';
import { createTheme } from '@mui/material';

const APP_BAR_HEIGHT = '80px';
export const FOOTER_HEIGHT = '60px';

export default createTheme({
  ...defaultTheme,
  palette: {
    background: {
      default: '#FFFFFF',
      light: '#F5F7FB',
      secondary: 'F5F7FB',
    },
    primary: {
      light: '#FCF4F4',
      main: '#CB1923',
      dark: '#A2010A',
      contrastText: '#000',
      success: '#3AC0A2',
      warning: '#ECC83D',
    },
    secondary: {
      light: '#989A9F',
      main: '#1c1c1c',
      dark: '#000000',
      contrastText: '#fff',
    },
    text: {
      primary: '#1B1B1B',
      secondary: '#989A9F',
      disabled: '#989A9F',
    },
    divider: '#D1D4D8',
    info: {
      main: '#D1D4D8',
    },
    success: {
      main: '#3AC0A2',
      light: '#3AC0A21A',
    },
    warning: {
      main: '#ECC83D',
    },
    error: {
      main: '#CB1923',
      light: '#CB19230A',
    },
  },
  customColors: {
    grey3: '#0000001a',
    grey2: '#727379',
    grey1: '#F5F7FB',
  },
  typography: {
    ...defaultTheme.typography,
    fontFamily: "'Inter', 'Helvetica', sans-serif",
    h1: {
      fontWeight: 700,
      fontSize: '36px',
      lineHeight: '44px',
      letterSpacing: '0.01em',
    },
    h3: {
      fontWeight: 600,
      fontSize: '28px',
      lineHeight: '34px',
      letterSpacing: 'normal',
    },
    h4: {
      fontWeight: 600,
      fontSize: '20px',
      lineHeight: '24px',
      letterSpacing: 'normal',
    },
    h5: {
      fontWeight: 600,
      fontSize: '18px',
      lineHeight: '130%',
      letterSpacing: 'normal',
    },
    subtitle1: {
      fontSize: '16px',
      lineHeight: '24px',
    },
    ps: {
      fontWeight: 400,
      fontSize: '10px',
      lineHeight: '120%',
      letterSpacing: 'normal',
    },
    pm: {
      fontWeight: 400,
      letterSpacing: '0.5px',
      fontSize: '14px',
      lineHeight: '150%',
    },
    pl: {
      fontSize: '16px',
      lineHeight: '24px',
      letterSpacing: '0.005em',
    },
  },
  components: {
    MuiDivider: {
      styleOverrides: {
        root: {
          color: '#D1D4D8',
        },
      },
    },
    MuiBackdrop: {
      styleOverrides: {
        root: {
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(6px)',
        },
        invisible: {
          backgroundColor: 'transparent',
          backdropFilter: 'unset',
        },
      },
    },
    MuiButton: {
      variants: [
        {
          props: { color: 'secondary', variant: 'outlined', size: 'small' },
          style: {
            color: '#989A9F',
            borderColor: '#989A9F',
            backgroundColor: '#FFFFFF',
            padding: '9px 35px',
            fontSize: '12px',
            lineHeight: '16px',
            '&:hover': {
              color: '#1B1B1B',
              borderColor: '#1B1B1B',
              backgroundColor: '#FFFFFF',
            },
            '&:active': {
              color: '#1B1B1B',
              borderColor: '#1B1B1B',
              backgroundColor: '#FFFFFF',
            },
            '&:disabled': {
              color: '#D1D4D8',
              borderColor: '#D1D4D8',
              backgroundColor: '#FFFFFF',
            },
          },
        },
        {
          props: { color: 'secondary', variant: 'text', size: 'small' },
          style: {
            color: '#989A9F',
            fontSize: '14px',
            lineHeight: '150%',
            letterSpacing: '0.5px',
            textTransform: 'none',
            fontWeight: 400,
            paddingLeft: 16,
            paddingRight: 16,
            '&:hover': {
              color: '#1B1B1B',
            },
            '&:active': {
              color: '#1B1B1B',
            },
            '&:disabled': {
              color: '#D1D4D8',
            },
          },
        },
        {
          props: { color: 'primary', variant: 'contained' },
          style: {
            color: '#FFFFFF',
            '&:hover': {
              color: '#FFFFFF',
            },
            '&:active': {
              color: '#FFFFFF',
            },
            '&:disabled': {
              color: '#FFFFFF',
            },
          },
        },
      ],
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          color: '#1B1B1B',
          backgroundColor: '#FFFFFF',
          borderBottom: '1px solid #D1D4D8',
          '& .MuiToolbar-root': {
            minHeight: '79px',
          },
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        input: {
          padding: '16px',
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: {
        shrink: {
          transform: 'translate(14px, -9px) scale(0.75) !important',
        },
        outlined: {
          transform: 'translate(16px, 16px) scale(1)',
        },
      },
    },

    MuiDrawer: {
      styleOverrides: {
        docked: {
          height: `calc(100vh - ${APP_BAR_HEIGHT} - ${FOOTER_HEIGHT}) !important`,
        },
      },
    },

    RaLayout: {
      styleOverrides: {
        root: {
          '& .RaLayout-appFrame': {
            marginTop: APP_BAR_HEIGHT,
            '& .RaSidebar-fixed': {
              height: `calc(100vh - ${APP_BAR_HEIGHT} - ${FOOTER_HEIGHT}) !important`,
            },
          },
          '& .RaSidebar-fixed .MuiMenuItem-root': {
            borderRadius: '4px',
            padding: '8px',
            marginLeft: '16px',
            marginBottom: '18px',
          },
          '& .RaMenuItemLink-active': {
            backgroundColor: '#FCF4F4',
          },
          '& .RaLayout-content': {
            paddingBottom: FOOTER_HEIGHT,
          },
        },
      },
    },
  },
});
