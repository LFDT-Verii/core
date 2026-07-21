import { createTheme } from '@mui/material/styles';

export const colors = {
  ink: '#0d0d0c',
  paper: '#f4f0e7',
  paperRaised: '#faf7f0',
  muted: '#67645e',
  rule: '#cbc4b7',
  verified: '#2cff84',
  error: '#a62c24',
};

export const theme = createTheme({
  palette: {
    mode: 'light',
    background: { default: colors.paper, paper: colors.paperRaised },
    text: { primary: colors.ink, secondary: colors.muted },
    primary: { main: colors.ink },
    success: { main: colors.verified },
    error: { main: colors.error },
  },
  typography: {
    fontFamily: 'Inter, "Helvetica Neue", Arial, sans-serif',
    button: { textTransform: 'none', fontWeight: 700 },
  },
  shape: { borderRadius: 0 },
});
