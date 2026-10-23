import { SignIn } from '@clerk/expo/web';
import type { ComponentProps } from 'react';
import { peekReturnRoute } from '../../lib/auth/return-route';
import { useTheme } from '../../theme/theme';
export function SignInAction() {
  const { theme } = useTheme();
  const appearance: ComponentProps<typeof SignIn>['appearance'] = {
    variables: {
      colorPrimary: theme.colors.brandText,
      colorBackground: theme.colors.surface,
      colorForeground: theme.colors.ink,
      colorMutedForeground: theme.colors.inkMuted,
      fontFamily: `${theme.typography.body}, sans-serif`,
      fontSize: '16px',
      borderRadius: `${theme.radius.control}px`,
    },
    elements: {
      rootBox: { width: '100%' },
      cardBox: {
        width: '100%',
        boxShadow: 'none !important',
        borderRadius: '0',
        overflow: 'visible',
      },
      card: {
        padding: '0',
        boxShadow: 'none !important',
        background: 'transparent',
        gap: '24px',
        borderRadius: '0',
        overflow: 'visible',
      },
      // As on the original Knightly sign-in: a centred "Continue to Knightly".
      headerTitle: {
        fontFamily: theme.typography.bold,
        fontSize: '20px',
        color: theme.colors.ink,
        textAlign: 'center',
      },
      headerSubtitle: { display: 'none' },
      socialButtonsBlockButton: {
        minHeight: '48px',
        border: `2px solid ${theme.colors.line} !important`,
        borderRadius: '16px',
        background: theme.colors.surface,
        color: theme.colors.ink,
        boxShadow: 'none !important',
        '&:hover': { background: theme.colors.surfaceMuted },
        '&:focus-visible': {
          outline: `2px solid ${theme.colors.focus}`,
          outlineOffset: '2px',
        },
      },
      socialButtonsBlockButtonText: {
        fontFamily: theme.typography.bold,
        fontSize: '16px',
      },
      formFieldLabel: {
        fontFamily: theme.typography.bold,
        fontSize: '14px',
        color: theme.colors.ink,
      },
      formFieldInput: {
        minHeight: '48px',
        padding: '12px 16px',
        fontSize: '16px',
        background: theme.colors.page,
        color: theme.colors.ink,
        border: `2px solid ${theme.colors.line} !important`,
        borderRadius: '16px',
        boxShadow: 'none !important',
        '&:focus': {
          borderColor: `${theme.colors.focus} !important`,
          outline: `2px solid ${theme.colors.focus}`,
          outlineOffset: '2px',
          boxShadow: 'none !important',
        },
      },
      formButtonPrimary: {
        minHeight: '48px',
        padding: '10px 24px',
        marginBottom: '4px',
        fontFamily: theme.typography.bold,
        fontSize: '16px',
        background: theme.colors.brand,
        backgroundImage: 'none',
        color: theme.colors.onBrand,
        border: '2px solid transparent !important',
        borderRadius: '16px',
        boxShadow: `0 4px 0 ${theme.colors.brandLedge} !important`,
        '&:hover': { background: theme.colors.brand, backgroundImage: 'none' },
        '&::after': { display: 'none' },
        '&:active': {
          transform: 'translateY(4px)',
          boxShadow: 'none !important',
        },
        '&:focus-visible': {
          outline: `2px solid ${theme.colors.focus}`,
          outlineOffset: '2px',
        },
        '&:disabled': { opacity: 0.5 },
      },
      footer: {
        background: 'transparent',
        backgroundImage: 'none',
        boxShadow: 'none !important',
      },
      footerActionLink: {
        color: theme.colors.brandText,
        fontFamily: theme.typography.bold,
      },
      dividerLine: { background: theme.colors.line },
      dividerText: { color: theme.colors.inkMuted },
    },
  };
  // One combined flow, as on the original Knightly: new emails sign up.
  return (
    <SignIn
      appearance={appearance}
      routing="hash"
      forceRedirectUrl={peekReturnRoute()}
      withSignUp
    />
  );
}
